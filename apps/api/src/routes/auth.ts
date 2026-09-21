import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { redis, tryRedis } from "../lib/redis";
import { signToken, signRefreshToken, requireAuth, verifyToken, verifyTokenOfType } from "../plugins/auth";
import { randomInt } from "crypto";
import * as ids from "../lib/id";
import { hashPassword, verifyPassword, needsRehash, generateToken, hashToken } from "../lib/password";
import { ensurePersonalOrg } from "../lib/scope";
import { toJson } from "../lib/json";
import { isInternalRole, CLIENT_ROLES } from "@stackfox/core";

const ORG_MANAGER_ROLES = ["ORG_OWNER", "CLIENT_ADMIN"];
const ASSIGNABLE_MEMBER_ROLES = CLIENT_ROLES as readonly string[];
import { sendMail, isMailConfigured, passwordResetEmail, verifyEmailMessage, otpEmail } from "../lib/mailer";
import { sendPhoneOtp, verifyPhoneOtp, isSmsConfigured } from "../lib/sms";
import { authorizeUrl, exchangeCode, isGoogleConfigured } from "../lib/googleOAuth";
import { getSessionEpoch, bumpSessionEpoch } from "../lib/session";
import { webAppUrl } from "../lib/urls";
import { randomBytes } from "crypto";

/**
 * Constrains the post-login destination to a path on our own SPA.
 *
 * The value round-trips through Google, so accepting it verbatim would turn the
 * callback into an open redirect. Protocol-relative "//evil.com" is why the
 * second slash is rejected too.
 */
function safeRedirect(target?: string): string {
  if (!target) return "";
  if (!target.startsWith("/") || target.startsWith("//")) return "";
  return target;
}

/**
 * Sends a transactional email, logging rather than throwing on failure.
 *
 * With no provider configured the raw token is written to the log so a local
 * checkout can still complete a reset — but only outside production, where that
 * would be a credential leak into the log sink.
 */
async function deliver(
  app: FastifyInstance,
  message: Parameters<typeof sendMail>[0],
  kind: string,
  email: string,
  token: string,
) {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      app.log.error({ kind, email }, "No email provider configured — link could not be delivered");
    } else {
      app.log.info(`[dev] ${kind} token for ${email}: ${token}`);
    }
    return { delivered: false as const };
  }

  const result = await sendMail(message);
  if (result.delivered) {
    app.log.info({ kind, email }, "Transactional email sent");
  } else {
    app.log.error({ kind, email, error: result.error }, "Transactional email failed");
  }
  return result;
}

/**
 * Mints the access/refresh pair and records the refresh token so it can be
 * revoked. Every sign-in path (password, OTP, Google, WhatsApp) must go through
 * here — a path that skips the Redis write issues a refresh token that
 * /auth/refresh-token will always reject.
 */
async function issueSession(user: { id: string; email: string; role: string }, orgId?: string) {
  // Stamp the token with the user's current session epoch so a later
  // logout / password reset (which bumps the epoch) invalidates it.
  const epoch = await getSessionEpoch(user.id);
  const payload = { sub: user.id, email: user.email, role: user.role, orgId, epoch };
  const accessToken = signToken(payload);
  const refreshToken = signRefreshToken(payload);
  await tryRedis("store refresh token", () => redis.set(`refresh:${user.id}`, refreshToken, "EX", 2592000), null);
  return { accessToken, refreshToken };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register — email + password registration
  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    if (!email || !password) return reply.code(400).send({ message: "Email and password required" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ message: "Email already registered" });

    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        role: "INDIVIDUAL_CLIENT",
        authData: toJson({
          provider: "email",
          passwordHash: await hashPassword(password),
          verified: false,
        }),
      },
    });

    // Every client-side user is scoped by an Org; individuals get a personal one
    // so the portal has a tenant to filter on from the very first request.
    const orgId = await ensurePersonalOrg(user.id);

    const { token: verifyTok, hash } = generateToken();
    await tryRedis("store verify token", () => redis.set(`verify:${hash}`, user.id, "EX", 86400), null);
    // Verification is best-effort: a mail outage must not fail the signup that
    // has already created the account and the org.
    void deliver(app, verifyEmailMessage(email, verifyTok), "verification", email, verifyTok);

    const { accessToken, refreshToken } = await issueSession(user, orgId);

    return {
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId },
        accessToken,
        refreshToken,
      },
    };
  });

  // POST /auth/login — email + password login
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return reply.code(400).send({ message: "Email and password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(401).send({ message: "Invalid credentials" });

    if (!user.isActive) return reply.code(403).send({ message: "This account is disabled" });

    const authData = (user.authData as Record<string, unknown> | null) ?? {};
    const storedHash = authData.passwordHash as string | undefined;
    if (!storedHash || !(await verifyPassword(password, storedHash))) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    // Transparently upgrade anyone still on the legacy unsalted digest.
    if (needsRehash(storedHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { authData: toJson({ ...authData, passwordHash: await hashPassword(password) }) },
      });
    }

    const orgId = isInternalRole(user.role)
      ? (user.orgId ?? undefined)
      : await ensurePersonalOrg(user.id);

    const { accessToken, refreshToken } = await issueSession(user, orgId);

    return {
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId },
        accessToken,
        refreshToken,
      },
    };
  });

  // POST /auth/refresh-token
  app.post("/auth/refresh-token", async (req, reply) => {
    const header = req.headers.authorization;
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const presented = bodyToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : null);
    if (!presented) return reply.code(401).send({ message: "No token" });

    let decoded: { sub: string };
    try {
      // Refresh tokens only — an access token presented here must not renew a
      // session even though it verifies under the same secret.
      decoded = verifyTokenOfType(presented, "refresh");
    } catch {
      return reply.code(401).send({ message: "Invalid token" });
    }

    // The signature alone is not enough: a refresh token must still be the one
    // on record, so logout and password changes actually revoke sessions.
    let onRecord: string | null;
    try { onRecord = await redis.get(`refresh:${decoded.sub}`); } catch {
      return reply.code(503).send({ message: "Session store unavailable" });
    }
    if (!onRecord || onRecord !== presented) {
      return reply.code(401).send({ message: "Session expired, please sign in again" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) return reply.code(401).send({ message: "User not found" });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId ?? undefined,
      epoch: await getSessionEpoch(user.id),
    };
    // Rotate on every use so a leaked token has a single-use lifetime.
    const refreshToken = signRefreshToken(payload);
    await tryRedis("store refresh token", () => redis.set(`refresh:${user.id}`, refreshToken, "EX", 2592000), null);

    return { data: { accessToken: signToken(payload), refreshToken } };
  });

  // POST /auth/forgot-password
  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { email } = req.body as { email: string };
    if (!email) return reply.code(400).send({ message: "Email is required" });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const { token, hash } = generateToken();
      // Key on the hash, not the email, so the token itself is the only way in
      // and a Redis dump cannot be replayed.
      let stored = true;
      try { await redis.set(`reset:${hash}`, user.id, "EX", 3600); } catch { stored = false; }
      if (!stored) {
        // The token was never persisted, so the emailed link could not work.
        // Failing loudly beats a "check your email" that never arrives.
        return reply.code(503).send({ message: "Password reset is temporarily unavailable" });
      }
      const result = await deliver(app, passwordResetEmail(email, token), "password reset", email, token);
      if (!result.delivered && isMailConfigured()) {
        // A configured provider that rejected the send is a real outage, not an
        // unknown-account case, so it is safe to surface without leaking
        // whether the address exists — every caller reaching here has an account.
        return reply.code(502).send({ message: "We could not send the reset email. Please try again shortly." });
      }
    }
    // Always the same response — otherwise this endpoint enumerates accounts.
    return { success: true, message: "If an account exists, a reset link has been sent" };
  });

  // POST /auth/reset-password
  app.post(
    "/auth/reset-password",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { token, password } = req.body as { token: string; password: string };
    if (!token || !password) return reply.code(400).send({ message: "Token and password required" });
    if (password.length < 8) {
      return reply.code(400).send({ message: "Password must be at least 8 characters" });
    }

    const key = `reset:${hashToken(token)}`;
    let userId: string | null;
    try { userId = await redis.get(key); } catch {
      return reply.code(503).send({ message: "Password reset is temporarily unavailable" });
    }
    if (!userId) return reply.code(400).send({ message: "This reset link is invalid or has expired" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(400).send({ message: "This reset link is invalid or has expired" });

    const authData = (user.authData as Record<string, unknown> | null) ?? {};
    await prisma.user.update({
      where: { id: userId },
      data: { authData: toJson({ ...authData, passwordHash: await hashPassword(password) }) },
    });

    // Drop every existing session: epoch bump invalidates all outstanding
    // access tokens (Redis-independent) and clears the refresh token.
    await bumpSessionEpoch(userId);
    await tryRedis("clear reset token", () => redis.del(key), 0);

    return { success: true, message: "Password reset" };
  });

  // POST /auth/verify-email
  app.post(
    "/auth/verify-email",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { token } = req.body as { token: string };
    if (!token) return reply.code(400).send({ message: "Token required" });

    const key = `verify:${hashToken(token)}`;
    let userId: string | null;
    try { userId = await redis.get(key); } catch {
      return reply.code(503).send({ message: "Verification is temporarily unavailable" });
    }
    if (!userId) return reply.code(400).send({ message: "This verification link is invalid or has expired" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(400).send({ message: "This verification link is invalid or has expired" });

    const authData = (user.authData as Record<string, unknown> | null) ?? {};
    await prisma.user.update({
      where: { id: userId },
      data: { authData: toJson({ ...authData, verified: true, verifiedAt: new Date().toISOString() }) },
    });
    await tryRedis("clear verify token", () => redis.del(key), 0);

    return { success: true, message: "Email verified" };
  });

  // POST /auth/otp/send
  app.post(
    "/auth/otp/send",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { email, phone } = req.body as { email?: string; phone?: string };
    if (!email && !phone) return reply.code(400).send({ error: "email or phone required" });

    // ── Phone: MSG91 generates, stores and rate-limits the code ────────────────
    if (phone && !email) {
      if (isSmsConfigured()) {
        const result = await sendPhoneOtp(phone);
        if (!result.ok) {
          app.log.error({ phone, error: result.error }, "OTP SMS failed");
          return reply.code(502).send({ error: "We could not send your code. Please try again shortly." });
        }
        return { success: true, message: "OTP sent", channel: "sms" };
      }
      if (process.env.NODE_ENV === "production") {
        return reply.code(503).send({ error: "Phone verification is not available on this server" });
      }
      app.log.info(`[dev] no SMS provider — phone OTP for ${phone} would be sent by MSG91`);
      return { success: true, message: "OTP sent", channel: "log" };
    }

    // ── Email: we generate + store in Redis, Resend delivers ───────────────────
    const otp = String(randomInt(100000, 999999));
    let stored = true;
    try {
      await redis.set(`otp:${email}`, otp, "EX", 300); // 5 min TTL
    } catch {
      stored = false;
    }
    if (!stored) {
      return reply.code(503).send({ error: "One-time codes are temporarily unavailable" });
    }

    if (isMailConfigured()) {
      const result = await sendMail(otpEmail(email!, otp));
      if (!result.delivered) {
        app.log.error({ email, error: result.error }, "OTP email failed");
        return reply.code(502).send({ error: "We could not send your code. Please try again shortly." });
      }
      return { success: true, message: "OTP sent", channel: "email" };
    }
    if (process.env.NODE_ENV === "production") {
      app.log.error({ email }, "OTP requested but no email provider is configured");
      return reply.code(503).send({ error: "One-time codes are not available on this server" });
    }
    app.log.info(`[dev] OTP for ${email}: ${otp}`);
    return { success: true, message: "OTP sent", channel: "log" };
  });

  // POST /auth/otp/verify
  const OTP_MAX_ATTEMPTS = 5;
  app.post(
    "/auth/otp/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { email, phone, code } = req.body as {
      email?: string;
      phone?: string;
      code: string;
    };
    if (!email && !phone) return reply.code(400).send({ error: "email or phone required" });
    if (!code) return reply.code(400).send({ error: "code required" });

    if (phone && !email) {
      // MSG91 holds the code for phone and enforces its own lockout.
      if (!isSmsConfigured()) {
        return reply.code(503).send({ error: "Phone verification is not available on this server" });
      }
      const result = await verifyPhoneOtp(phone, code);
      if (!result.ok) {
        const ipBlocked = /whitelist/i.test(result.error ?? "");
        if (ipBlocked) app.log.error({ error: result.error }, "MSG91 rejected the server IP");
        return reply.code(ipBlocked ? 503 : 401).send({
          error: ipBlocked ? "Phone verification is misconfigured" : "Invalid or expired code",
        });
      }
    } else {
      // Email code lives in Redis. A wrong-guess counter (same TTL as the code
      // itself) caps brute-force attempts against the 6-digit space — once
      // exhausted, the code is invalidated outright rather than left guessable
      // for the rest of its 5-minute window.
      const attemptsKey = `otp-attempts:${email}`;
      // Fails closed: an unreachable Redis reports the cap as already hit
      // rather than resetting the counter to zero on every error.
      const attempts = await tryRedis(
        "read OTP attempts",
        async () => Number((await redis.get(attemptsKey)) ?? 0),
        OTP_MAX_ATTEMPTS,
      );
      if (attempts >= OTP_MAX_ATTEMPTS) {
        return reply.code(429).send({ error: "Too many incorrect attempts. Request a new code." });
      }

      const stored = await tryRedis("read email OTP", () => redis.get(`otp:${email}`), null);
      if (!stored || stored !== code) {
        await tryRedis("record failed OTP attempt", async () => {
          const ttl = await redis.ttl(`otp:${email}`);
          await redis.set(attemptsKey, attempts + 1, "EX", ttl > 0 ? ttl : 300);
        }, undefined);
        return reply.code(401).send({ error: "Invalid or expired OTP" });
      }
      await tryRedis("clear consumed email OTP", async () => {
        await redis.del(`otp:${email}`);
        await redis.del(attemptsKey);
      }, undefined);
    }

    let user = await prisma.user.findFirst({
      where: email ? { email } : { phone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: email?.split("@")[0] ?? phone ?? "User",
          email: email ?? `${phone}@phone.stackfox.in`,
          phone,
          role: "INDIVIDUAL_CLIENT",
        },
      });
    }

    const orgId = isInternalRole(user.role)
      ? (user.orgId ?? undefined)
      : await ensurePersonalOrg(user.id);

    const { accessToken, refreshToken } = await issueSession(user, orgId);

    return {
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId },
        accessToken,
        refreshToken,
      },
    };
  });

  // ── Google Sign-In ────────────────────────
  //
  // Two hops: /auth/google parks a one-time state in Redis and bounces the
  // browser to Google; /auth/google/callback trades the code for a profile and
  // bounces back to the SPA with a session in the URL fragment. The fragment is
  // never sent to a server, so tokens stay out of access logs and Referer
  // headers on the way home.

  // GET /auth/google — start the flow
  app.get("/auth/google", async (req, reply) => {
    if (!isGoogleConfigured()) {
      return reply.code(503).send({ message: "Google sign-in is not configured on this server" });
    }

    const { redirect } = req.query as { redirect?: string };
    const state = randomBytes(24).toString("hex");

    // The state must be single-use and server-held; a cookie or a self-signed
    // value would let an attacker mint one and complete a login CSRF.
    try {
      await redis.set(`oauth:state:${state}`, safeRedirect(redirect), "EX", 600);
    } catch {
      return reply.code(503).send({ message: "Sign-in is temporarily unavailable" });
    }

    const url = authorizeUrl(state);
    app.log.info({ googleAuthorizeUrl: url }, "Google OAuth redirect");
    return reply.redirect(url);
  });

  // GET /auth/google/callback — finish the flow
  app.get("/auth/google/callback", async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    // The user hit "Cancel" on Google's consent screen.
    if (error) return reply.redirect(`${webAppUrl()}/login?error=${encodeURIComponent(error)}`);
    if (!code || !state) return reply.redirect(`${webAppUrl()}/login?error=invalid_response`);

    let redirectTo: string | null;
    try {
      redirectTo = await redis.get(`oauth:state:${state}`);
      // Burn it immediately: a replayed code must not produce a second session.
      await redis.del(`oauth:state:${state}`);
    } catch {
      return reply.redirect(`${webAppUrl()}/login?error=session_unavailable`);
    }
    if (redirectTo === null) {
      return reply.redirect(`${webAppUrl()}/login?error=expired_state`);
    }

    let profile;
    try {
      profile = await exchangeCode(code);
    } catch (err) {
      app.log.error({ err: (err as Error).message }, "Google sign-in exchange failed");
      return reply.redirect(`${webAppUrl()}/login?error=google_exchange_failed`);
    }

    // An unverified Google address could belong to someone else, and linking on
    // email would hand them that StackFox account.
    if (!profile.emailVerified) {
      return reply.redirect(`${webAppUrl()}/login?error=email_unverified`);
    }

    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (user && !user.isActive) {
      return reply.redirect(`${webAppUrl()}/login?error=account_disabled`);
    }

    if (user) {
      // Existing account — attach the Google identity. An account that already
      // has a password keeps it; the two sign-in methods coexist.
      const authData = (user.authData as Record<string, unknown> | null) ?? {};
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name || profile.name || profile.email.split("@")[0],
          authData: toJson({
            ...authData,
            googleId: profile.googleId,
            picture: profile.picture ?? authData.picture,
            // Google has already proven the address, whichever way they signed up.
            verified: true,
            verifiedAt: authData.verifiedAt ?? new Date().toISOString(),
          }),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: profile.name || profile.email.split("@")[0],
          email: profile.email,
          role: "INDIVIDUAL_CLIENT",
          authData: toJson({
            provider: "google",
            googleId: profile.googleId,
            picture: profile.picture,
            verified: true,
            verifiedAt: new Date().toISOString(),
          }),
        },
      });
    }

    const orgId = isInternalRole(user.role)
      ? (user.orgId ?? undefined)
      : await ensurePersonalOrg(user.id);

    const { accessToken, refreshToken } = await issueSession(user, orgId);

    const fragment = new URLSearchParams({ accessToken, refreshToken });
    if (redirectTo) fragment.set("redirect", redirectTo);
    return reply.redirect(`${webAppUrl()}/auth/callback#${fragment.toString()}`);
  });

  // POST /auth/whatsapp/callback
  //
  // This was the only auth endpoint with no per-route rate limit and no
  // wrong-guess counter, so a 6-digit code was brute-forceable at the global
  // 100/min with no lockout — and on success it logged in (or silently created)
  // whoever held that phone number, internal roles included.
  app.post(
    "/auth/whatsapp/callback",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { phone, code } = req.body as { phone: string; code: string };
    if (!phone || !code) return reply.code(400).send({ error: "phone and code are required" });

    const attemptsKey = `otp-attempts:${phone}`;
    // Fails closed, as on the email path above.
    const attempts = await tryRedis(
      "read OTP attempts",
      async () => Number((await redis.get(attemptsKey)) ?? 0),
      OTP_MAX_ATTEMPTS,
    );
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return reply.code(429).send({ error: "Too many incorrect attempts. Request a new code." });
    }

    const stored = await tryRedis("read phone OTP", () => redis.get(`otp:${phone}`), null);
    if (!stored || stored !== code) {
      // Same counter shape as the email path: capped against the 6-digit space
      // and expiring with the code rather than lingering.
      await tryRedis("record failed OTP attempt", async () => {
        const ttl = await redis.ttl(`otp:${phone}`);
        await redis.set(attemptsKey, attempts + 1, "EX", ttl > 0 ? ttl : 300);
      }, undefined);
      return reply.code(401).send({ error: "Invalid OTP" });
    }
    await tryRedis("clear consumed phone OTP", async () => {
      await redis.del(`otp:${phone}`);
      await redis.del(attemptsKey);
    }, undefined);

    let user = await prisma.user.findFirst({ where: { phone } });
    if (user && isInternalRole(user.role)) {
      // A staff account must not be reachable through an unauthenticated phone
      // callback. Staff sign in with a password.
      return reply.code(403).send({ error: "This account cannot sign in this way." });
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "WhatsApp User",
          email: `${phone}@wa.stackfox.in`,
          phone,
          role: "INDIVIDUAL_CLIENT",
        },
      });
    }

    const orgId = await ensurePersonalOrg(user.id);
    const { accessToken, refreshToken } = await issueSession(user, orgId);

    return {
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId },
        accessToken,
        refreshToken,
      },
    };
  });

  // POST /auth/logout
  app.post("/auth/logout", async (req, reply) => {
    // Stateless JWT — client discards token
    // Optionally blacklist token in Redis
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7);
      try {
        const decoded = verifyToken(token);
        // Epoch bump is the durable revocation — it invalidates every token for
        // this user via the user row, so it works even with Redis down. It also
        // drops the refresh token. The denylist write below is a best-effort
        // fast path for the common (Redis up) case.
        await bumpSessionEpoch(decoded.sub);
        await redis.set(`blacklist:${token}`, "1", "EX", 86400).catch(() => {});
      } catch {
        // Token already invalid/expired — nothing to revoke.
      }
    }
    return { success: true };
  });

  // GET /auth/me
  app.get("/auth/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { org: true },
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    return {
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          orgId: user.orgId,
          org: user.org,
          verified: Boolean((user.authData as Record<string, unknown> | null)?.verified),
        },
      },
    };
  });

  // POST /orgs
  app.post("/orgs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as {
      name: string;
      type: string;
      gstin?: string;
      pan?: string;
      billingAddress: Record<string, unknown>;
    };

    if (!body?.name?.trim()) {
      return reply.code(400).send({ error: "An organisation name is required" });
    }

    // This endpoint writes the caller's role, so it has to care who the caller
    // already is. It used to elevate anyone to ORG_OWNER unconditionally, which
    // let a deliberately read-only CLIENT_VIEWER escape its restriction, let any
    // client self-assign the role that POST /orgs/:id/members trusts, and
    // silently moved the caller out of whatever org they already belonged to.
    //
    // Provisioning an org for yourself is only meaningful when you have none.
    // Moving between orgs is a staff action, not a self-service one.
    const caller = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { orgId: true, role: true },
    });
    if (!caller) return reply.code(401).send({ error: "Authentication required" });

    const isStaff = isInternalRole(caller.role);
    if (caller.orgId && !isStaff) {
      return reply.code(409).send({
        error: "This account already belongs to an organisation.",
      });
    }

    // TODO: validate GSTIN via GSTN API
    const org = await prisma.org.create({
      data: {
        id: ids.orgId(),
        name: body.name.trim(),
        type: body.type,
        gstin: body.gstin,
        pan: body.pan,
        billingAddress: toJson(body.billingAddress ?? {}),
      },
    });

    // Staff create orgs on behalf of clients — they keep their own role and org.
    if (!isStaff) {
      await prisma.user.update({
        where: { id: req.user!.sub },
        data: { orgId: org.id, role: "ORG_OWNER" },
      });
    }

    return org;
  });

  // PATCH /orgs/:id
  app.patch("/orgs/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };

    const caller = req.user!;
    const isOwnOrgManager = caller.orgId === id && ORG_MANAGER_ROLES.includes(caller.role);
    if (!isInternalRole(caller.role) && !isOwnOrgManager) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }

    const body = req.body as Partial<{
      name: string;
      gstin: string;
      pan: string;
      billingAddress: Record<string, unknown>;
    }>;

    const org = await prisma.org.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.gstin !== undefined && { gstin: body.gstin }),
        ...(body.pan !== undefined && { pan: body.pan }),
        ...(body.billingAddress !== undefined && {
          billingAddress: toJson(body.billingAddress),
        }),
      },
    });
    return org;
  });

  // POST /orgs/:id/members
  app.post("/orgs/:id/members", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };

    const caller = req.user!;
    const isOwnOrgManager = caller.orgId === id && ORG_MANAGER_ROLES.includes(caller.role);
    if (!isInternalRole(caller.role) && !isOwnOrgManager) {
      return reply.code(403).send({ error: "Insufficient permissions" });
    }

    const { email, role } = req.body as { email: string; role: string };
    if (!email?.includes("@")) {
      return reply.code(400).send({ error: "A valid email address is required" });
    }

    // A client-side org manager may only assign client-side roles within their
    // own org — never grant staff/admin access. Staff callers may assign any
    // known role (including internal ones, e.g. staffing an internal org).
    const roleIsKnown = ASSIGNABLE_MEMBER_ROLES.includes(role) || isInternalRole(role);
    const roleIsAllowedForCaller = isInternalRole(caller.role) || ASSIGNABLE_MEMBER_ROLES.includes(role);
    if (!roleIsKnown || !roleIsAllowedForCaller) {
      return reply.code(400).send({ error: `Unknown or unassignable role. Valid roles: ${ASSIGNABLE_MEMBER_ROLES.join(", ")}` });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // The role check above stops a client manager granting staff access. It
      // did NOT stop them pointing this at an account that already belongs to
      // somebody else: the row was simply moved into the caller's org and
      // re-roled. Posting admin@stackfox.tech with role CLIENT_VIEWER demoted
      // the platform administrator into the attacker's tenant.
      //
      // An account is claimable only when it is unclaimed: no other org, no
      // internal role, and no credential of its own.
      const callerIsStaff = isInternalRole(caller.role);
      const authData = (user.authData as Record<string, unknown> | null) ?? {};
      const hasOwnCredential =
        Boolean(authData.passwordHash) || Boolean(authData.googleId);

      if (!callerIsStaff) {
        if (user.orgId && user.orgId !== id) {
          return reply.code(409).send({
            error: "That email already belongs to another organisation.",
          });
        }
        if (isInternalRole(user.role)) {
          return reply.code(403).send({
            error: "That email belongs to a StackFox staff account.",
          });
        }
        if (hasOwnCredential && user.orgId !== id) {
          return reply.code(409).send({
            error:
              "That email already has a StackFox account. Ask them to accept an invitation instead.",
          });
        }
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: { orgId: id, role },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: email.split("@")[0],
          email,
          role,
          orgId: id,
        },
      });
    }

    return user;
  });
}

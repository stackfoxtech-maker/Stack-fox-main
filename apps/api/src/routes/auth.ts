import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { redis } from "../lib/redis";
import { signToken, signRefreshToken, requireAuth, verifyToken } from "../plugins/auth";
import { randomInt } from "crypto";
import * as ids from "../lib/id";
import { hashPassword, verifyPassword, needsRehash, generateToken, hashToken } from "../lib/password";
import { ensurePersonalOrg } from "../lib/scope";
import { toJson } from "../lib/json";
import { isInternalRole } from "@stackfox/core";
import { sendMail, isMailConfigured, passwordResetEmail, verifyEmailMessage } from "../lib/mailer";
import { authorizeUrl, exchangeCode, isGoogleConfigured } from "../lib/googleOAuth";
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
  const payload = { sub: user.id, email: user.email, role: user.role, orgId };
  const accessToken = signToken(payload);
  const refreshToken = signRefreshToken(payload);
  try { await redis.set(`refresh:${user.id}`, refreshToken, "EX", 2592000); } catch {}
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
    try { await redis.set(`verify:${hash}`, user.id, "EX", 86400); } catch {}
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
      decoded = verifyToken(presented) as unknown as { sub: string };
    } catch {
      return reply.code(401).send({ message: "Invalid token" });
    }

    // The signature alone is not enough: a refresh token must still be the one
    // on record, so logout and password changes actually revoke sessions.
    let onRecord: string | null = null;
    try { onRecord = await redis.get(`refresh:${decoded.sub}`); } catch {
      return reply.code(503).send({ message: "Session store unavailable" });
    }
    if (!onRecord || onRecord !== presented) {
      return reply.code(401).send({ message: "Session expired, please sign in again" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) return reply.code(401).send({ message: "User not found" });

    const payload = { sub: user.id, email: user.email, role: user.role, orgId: user.orgId ?? undefined };
    // Rotate on every use so a leaked token has a single-use lifetime.
    const refreshToken = signRefreshToken(payload);
    try { await redis.set(`refresh:${user.id}`, refreshToken, "EX", 2592000); } catch {}

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
  app.post("/auth/reset-password", async (req, reply) => {
    const { token, password } = req.body as { token: string; password: string };
    if (!token || !password) return reply.code(400).send({ message: "Token and password required" });
    if (password.length < 8) {
      return reply.code(400).send({ message: "Password must be at least 8 characters" });
    }

    const key = `reset:${hashToken(token)}`;
    let userId: string | null = null;
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

    // Burn the token and drop every existing session.
    try {
      await redis.del(key);
      await redis.del(`refresh:${userId}`);
    } catch {}

    return { success: true, message: "Password reset" };
  });

  // POST /auth/verify-email
  app.post("/auth/verify-email", async (req, reply) => {
    const { token } = req.body as { token: string };
    if (!token) return reply.code(400).send({ message: "Token required" });

    const key = `verify:${hashToken(token)}`;
    let userId: string | null = null;
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
    try { await redis.del(key); } catch {}

    return { success: true, message: "Email verified" };
  });

  // POST /auth/otp/send
  app.post(
    "/auth/otp/send",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { email, phone } = req.body as { email?: string; phone?: string };
    if (!email && !phone) return reply.code(400).send({ error: "email or phone required" });

    const otp = String(randomInt(100000, 999999));
    const key = `otp:${email ?? phone}`;
    try { await redis.set(key, otp, "EX", 300); } catch {} // 5 min TTL

    // TODO: send OTP via email (Resend) or SMS/WhatsApp
    if (process.env.NODE_ENV === "development") {
      app.log.info(`OTP for ${email ?? phone}: ${otp}`);
    }

    return { success: true, message: "OTP sent" };
  });

  // POST /auth/otp/verify
  app.post("/auth/otp/verify", async (req, reply) => {
    const { email, phone, code } = req.body as {
      email?: string;
      phone?: string;
      code: string;
    };
    const identifier = email ?? phone;
    if (!identifier) return reply.code(400).send({ error: "email or phone required" });

    let stored: string | null = null;
    try { stored = await redis.get(`otp:${identifier}`); } catch {}
    if (!stored || stored !== code) {
      return reply.code(401).send({ error: "Invalid or expired OTP" });
    }

    try { await redis.del(`otp:${identifier}`); } catch {}

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

    let redirectTo: string | null = null;
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
  app.post("/auth/whatsapp/callback", async (req, reply) => {
    const { phone, code } = req.body as { phone: string; code: string };
    let stored: string | null = null;
    try { stored = await redis.get(`otp:${phone}`); } catch {}
    if (!stored || stored !== code) {
      return reply.code(401).send({ error: "Invalid OTP" });
    }
    try { await redis.del(`otp:${phone}`); } catch {}

    let user = await prisma.user.findFirst({ where: { phone } });
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
        await redis.set(`blacklist:${token}`, "1", "EX", 86400);
        // Without this the 30-day refresh token survives logout and can mint
        // fresh access tokens indefinitely.
        const decoded = verifyToken(token);
        await redis.del(`refresh:${decoded.sub}`);
      } catch {}
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

    // TODO: validate GSTIN via GSTN API
    const org = await prisma.org.create({
      data: {
        id: ids.orgId(),
        name: body.name,
        type: body.type,
        gstin: body.gstin,
        pan: body.pan,
        billingAddress: toJson(body.billingAddress),
      },
    });

    await prisma.user.update({
      where: { id: req.user!.sub },
      data: { orgId: org.id, role: "ORG_OWNER" },
    });

    return org;
  });

  // PATCH /orgs/:id
  app.patch("/orgs/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
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
    const { email, role } = req.body as { email: string; role: string };

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
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

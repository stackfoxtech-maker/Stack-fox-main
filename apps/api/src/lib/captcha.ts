import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * reCAPTCHA v2 gate for unauthenticated, abusable POSTs (register, login,
 * password reset, free tools). The client sends the widget response in the
 * `x-captcha-token` header, so the strict body schemas stay untouched.
 *
 * Unset RECAPTCHA_SECRET_KEY disables the check — local dev, tests and CI keep
 * working. In production that is logged loudly instead of failing the request.
 */
let warned = false;

export async function requireCaptcha(req: FastifyRequest, reply: FastifyReply) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production" && !warned) {
      warned = true;
      req.log.error("RECAPTCHA_SECRET_KEY is not set — captcha checks are disabled");
    }
    return;
  }

  const token = req.headers["x-captcha-token"];
  if (typeof token !== "string" || !token) {
    return reply.code(400).send({ message: "Please complete the captcha." });
  }

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(5000),
    });
    const out = (await res.json()) as { success?: boolean };
    if (out.success) return;
  } catch (err) {
    // Fail closed: a Google outage should not open the door to bots.
    req.log.error(err, "reCAPTCHA verification request failed");
    return reply.code(503).send({ message: "Captcha check unavailable, try again." });
  }
  return reply.code(400).send({ message: "Captcha verification failed. Try again." });
}

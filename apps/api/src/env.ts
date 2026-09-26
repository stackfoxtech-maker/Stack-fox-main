// Must be the first import in server.ts (and nothing else before it in that
// file) — esbuild/tsx hoists all `import` statements above interspersed code,
// so a bare `config()` call interleaved between imports in server.ts runs
// AFTER every transitively-imported module has already evaluated, silently
// leaving their module-level `process.env.X` reads undefined. Import order
// between import statements themselves is preserved, so putting the dotenv
// load in its own module and importing it first guarantees it runs first.
import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Tests supply an isolated environment; never refill blank external credentials
// from a developer's production-capable .env.
if (process.env.NODE_ENV !== "test")
  config({ path: resolve(__dirname, "../../../.env") });

/**
 * Boot-time environment validation.
 *
 * This module previously loaded dotenv and stopped there. Nothing asserted that
 * a required variable existed, so a missing value surfaced as a runtime 503 on
 * whichever route happened to need it — or, for JWT_SECRET, as tokens silently
 * signed with the public string "dev-secret-change-me" outside production.
 *
 * JWT_SECRET was also entirely absent from .env.example, so anyone provisioning
 * an environment from that file omitted the most security-critical variable in
 * the system without being told.
 *
 * Optional variables are listed here too, with a note on what stops working
 * when they are unset. Fail loudly at boot; never half-work.
 */

/**
 * An unset variable and one set to the empty string mean the same thing here.
 *
 * .env.example ships several keys as `NAME=""` so the shape is discoverable,
 * and dotenv loads those as empty strings rather than leaving them absent. A
 * format check on an optional value therefore fires on a variable nobody set —
 * `SENTRY_DSN=""` made the whole API refuse to boot with "Invalid url", which
 * is a validator punishing someone for following the template.
 *
 * Blank means absent. A value that IS set still has to be valid.
 */
const blankAsAbsent = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), inner);

const schema = z.object({
  // ── Required everywhere ───────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "Postgres connection string"),

  // ── Required in production, defaulted elsewhere ───────────────────────────
  // plugins/auth.ts throws in production without this; outside production it
  // falls back to a public dev secret. Warn so that is a deliberate choice.
  JWT_SECRET: blankAsAbsent(z.string().min(32).optional()),
  NEXTAUTH_SECRET: blankAsAbsent(z.string().min(32).optional()),

  // ── Degrade gracefully when absent ────────────────────────────────────────
  REDIS_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  CREDENTIAL_ENCRYPTION_KEY: blankAsAbsent(z.string().length(64).optional()),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Unset means error reporting is off and a 500 is visible only in the logs.
  // Deliberately not required in production: the app must still boot without
  // it, and /health reports whether it is actually on.
  SENTRY_DSN: blankAsAbsent(z.string().url().optional()),
  LOG_LEVEL: blankAsAbsent(
    z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
  ),

  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  HOST: z.string().optional(),
});

/**
 * Connection pooling, and one footgun worth catching at boot.
 *
 * Supabase's pooler (port 6543) is pgbouncer in transaction mode, which does
 * not support prepared statements. Prisma uses them by default, so a pooled
 * URL without `?pgbouncer=true` fails intermittently and confusingly — it
 * works under light load and starts erroring once connections get reused.
 *
 * Prisma's default connection_limit is num_cpus * 2 + 1, which on a shared
 * Railway container is a handful of connections; behind a pooler the limit
 * that matters is the pooler's, so an explicit small value avoids holding more
 * server-side connections than the plan allows.
 */
function checkPoolingConfig(url: string | undefined): void {
  if (!url) return;
  const pooled = url.includes("pooler.") || url.includes(":6543");
  if (pooled && !url.includes("pgbouncer=true")) {
    console.warn(
      [
        "",
        "  DATABASE_URL points at a connection pooler but does not set pgbouncer=true.",
        "  Prisma will use prepared statements, which pgbouncer's transaction mode",
        "  does not support — expect intermittent failures under load rather than a",
        "  clean error at boot.",
        "",
      ].join("\n"),
    );
  }
  if (pooled && !/connection_limit=/.test(url)) {
    console.warn(
      [
        "  DATABASE_URL has no connection_limit. Behind a pooler, set a small",
        "  explicit value (e.g. connection_limit=5) so one container cannot",
        "  exhaust the shared pool.",
        "",
      ].join("\n"),
    );
  }
}

const parsed = schema.safeParse(process.env);

checkPoolingConfig(process.env.DATABASE_URL);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
  console.error(
    [
      "",
      "  Environment is not usable:",
      "",
      ...lines,
      "",
      "  See .env.example.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const isProd = process.env.NODE_ENV === "production";

/**
 * Things that are fatal only in production. Kept separate from the schema so a
 * local checkout still boots with an empty .env.
 */
const PRODUCTION_REQUIRED: Array<[string, string]> = [
  ["JWT_SECRET", "signs and verifies every session token"],
  ["REDIS_URL", "OTP, password reset, token revocation and every background job"],
  ["SUPABASE_URL", "file storage"],
  ["SUPABASE_SECRET_KEY", "file storage"],
  ["CREDENTIAL_ENCRYPTION_KEY", "encrypts the client credential vault"],
];

if (isProd) {
  const missing = PRODUCTION_REQUIRED.filter(
    ([name]) =>
      !process.env[name] && !(name === "JWT_SECRET" && process.env.NEXTAUTH_SECRET),
  );
  if (missing.length) {
    console.error(
      [
        "",
        "  Refusing to start in production. Missing:",
        "",
        ...missing.map(([name, why]) => `  ${name} — ${why}`),
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.warn(
    "[env] JWT_SECRET is not set — signing tokens with the public dev fallback. " +
      "Never do this outside local development.",
  );
}

export const env = parsed.data;

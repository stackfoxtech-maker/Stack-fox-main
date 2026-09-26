#!/usr/bin/env node
/**
 * Static guard: every route must either be covered by a plugin-wide auth hook,
 * contain a recognised auth/scope check in its handler, or be listed in
 * PUBLIC below with a reason.
 *
 * Auth here is opt-in per route (the onRequest hook only *parses* a token), so a
 * new route that forgets a check is silently public. This makes that a CI
 * failure instead of a review-time hope. It does not change runtime behaviour.
 *
 * Heuristic, not a proof: it looks for a guard token anywhere between one route
 * registration and the next. A handler that calls a guard on a dead branch
 * would pass. It catches the realistic failure — forgetting entirely.
 *
 *   node scripts/check-auth-coverage.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "apps/api/src/routes");

const GUARD =
  /requireAuth|requireRole|requireApiKey|requireApiScope|clientScope|clientWriteScope|InScope|assertProjectInScope|req\.user|verifyToken|verifyTokenOfType|signature|timingSafeEqual|verifyWebhook/;
const HOOK = /app\.addHook\(\s*["'](?:preHandler|onRequest)["']/;
const ROUTE = /\bapp\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

// "METHOD /path": reason. Intentionally anonymous by product design.
const PUBLIC = {
  "GET /health": "load balancer probe",
  "POST /auth/register": "signup",
  "POST /auth/login": "login",
  "POST /auth/forgot-password": "password reset request",
  "POST /auth/reset-password": "token-gated reset",
  "GET /auth/google": "OAuth start",
  "GET /auth/google/callback": "OAuth callback",
  "POST /webhooks/whatsapp": "provider webhook",
  "POST /lead/demo": "marketing lead form",
  "POST /tools/express-checkout": "anonymous checkout by design (see N-13)",
  "POST /workspaces": "guest drafts before signup",
  "GET /tools/showcase": "marketing",
  "GET /tools/glossary": "marketing",
  "GET /tools/blueprints": "marketing",
  "GET /tools/blueprints/:id": "marketing",
  "GET /knowledge": "public published articles",
  "GET /knowledge/:id": "public published articles",
  "POST /assistant/chat": "anonymous assistant, rate-limited 10/min",
  "POST /assistant/advise": "anonymous assistant, rate-limited 10/min",
  "POST /auth/verify-email": "emailed-token gated",
  "POST /auth/otp/send": "pre-login OTP, rate-limited",
  "POST /auth/otp/verify": "pre-login OTP, attempt-limited",
  "POST /auth/whatsapp/callback": "provider callback",
  "GET /blog": "public published posts",
  "GET /blog/categories": "public",
  "GET /jobs": "public careers listing",
  "POST /jobs/:id/apply": "public application, rate-limited 5/min",
  "POST /tools/audit": "free tool",
  "POST /tools/estimate": "free tool",
  "POST /tools/brief": "free tool",
  "POST /tools/legal": "free tool",
  "POST /tools/preview": "free tool",
  "GET /tools/invoice/:id":
    "capability URL: ToolInvoice id is a random default, not a sequence",
  // Checkout session flow: ownership is enforced in a shared loader
  // (checkout.ts ~line 43), not in each handler. The whole surface is
  // unused by the client (see F-17/F-18) — delete or exercise it.
  "GET /checkout/:sid/status": "owner check in session loader; dead surface",
  "PATCH /checkout/:sid/step2": "owner check in session loader; dead surface",
  "PATCH /checkout/:sid/step3": "owner check in session loader; dead surface",
  "PATCH /checkout/:sid/step4": "owner check in session loader; dead surface",
  "PATCH /checkout/:sid/step5": "owner check in session loader; dead surface",
  "POST /checkout/:sid/pay": "owner check in session loader; dead surface",
  "POST /checkout/express": "anonymous by design; gateway-order orphan is N-13",
};
// Whole files that are public read-only browsing.
const PUBLIC_FILES = new Set(["catalogue.ts"]);

const failures = [];
let total = 0;

for (const file of readdirSync(routesDir)) {
  if (!file.endsWith(".ts") || file.endsWith("Schemas.ts")) continue;
  if (PUBLIC_FILES.has(file)) continue;
  const src = readFileSync(join(routesDir, file), "utf8");
  const hookGuarded =
    HOOK.test(src) && GUARD.test(src.slice(src.search(HOOK), src.search(HOOK) + 400));
  const matches = [...src.matchAll(ROUTE)];

  matches.forEach((m, i) => {
    total++;
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    if (hookGuarded || key in PUBLIC) return;
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    if (GUARD.test(src.slice(m.index, end))) return;
    failures.push(`${file}: ${key}`);
  });
}

if (failures.length) {
  console.error(
    `\n  ${failures.length} route(s) with no auth check, hook, or PUBLIC entry:\n` +
      failures.map((f) => `    ${f}`).join("\n") +
      `\n\n  Add requireAuth/requireRole/a scope helper, or list the route in PUBLIC\n` +
      `  in scripts/check-auth-coverage.mjs with a reason.\n`,
  );
  process.exit(1);
}
console.log(`  auth coverage: ${total} routes checked, all guarded or allowlisted`);

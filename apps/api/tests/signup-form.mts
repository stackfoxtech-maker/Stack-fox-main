/**
 * Public signup, using the payload the website's form actually sends.
 *
 * The Signup page collects a phone number as a contact detail. RegisterSchema
 * is strict and had no `phone`, so every real signup got a 400 while every API
 * suite (which registers without a phone) stayed green.
 *
 * The account is verified by email; the phone is stored UNVERIFIED. That
 * matters because phone sign-in (SMS OTP, WhatsApp) looks users up by number
 * and numbers are not unique: a phone typed at signup must never become a way
 * into that account, or anyone could register with a stranger's number and
 * receive the stranger's later phone login.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/signup-form.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { redis } from "../src/lib/redis";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { s: res.status, b: (await res.json().catch(() => null)) as any };
}
const authOf = (u: any) => (u?.authData ?? {}) as Record<string, unknown>;

// A number unique to this run, so earlier runs cannot interfere.
const victimPhone = `+9199${String(stamp).slice(-8)}`;

// ── The form's real payload ──────────────────────────────────────────────────
const squatterEmail = `signup-form-a-${stamp}@example.com`;
const a = await call("POST", "/auth/register", {
  name: "Form User",
  email: squatterEmail,
  password: "FormPass123!ok",
  phone: victimPhone,
});
check(`signup with a phone succeeds -> ${a.s}`, a.s === 200);
const squatter = await prisma.user.findUnique({ where: { email: squatterEmail } });
check("the phone is stored on the account", squatter?.phone === victimPhone);
check("...marked unverified", authOf(squatter).phoneVerified === false);
check(
  "...and the account itself is still unverified (email verifies it)",
  authOf(squatter).verified === false,
);

const b = await call("POST", "/auth/register", {
  name: "No Phone",
  email: `signup-form-b-${stamp}@example.com`,
  password: "FormPass123!ok",
});
check(`signup without a phone still succeeds -> ${b.s}`, b.s === 200);

const c = await call("POST", "/auth/register", {
  name: "Bad Phone",
  email: `signup-form-c-${stamp}@example.com`,
  password: "FormPass123!ok",
  phone: "call-me-maybe",
});
check(`a malformed phone is refused -> ${c.s}`, c.s === 400);
check(
  "the refusal names the phone field",
  JSON.stringify(c.b?.details ?? []).includes("phone"),
);

const d = await call("POST", "/auth/register", {
  name: "Mass Assign",
  email: `signup-form-d-${stamp}@example.com`,
  password: "FormPass123!ok",
  role: "ADMIN",
});
check(`an unknown field (role) is still rejected -> ${d.s}`, d.s === 400);

// ── An unverified number is not a way in ─────────────────────────────────────
// The real owner of the number signs in by phone. They must get their own
// account, not the one someone else registered with their number.
await redis.set(`otp:${victimPhone}`, "424242", "EX", 120);
const w = await call("POST", "/auth/whatsapp/callback", {
  phone: victimPhone,
  code: "424242",
});
check(`the number's owner can sign in by phone -> ${w.s}`, w.s === 200);
check(
  "...into a NEW account, not the one registered with their number",
  !!w.b?.data?.user?.id && w.b.data.user.id !== squatter?.id,
);
const owner = await prisma.user.findUnique({ where: { id: w.b?.data?.user?.id ?? "" } });
check("...whose number is marked verified", authOf(owner).phoneVerified === true);

await redis.set(`otp:${victimPhone}`, "515151", "EX", 120);
const w2 = await call("POST", "/auth/whatsapp/callback", {
  phone: victimPhone,
  code: "515151",
});
check(
  "signing in by phone again returns that same verified account",
  w2.b?.data?.user?.id === owner?.id,
);

// ── Changing the number on the profile un-verifies it ────────────────────────
const token = w2.b?.data?.accessToken as string;
const changed = await call("PUT", "/users/me", { phone: "+919000000001" }, token);
check(`a user can change their number -> ${changed.s}`, changed.s === 200);
const after = await prisma.user.findUnique({ where: { id: owner?.id ?? "" } });
check("the changed number is unverified", authOf(after).phoneVerified === false);

await prisma.user.deleteMany({
  where: {
    OR: [
      { email: { startsWith: "signup-form-" } },
      { email: `${victimPhone}@wa.stackfox.in` },
    ],
  },
});
await redis.quit();
await prisma.$disconnect();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL SIGNUP FORM CHECKS PASSED");

/**
 * Public signup, using the payload the website's form actually sends.
 *
 * Signup is email + password (or Google). The Signup page used to also require
 * a phone number and post it; RegisterSchema is strict and has no `phone`, so
 * every real signup got a 400 while every API suite (which registers with just
 * name, email, password) stayed green. The form no longer collects a phone;
 * this registers exactly as the browser now does, and pins that a phone is not
 * a way to sign up.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/signup-form.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function register(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { s: res.status, b: (await res.json().catch(() => null)) as any };
}

const formEmail = `signup-form-a-${stamp}@example.com`;
const a = await register({
  name: "Form User",
  email: formEmail,
  password: "FormPass123!ok",
});
check(`the form's payload (name, email, password) succeeds -> ${a.s}`, a.s === 200);
check("a session is issued", !!a.b?.data?.accessToken);
const row = await prisma.user.findUnique({ where: { email: formEmail } });
check("the account has no phone number", row?.phone === null);

const noName = await register({
  email: `signup-form-b-${stamp}@example.com`,
  password: "FormPass123!ok",
});
check(`the name is optional -> ${noName.s}`, noName.s === 200);

const dup = await register({ name: "Dup", email: formEmail, password: "FormPass123!ok" });
check(`a repeat email is refused -> ${dup.s}`, dup.s === 409);

const weak = await register({
  name: "Weak",
  email: `signup-form-w-${stamp}@example.com`,
  password: "short",
});
check(`a weak password is refused -> ${weak.s}`, weak.s === 400);

const phoneEmail = `signup-form-c-${stamp}@example.com`;
const withPhone = await register({
  name: "Phone",
  email: phoneEmail,
  password: "FormPass123!ok",
  phone: "+919876543210",
});
check(`a phone number is not accepted at signup -> ${withPhone.s}`, withPhone.s === 400);
check(
  "no account was created for it",
  (await prisma.user.findUnique({ where: { email: phoneEmail } })) === null,
);

const escalate = await register({
  name: "Mass Assign",
  email: `signup-form-d-${stamp}@example.com`,
  password: "FormPass123!ok",
  role: "ADMIN",
});
check(`an unknown field (role) is still rejected -> ${escalate.s}`, escalate.s === 400);

await prisma.user.deleteMany({ where: { email: { startsWith: `signup-form-` } } });
await prisma.$disconnect();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL SIGNUP FORM CHECKS PASSED");

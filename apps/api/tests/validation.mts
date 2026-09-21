/**
 * Validation on the identity, privilege and money paths.
 *
 * Schemas only — no HTTP, no database. `parseBody` is already covered by the
 * routes that use it; what matters here is whether the schemas accept and
 * reject the right things, which is a property of the schema alone.
 *
 *   pnpm --filter @stackfox/api test:validation
 */
import "../src/env";
import { billingAddress, gstin, pan, password } from "../src/lib/validate";
import {
  AddOrgMemberSchema,
  CreateOrgSchema,
  LoginSchema,
  RegisterSchema,
  SendOtpSchema,
  UpdateOrgSchema,
  VerifyOtpSchema,
} from "../src/routes/authSchemas";
import {
  ChangePasswordSchema,
  CreateUserSchema,
  ListUsersQuerySchema,
  UpdateMeSchema,
  UpdateUserSchema,
} from "../src/routes/userSchemas";
import { RecordUtrSchema, UpdateInvoiceStatusSchema } from "../src/routes/financeSchemas";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") => checks.push([label, pass, note]);

const accepts = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;
const rejects = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  !schema.safeParse(v).success;

// ── The registration password hole ───────────────────────────────────────────
//
// /auth/reset-password and POST /users both required 8 characters.
// /auth/register required only that the field be present, so an account could
// be created with a one-character password and thereafter only ever improved
// by a reset. The weakest door set the policy.
{
  check(
    "registration rejects a one-character password",
    rejects(RegisterSchema, { email: "a@b.com", password: "a" }),
    "this is the hole: reset enforced 8, registration enforced nothing",
  );
  check("registration rejects 7 characters", rejects(RegisterSchema, { email: "a@b.com", password: "1234567" }));
  check("registration accepts 8", accepts(RegisterSchema, { email: "a@b.com", password: "12345678" }));
  check(
    "a 10,000-character password is rejected",
    rejects(password, "x".repeat(10_000)),
    "scrypt cost scales with input length on an unauthenticated endpoint",
  );
  check("registration rejects a malformed email", rejects(RegisterSchema, { email: "not-an-email", password: "12345678" }));
  check(
    "registration rejects an unexpected field",
    rejects(RegisterSchema, { email: "a@b.com", password: "12345678", role: "ADMIN" }),
    "silently dropping a mass-assignment attempt hides it",
  );

  // Login must NOT apply the policy: an account predating the rule has to be
  // able to sign in, and a validation error would reveal that the policy,
  // rather than the credential, was the problem.
  check(
    "login still accepts a short password",
    accepts(LoginSchema, { email: "a@b.com", password: "old" }),
    "rejecting here would lock out every pre-policy account",
  );
}

// ── The GSTIN hole ───────────────────────────────────────────────────────────
//
// lib/gst.ts: recipientStateCode() returns gstin.slice(0, 2) whenever the
// value merely STARTS with two digits, and that code chooses CGST+SGST or
// IGST on checkout, on quotes and on the rendered invoice. PATCH /orgs/:id
// wrote the field with no validation at all.
{
  check("a valid GSTIN is accepted", accepts(gstin, "27AAPFU0939F1ZV"));
  check("a valid GSTIN is accepted (Rajasthan)", accepts(gstin, "08AAPFU0939F1ZV"));
  check(
    "the exact exploit shape is rejected",
    rejects(gstin, "07whatever"),
    "starts with two digits, so recipientStateCode() would have returned 07",
  );
  check("a 14-character GSTIN is rejected", rejects(gstin, "27AAPFU0939F1Z"));
  check("a state code above 39 is rejected", rejects(gstin, "99AAPFU0939F1ZV"));
  check("a GSTIN without the fixed Z is rejected", rejects(gstin, "27AAPFU0939F1XV"));
  check(
    "lowercase is accepted and normalised",
    gstin.safeParse("27aapfu0939f1zv").success,
    "a real GSTIN typed in lowercase is a typo, not an attack",
  );
  check(
    "the org update rejects the bad GSTIN end to end",
    rejects(UpdateOrgSchema, { gstin: "07whatever" }),
    "this is the door the value came through",
  );

  check("a valid PAN is accepted", accepts(pan, "AAPFU0939F"));
  check("a PAN with the wrong shape is rejected", rejects(pan, "AAPFU09399"));
}

// ── The billing address is the GSTIN's fallback ─────────────────────────────
//
// With no GSTIN, recipientStateCode() reads stateCode and then state from
// this object to decide the same tax question. It was Record<string, unknown>
// written straight to a Json column.
{
  check("a normal address is accepted", accepts(billingAddress, { line1: "1 Road", city: "Jaipur", stateCode: "08" }));
  check("a three-digit state code is rejected", rejects(billingAddress, { stateCode: "080" }));
  check("a non-numeric state code is rejected", rejects(billingAddress, { stateCode: "RJ" }));
  check(
    "arbitrary nesting is rejected",
    rejects(billingAddress, { line1: "x", evil: { deeply: { nested: "x".repeat(1000) } } }),
    "it was written to a Json column unbounded",
  );
  check("a 10,000-character line is rejected", rejects(billingAddress, { line1: "x".repeat(10_000) }));
  check("an empty address is accepted", accepts(billingAddress, {}));
}

// ── Organisations ────────────────────────────────────────────────────────────
{
  check("creating an org requires a name", rejects(CreateOrgSchema, { type: "COMPANY" }));
  check("a whitespace-only name is rejected", rejects(CreateOrgSchema, { name: "   " }));
  check("a valid org is accepted", accepts(CreateOrgSchema, { name: "Acme", gstin: "27AAPFU0939F1ZV" }));
  check(
    "an empty PATCH is rejected",
    rejects(UpdateOrgSchema, {}),
    "it used to issue a database write and return 200, which reads as success",
  );
  check("adding a member requires a real email", rejects(AddOrgMemberSchema, { email: "nope", role: "CLIENT_VIEWER" }));
}

// ── OTP ──────────────────────────────────────────────────────────────────────
{
  check("sending an OTP with neither email nor phone is rejected", rejects(SendOtpSchema, {}));
  check("email only is accepted", accepts(SendOtpSchema, { email: "a@b.com" }));
  check("phone only is accepted", accepts(SendOtpSchema, { phone: "+919876543210" }));
  check("a malformed phone number is rejected", rejects(SendOtpSchema, { phone: "not a phone" }));
  check(
    "a 5,000-character phone number is rejected",
    rejects(SendOtpSchema, { phone: `+${"9".repeat(5000)}` }),
    "it reaches an outbound API call and a log line",
  );
  check("a non-numeric OTP code is rejected", rejects(VerifyOtpSchema, { email: "a@b.com", code: "abcdef" }));
  check("a numeric code is accepted", accepts(VerifyOtpSchema, { email: "a@b.com", code: "123456" }));
}

// ── Privilege ────────────────────────────────────────────────────────────────
{
  check("an empty role update is rejected", rejects(UpdateUserSchema, {}));
  check("a role update is accepted", accepts(UpdateUserSchema, { role: "PM" }));
  check("deactivation is accepted", accepts(UpdateUserSchema, { isActive: false }));
  check(
    "isActive must be a boolean, not a string",
    rejects(UpdateUserSchema, { isActive: "false" }),
    'the string "false" is truthy, so this would have activated rather than deactivated',
  );
  check(
    "a user cannot set their own role via /users/me",
    rejects(UpdateMeSchema, { name: "x", role: "ADMIN" }),
    "the allowlist is now the schema's shape",
  );
  check(
    "a user cannot set their own orgId via /users/me",
    rejects(UpdateMeSchema, { orgId: "org_someone_else" }),
  );
  check("a normal profile update is accepted", accepts(UpdateMeSchema, { name: "Alok", skills: ["Go"] }));
  check("an empty profile update is rejected", rejects(UpdateMeSchema, {}));
  check("41 skills are rejected", rejects(UpdateMeSchema, { skills: Array(41).fill("x") }));
  check("40 skills are accepted", accepts(UpdateMeSchema, { skills: Array(40).fill("x") }));
  check("an unbounded name is rejected", rejects(UpdateMeSchema, { name: "x".repeat(10_000) }));
  check("a non-URL avatar is rejected", rejects(UpdateMeSchema, { avatarUrl: "javascript:alert(1)" }));
  check("clearing the avatar is accepted", accepts(UpdateMeSchema, { avatarUrl: "" }));

  check("creating a user requires a strong password", rejects(CreateUserSchema, { name: "A", email: "a@b.com", password: "short" }));
  check(
    "a password change to the same value is rejected",
    rejects(ChangePasswordSchema, { currentPassword: "samepassword", newPassword: "samepassword" }),
  );
  check(
    "a genuine password change is accepted",
    accepts(ChangePasswordSchema, { currentPassword: "oldpassword", newPassword: "newpassword" }),
  );

  check(
    "an unbounded search term is rejected",
    rejects(ListUsersQuerySchema, { search: "x".repeat(5000) }),
    "it goes straight into a Prisma contains",
  );
  check("a stray query parameter is tolerated", accepts(ListUsersQuerySchema, { search: "alok", utm_source: "x" }));
}

// ── Money ────────────────────────────────────────────────────────────────────
{
  check("a normal UTR is accepted", accepts(RecordUtrSchema, { utr: "AXISN12345678" }));
  check("a UTR with spaces is rejected", rejects(RecordUtrSchema, { utr: "AXIS 123 456" }));
  check("a missing UTR is rejected", rejects(RecordUtrSchema, {}));
  check(
    "an unbounded UTR is rejected",
    rejects(RecordUtrSchema, { utr: "A".repeat(5000) }),
    "the UTR becomes the Payment row's idempotency key",
  );
  check(
    "an unparseable paidAt is rejected",
    rejects(RecordUtrSchema, { utr: "AXISN12345678", paidAt: "last tuesday" }),
    "new Date() of this is an Invalid Date, which Prisma rejected as a 500",
  );
  check(
    "an ISO paidAt is accepted",
    accepts(RecordUtrSchema, { utr: "AXISN12345678", paidAt: "2026-09-21T10:00:00Z" }),
  );
  check("a plain date is accepted", accepts(RecordUtrSchema, { utr: "AXISN12345678", paidAt: "2026-09-21" }));
  check("a negative amount is rejected", rejects(RecordUtrSchema, { utr: "AXISN12345678", amount: -500 }));
  check(
    "a fractional amount is rejected",
    rejects(RecordUtrSchema, { utr: "AXISN12345678", amount: 100.5 }),
    "money is integer paise everywhere",
  );
  check("a whole-paise amount is accepted", accepts(RecordUtrSchema, { utr: "AXISN12345678", amount: 50000 }));
  check("a status is required", rejects(UpdateInvoiceStatusSchema, {}));
  check("a status is accepted", accepts(UpdateInvoiceStatusSchema, { status: "partially-paid" }));
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- VALIDATION ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL VALIDATION CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);

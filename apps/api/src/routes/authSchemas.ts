import { z } from "zod";
import {
  billingAddress,
  email,
  gstin,
  pan,
  password,
  strictObject,
} from "../lib/validate";

/**
 * Schemas for the identity routes.
 *
 * These are the endpoints an unauthenticated caller can reach, which makes
 * them the ones where "the body is whatever the client sent" costs most. Two
 * things this closes that were not merely theoretical:
 *
 *   /auth/register accepted any password. `/auth/reset-password` and
 *   `POST /users` both required 8 characters; registration required only that
 *   the field be present, so an account could be created with a
 *   one-character password. The weakest door set the policy.
 *
 *   PATCH /orgs/:id accepted any `gstin`. lib/gst.ts reads its first two
 *   characters as the place-of-supply State code, which decides CGST+SGST vs
 *   IGST on checkout, on quotes and on the rendered invoice — so a client
 *   could change the tax treatment of their own invoices by typing a number.
 *
 * Every schema is `.strict()`: an unexpected field is a client bug or an
 * attempt at mass assignment, and silently dropping it hides both.
 */

/**
 * A phone number in E.164-ish form. MSG91 both sends and verifies the code,
 * so this is not the authority on whether a number exists — it is here to
 * stop unbounded input reaching an outbound API call and a log line.
 */
export const phone = z
  .string()
  .trim()
  .regex(
    /^\+?[1-9]\d{7,14}$/,
    "Enter a phone number in international format, e.g. +919876543210",
  );

/** A single-use token from a reset or verification link. */
const linkToken = z.string().trim().min(16).max(256);

export const RegisterSchema = strictObject({
  // Optional: the handler falls back to the local part of the email.
  name: z.string().trim().min(1).max(200).optional(),
  email,
  password,
  // A contact number. Stored unverified: the account itself is verified by
  // email, and a phone only becomes a way to sign in once a code proves it.
  phone: phone.optional(),
});

/**
 * Login deliberately does NOT apply the password policy. A user whose account
 * predates the rule must still be able to sign in — and rejecting a short
 * password at login with a validation error would tell an attacker that the
 * policy, not the credential, was the problem. Only the length ceiling
 * applies, and that is a scrypt cost guard rather than a rule about strength.
 */
export const LoginSchema = strictObject({
  email,
  password: z.string().min(1).max(200),
});

export const RefreshTokenSchema = strictObject({
  refreshToken: z.string().min(1).max(4096).optional(),
});

export const ForgotPasswordSchema = strictObject({ email });

export const ResetPasswordSchema = strictObject({
  token: linkToken,
  password,
});

export const VerifyEmailSchema = strictObject({ token: linkToken });

/**
 * One of email or phone, never neither. `.refine` rather than a union so the
 * error names the actual problem instead of reporting both branches.
 */
export const SendOtpSchema = strictObject({
  email: email.optional(),
  phone: phone.optional(),
}).refine((b) => Boolean(b.email ?? b.phone), {
  message: "Provide either an email address or a phone number",
});

/** Six digits. Bounding it keeps a long string out of the comparison path. */
const otpCode = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Enter the numeric code from your message");

export const VerifyOtpSchema = strictObject({
  email: email.optional(),
  phone: phone.optional(),
  code: otpCode,
}).refine((b) => Boolean(b.email ?? b.phone), {
  message: "Provide either an email address or a phone number",
});

export const VerifyPhoneOtpSchema = strictObject({
  phone,
  code: otpCode,
});

// ── Organisations ───────────────────────────────────────────────────────────

export const CreateOrgSchema = strictObject({
  name: z.string().trim().min(1, "An organisation name is required").max(200),
  // Free text today; the handler does not branch on it.
  type: z.string().trim().max(50).optional(),
  gstin: gstin.optional(),
  pan: pan.optional(),
  billingAddress: billingAddress.optional(),
});

/**
 * Every field optional, but at least one present — a PATCH with an empty body
 * is a no-op that currently issues a database write and returns 200, which
 * reads as success.
 */
export const UpdateOrgSchema = strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  gstin: gstin.optional(),
  pan: pan.optional(),
  billingAddress: billingAddress.optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "Provide at least one field to update",
});

/**
 * The role is checked against the caller's own authority in the handler —
 * a client-side manager may not grant staff access. That check stays there
 * because it depends on the caller; this only bounds the input.
 */
export const AddOrgMemberSchema = strictObject({
  email,
  role: z.string().trim().min(1).max(50),
});

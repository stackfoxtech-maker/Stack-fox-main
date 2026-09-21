import type { FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodTypeAny } from "zod";

/**
 * Request validation.
 *
 * `zod` was a declared dependency with zero imports anywhere, and there were no
 * Fastify JSON schemas either — 281 route handlers, nothing validating input.
 * Bodies were cast with `as any` and, in the admin routes, spread straight into
 * Prisma. That absence is the structural reason several other findings existed:
 * an unvalidated `orgId`, an unvalidated webhook `url`, unvalidated pagination.
 *
 * Usage keeps the existing handler style — no framework, no decorators:
 *
 *   const body = parseBody(req, reply, CreateServiceSchema);
 *   if (!body) return;                  // 400 already sent
 *
 * The parsed value is typed, so the `as any` cast disappears with it.
 */

/** Field-level detail, so a caller can fix the request rather than guess. */
function formatIssues(err: z.ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
}

/**
 * Validates `req.body`. Returns the parsed value, or `undefined` after sending
 * a 400 — the same `if (!x) return;` shape the scope helpers already use, so
 * it reads consistently with the rest of the codebase.
 */
export function parseBody<T extends ZodTypeAny>(
  req: FastifyRequest,
  reply: FastifyReply,
  schema: T,
): z.infer<T> | undefined {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    reply.code(400).send({
      error: "Invalid request body",
      details: formatIssues(result.error),
    });
    return undefined;
  }
  return result.data;
}

/** Same contract, for query strings. Values arrive as strings — coerce in the schema. */
export function parseQuery<T extends ZodTypeAny>(
  req: FastifyRequest,
  reply: FastifyReply,
  schema: T,
): z.infer<T> | undefined {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
    reply.code(400).send({
      error: "Invalid query parameters",
      details: formatIssues(result.error),
    });
    return undefined;
  }
  return result.data;
}

// ── Shared primitives ───────────────────────────────────────────────────────

/** Money is integer paise everywhere. Never a float, never negative. */
export const paise = z.number().int().nonnegative();

/** Business ids are human-readable strings (EST-2026-09-0001), not UUIDs. */
export const businessId = z.string().min(1).max(64);

export const email = z.string().email().max(320);

/**
 * `.strict()` on every write schema is deliberate: an unexpected field is a
 * client bug or an attempt at mass assignment, and silently dropping it hides
 * both. Rejecting it surfaces the mismatch while the sender can still act.
 */
export const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

/**
 * A password at registration.
 *
 * `/auth/reset-password` and `POST /users` both enforced 8 characters;
 * `/auth/register` enforced nothing at all, so an account could be created
 * with a one-character password and then only ever *improved* by a reset. The
 * weakest door decided the policy.
 *
 * The maximum is not a strength rule. scrypt cost scales with input length, so
 * an unbounded password is a cheap way to make the server do expensive work on
 * an unauthenticated endpoint.
 */
export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "Passwords are limited to 200 characters");

/**
 * A GSTIN, and this one decides tax.
 *
 * `lib/gst.ts` reads the first two characters as the place-of-supply State
 * code: `recipientStateCode()` returns `gstin.slice(0, 2)` whenever the value
 * merely *starts* with two digits. That code chooses CGST+SGST or IGST on
 * checkout, on quotes and on the rendered invoice.
 *
 * The value was written by `PATCH /orgs/:id` with no validation whatsoever, so
 * a client could set "07whatever" on their own organisation and change the tax
 * treatment of their own invoices. Format is enforced here, at the only door
 * it comes through.
 *
 * 15 characters: 2 State code, 10 PAN, 1 entity number, 1 "Z", 1 checksum.
 */
export const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    "Not a valid GSTIN — expected 15 characters, e.g. 27AAPFU0939F1ZV",
  );

/** 10 characters: 5 letters, 4 digits, 1 letter. */
export const pan = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Not a valid PAN — expected 10 characters, e.g. AAPFU0939F");

/**
 * A billing address, which is the GSTIN's fallback: when there is no GSTIN,
 * `recipientStateCode()` reads `stateCode` and then `state` from this object
 * to decide the same tax question.
 *
 * It was typed `Record<string, unknown>` and written straight to a Json
 * column, so it accepted arbitrary nesting of arbitrary size — a storage and
 * response-size problem as much as a correctness one. Bounded and named.
 */
export const billingAddress = z
  .object({
    line1: z.string().trim().max(200).optional(),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    stateCode: z
      .string()
      .trim()
      .regex(/^[0-3][0-9]$/, "State code must be two digits, e.g. 27")
      .optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .strict();

/**
 * A URL that is safe to put in an href or src.
 *
 * `z.string().url()` is not that check: `javascript:alert(1)` is a perfectly
 * valid URL by WHATWG parsing and passes it. Stored on a profile and rendered
 * into a link, that is XSS — so the scheme has to be named explicitly.
 *
 * This is deliberately NOT lib/safeUrl.ts. That one resolves DNS and rejects
 * private address space because it guards outbound fetches (SSRF); a stored
 * avatar URL is never fetched by the server, so paying for a DNS lookup at
 * validation time would be the wrong trade.
 */
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => {
      try {
        const { protocol } = new URL(v);
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter an http(s) URL" },
  );

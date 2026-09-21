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

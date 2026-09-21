import { Prisma } from "@stackfox/prisma";

/**
 * Prisma's Json input type is `InputJsonValue`, which is structurally
 * incompatible with the `Record<string, unknown>` / typed-interface shapes our
 * route handlers naturally produce (TS cannot prove an `unknown` value is
 * JSON-serialisable). Every Json column write therefore needs a narrowing cast.
 *
 * Centralising it here keeps the cast auditable in one place instead of
 * scattering `as any` across 20 route files.
 */
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** Same as `toJson`, but maps null/undefined to Prisma's JsonNull sentinel. */
export function toJsonOrNull<T>(
  value: T | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value;
}

/**
 * Stringify a value read out of a JSON column, without the `[object Object]`
 * trap.
 *
 * Prisma Json fields arrive as `unknown`, and eight sites called `String(v)`
 * on one. Where the result is then pattern-matched (a GST state code, a
 * filename) an object silently becomes the literal text "[object Object]" and
 * fails the match — harmless. Where it is used as a key it is not: the Google
 * id_token path derived `googleId` this way, so two malformed tokens would
 * have produced the same account identifier.
 *
 * Objects and arrays return "", which every caller already treats as absent.
 */
export function asString(value: unknown): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    default:
      return "";
  }
}

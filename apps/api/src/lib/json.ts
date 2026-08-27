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
  return value as unknown as Prisma.InputJsonValue;
}

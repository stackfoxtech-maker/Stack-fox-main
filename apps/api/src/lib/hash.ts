import { createHash, createHmac } from "crypto";

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function canonicalHash(canvas: unknown[]): string {
  const sorted = [...canvas].sort((a: any, b: any) =>
    (a.serviceId ?? "").localeCompare(b.serviceId ?? ""),
  );
  return sha256(JSON.stringify(sorted));
}

/**
 * Drift fingerprint for everything an estimate was priced from.
 *
 * This exists because the two sides of the G-039 drift guard were hashing
 * different things: routes/estimates.ts stored
 * `sha256(JSON.stringify({ canvas, customLines, timelineMult }))` while
 * routes/checkout.ts compared against `canonicalHash(workspace.canvas)`. Those
 * can never be equal, so POST /checkout/start answered HASH_DRIFT for every
 * estimate ever generated and the whole /checkout/:sid flow was unreachable.
 *
 * Both sides now call this. The canvas is order-insensitive — reordering the
 * cart is not drift — but custom lines and the timeline multiplier are included
 * because both move the price.
 */
export function estimateInputHash(input: {
  canvas: unknown[];
  customLines: unknown[];
  timelineMult: unknown;
}): string {
  const canvas = [...input.canvas].sort((a: any, b: any) =>
    (a.serviceId ?? "").localeCompare(b.serviceId ?? ""),
  );
  const customLines = [...input.customLines].sort((a: any, b: any) =>
    String(a?.id ?? "").localeCompare(String(b?.id ?? "")),
  );
  return sha256(
    JSON.stringify({ canvas, customLines, timelineMult: String(input.timelineMult) }),
  );
}

export function hmacSign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

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

export function hmacSign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

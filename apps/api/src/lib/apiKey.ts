import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@stackfox/prisma";

/**
 * API key issuance and verification.
 *
 * `requireApiKey` used to read the `x-api-key` header, check it was non-empty,
 * and return true. It never looked the value up. That left 13 `/v1` endpoints
 * serving every org's engagements, invoices, projects, tickets and events to
 * anyone who sent any string at all — and `orgId` was a *query parameter*, so
 * the caller chose whose data to read. The routes were unregistered in Phase 0
 * rather than shipped in that state; this is what re-enables them.
 *
 * ── Why SHA-256 and not scrypt ──────────────────────────────────────────────
 *
 * Passwords need a slow KDF because they are low-entropy and guessable. An API
 * key here is 32 bytes from the CSPRNG — 256 bits — so brute force is not the
 * threat model and a work factor buys nothing. It would cost something real:
 * this runs on every single `/v1` request, and a deliberately slow hash on a
 * hot path is a self-inflicted denial of service.
 *
 * What SHA-256 does give is a lookup that cannot leak the key through timing:
 * the presented value is hashed first, and the result is matched against a
 * unique index. The database never sees, and never stores, the key itself.
 */

/** 32 bytes of CSPRNG, base64url, with a prefix that says what it is. */
const KEY_BYTES = 32;

export const SCOPES = ["read", "write"] as const;
export type ApiScope = (typeof SCOPES)[number];

export type ApiKeyIdentity = {
  id: string;
  orgId: string;
  scopes: string[];
};

/**
 * The displayable prefix, stored alongside the hash.
 *
 * Someone with five keys needs to tell them apart in a list, and the only
 * thing we can show is what we did not throw away. The random tail is *not*
 * recoverable, so this is an identifier, not a partial secret.
 */
export function keyPrefix(key: string): string {
  return key.slice(0, 16);
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Mints a key. The plaintext is returned exactly once — nothing stores it, so
 * a lost key is reissued rather than recovered.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `sk_live_${randomBytes(KEY_BYTES).toString("base64url")}`;
  return { key, hash: hashApiKey(key), prefix: keyPrefix(key) };
}

/** Rejects anything that is not shaped like one of our keys, before any I/O. */
function looksLikeKey(value: unknown): value is string {
  return (
    typeof value === "string" && /^sk_live_[A-Za-z0-9_-]{20,128}$/.test(value.trim())
  );
}

export type VerifyResult =
  | { ok: true; identity: ApiKeyIdentity }
  | { ok: false; reason: "missing" | "malformed" | "unknown" | "revoked" };

/**
 * Resolves a presented key to the org it belongs to.
 *
 * Returns a reason rather than a boolean so the caller can log why a request
 * was refused while still answering the client with one undifferentiated 401 —
 * telling an attacker that a key is real but revoked is free information.
 */
export async function verifyApiKey(presented: unknown): Promise<VerifyResult> {
  if (presented === undefined || presented === null || presented === "") {
    return { ok: false, reason: "missing" };
  }
  if (!looksLikeKey(presented)) return { ok: false, reason: "malformed" };

  const hash = hashApiKey(presented.trim());
  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { id: true, orgId: true, scopes: true, keyHash: true, revokedAt: true },
  });

  if (!record) return { ok: false, reason: "unknown" };

  // The lookup above already matched on a unique index, so this is belt and
  // braces rather than the primary check — but it costs nothing and makes the
  // comparison explicit rather than implied by the query.
  const a = Buffer.from(record.keyHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, reason: "unknown" };

  if (record.revokedAt) return { ok: false, reason: "revoked" };

  return {
    ok: true,
    identity: { id: record.id, orgId: record.orgId, scopes: record.scopes },
  };
}

/**
 * Records that a key was used. Deliberately fire-and-forget: this is for the
 * key list in the UI ("last used 3 days ago"), and a write failure must not
 * fail the request it is describing.
 */
export function touchApiKey(id: string): void {
  void prisma.apiKey
    .update({ where: { id }, data: { lastUsed: new Date() } })
    .catch(() => {
      // Deliberately ignored — see above.
    });
}

export function hasScope(identity: ApiKeyIdentity, scope: ApiScope): boolean {
  return identity.scopes.includes(scope);
}

import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

/**
 * Passwords are hashed with scrypt, salted per user.
 *
 * The original implementation used a bare unsalted SHA-256, which is a plain
 * digest rather than a password KDF: it is cheap to brute-force and identical
 * passwords produced identical hashes across accounts. Stored hashes are
 * therefore versioned — `scrypt$<salt>$<hash>` for new ones — and the legacy
 * bare-hex digests are still *verified* so nobody is locked out, then silently
 * re-hashed on next successful login (see `needsRehash`).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (stored.startsWith("scrypt$")) {
    const [, saltHex, hashHex] = stored.split("$");
    if (!saltHex || !hashHex) return false;
    const derived = await scrypt(password, Buffer.from(saltHex, "hex"), KEYLEN);
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  }

  // Legacy: unsalted SHA-256 hex.
  const legacy = createHash("sha256").update(password).digest("hex");
  const a = Buffer.from(legacy, "hex");
  const b = Buffer.from(stored, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when a verified password is stored under the old scheme and should be upgraded. */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith("scrypt$");
}

/**
 * Single-use tokens for password reset and email verification. Only the hash is
 * persisted, so a leaked Redis snapshot cannot be replayed against the API.
 */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

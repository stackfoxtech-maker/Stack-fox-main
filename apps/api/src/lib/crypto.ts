import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";

/**
 * Envelope encryption for the credential vault.
 *
 * `CredentialVault.encryptedBlob` is documented in the schema as AES-256-GCM,
 * but the route was writing `Buffer.from(JSON.stringify(...))` — i.e. the
 * client's production credentials (hosting, DNS, payment gateway logins) sat in
 * the database in plaintext, readable by anyone with a DB connection or a
 * backup file.
 *
 * Layout of the stored blob:
 *
 *   [ 1 byte version | 12 byte IV | 16 byte auth tag | ciphertext ]
 *
 * The version byte lets the key or algorithm be rotated later without having to
 * guess the format of existing rows.
 */

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

/**
 * The key comes from CREDENTIAL_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Outside production a key is derived from JWT_SECRET so local dev works
 * without extra setup; in production a missing key is fatal rather than
 * silently falling back to something guessable.
 */
function key(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "hex");
    if (buf.length !== 32) {
      throw new Error(
        "CREDENTIAL_ENCRYPTION_KEY must be 32 bytes as 64 hex characters. " +
          "Generate one with: openssl rand -hex 32",
      );
    }
    cachedKey = buf;
    return cachedKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is required in production — refusing to store " +
        "client credentials under a derived development key.",
    );
  }

  cachedKey = createHash("sha256")
    .update(process.env.JWT_SECRET ?? "dev-secret-change-me")
    .digest();
  return cachedKey;
}

export function isCredentialEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSecret(blob: Buffer | Uint8Array): string {
  const buf = Buffer.from(blob);

  // Rows written before encryption existed are raw JSON. Detect and pass them
  // through so the vault keeps working, and re-encrypt on next write.
  if (buf.length === 0) return "";
  if (buf[0] !== VERSION) {
    const text = buf.toString("utf8");
    if (text.startsWith("{") || text.startsWith("[")) return text;
    throw new Error("Credential blob is in an unrecognised format");
  }

  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(1 + IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** True when the blob predates encryption and should be rewritten. */
export function isLegacyPlaintext(blob: Buffer | Uint8Array): boolean {
  const buf = Buffer.from(blob);
  return buf.length > 0 && buf[0] !== VERSION;
}

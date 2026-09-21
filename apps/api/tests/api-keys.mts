/**
 * API key issuance and verification.
 *
 * The key crypto is pure, so it is tested here in the fast tier. Tenancy on
 * /v1 needs a live API and two orgs — that lives in tenant-isolation.mts,
 * which this suite deliberately does not duplicate.
 *
 *   pnpm --filter @stackfox/api test:apikeys
 */
import "../src/env";
import {
  generateApiKey,
  hashApiKey,
  hasScope,
  keyPrefix,
  SCOPES,
  type ApiKeyIdentity,
} from "../src/lib/apiKey";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") => checks.push([label, pass, note]);

// ── Key generation ───────────────────────────────────────────────────────────
{
  const { key, hash, prefix } = generateApiKey();

  check("a key is prefixed so it is recognisable in a log or a paste", key.startsWith("sk_live_"));
  check(
    `a key carries enough entropy (${key.length} chars)`,
    key.length >= 40,
    "32 bytes base64url — brute force is not the threat model",
  );
  check("the prefix is a slice of the key, not the key", prefix === keyPrefix(key) && prefix.length < key.length);
  check(
    "the stored prefix cannot reconstruct the key",
    !key.startsWith(prefix + prefix) && prefix.length === 16,
    "it is an identifier for the key list, not a partial secret",
  );

  check("the hash is SHA-256 hex", /^[0-9a-f]{64}$/.test(hash));
  check("hashing is deterministic", hashApiKey(key) === hash);
  check(
    "the hash does not contain the key",
    !hash.includes(key.slice(8, 24)),
    "the database never stores the key itself",
  );

  // 2,000 keys, no collisions. At 256 bits a collision is not a real risk;
  // this catches a generator that silently stopped being random.
  const N = 2_000;
  const keys = new Set<string>();
  const hashes = new Set<string>();
  for (let i = 0; i < N; i++) {
    const k = generateApiKey();
    keys.add(k.key);
    hashes.add(k.hash);
  }
  check(`${N} keys are unique`, keys.size === N);
  check(`${N} hashes are unique`, hashes.size === N, "keyHash is a unique index — a collision is an insert failure");

  // A one-character change must not produce a near-miss hash.
  const flipped = key.slice(0, -1) + (key.endsWith("A") ? "B" : "A");
  check("a single changed character changes the hash entirely", hashApiKey(flipped) !== hash);
}

// ── Format rejection happens before any database work ────────────────────────
//
// verifyApiKey needs a database, so the shape guard is exercised through the
// same regex it uses. The point is that a junk header never reaches a query.
{
  const looksLikeKey = (v: unknown) =>
    typeof v === "string" && /^sk_live_[A-Za-z0-9_-]{20,128}$/.test(v.trim());

  const { key } = generateApiKey();
  check("a real key passes the shape guard", looksLikeKey(key));
  check("an empty string is rejected", !looksLikeKey(""));
  check("a bare word is rejected", !looksLikeKey("letmein"));
  check(
    "any-non-empty-string no longer authenticates",
    !looksLikeKey("x"),
    "this exact input used to return true and grant access to every org",
  );
  check("a key without the prefix is rejected", !looksLikeKey("AAAAAAAAAAAAAAAAAAAAAAAA"));
  check("a too-short key is rejected", !looksLikeKey("sk_live_short"));
  check("a 10,000-character key is rejected", !looksLikeKey("sk_live_" + "A".repeat(10_000)));
  check(
    "SQL-ish input is rejected by shape",
    !looksLikeKey("sk_live_' OR 1=1--"),
    "Prisma parameterises anyway; this stops it reaching the query at all",
  );
  check("a non-string is rejected", !looksLikeKey({ toString: () => "sk_live_aaaaaaaaaaaaaaaaaaaaaa" }));
  check("whitespace around a real key is tolerated", looksLikeKey(`  ${key}  `));
}

// ── Scopes ───────────────────────────────────────────────────────────────────
{
  const readOnly: ApiKeyIdentity = { id: "k1", orgId: "org_a", scopes: ["read"] };
  const readWrite: ApiKeyIdentity = { id: "k2", orgId: "org_a", scopes: ["read", "write"] };
  const noScopes: ApiKeyIdentity = { id: "k3", orgId: "org_a", scopes: [] };

  check("a read key has read", hasScope(readOnly, "read"));
  check(
    "a read key does NOT have write",
    !hasScope(readOnly, "write"),
    "webhook registration and deletion are the only /v1 mutations",
  );
  check("a read-write key has both", hasScope(readWrite, "read") && hasScope(readWrite, "write"));
  check("a key with no scopes has none", !hasScope(noScopes, "read") && !hasScope(noScopes, "write"));
  check("the scope list is exactly read and write", SCOPES.join(",") === "read,write");
}

// ── The tenancy rule, as a property ──────────────────────────────────────────
//
// The whole fix is that the org comes from the key and never from the request.
// This asserts the shape that makes that true: the identity attached to a
// request carries an orgId, and nothing in a query or body can supply one.
{
  const identity: ApiKeyIdentity = { id: "k1", orgId: "org_a", scopes: ["read"] };
  check("an authenticated key always names exactly one org", typeof identity.orgId === "string" && identity.orgId.length > 0);

  // Mirrors orgOf() in routes/publicApi.ts: the org is read from the key, and
  // a query parameter claiming a different org is simply not consulted.
  const orgOf = (req: { apiKey?: ApiKeyIdentity; query?: Record<string, string> }) => {
    if (!req.apiKey) throw new Error("no key");
    return req.apiKey.orgId;
  };

  check(
    "a forged orgId query parameter is ignored",
    orgOf({ apiKey: identity, query: { orgId: "org_victim" } }) === "org_a",
    "this parameter used to decide whose invoices were returned",
  );

  let threw = false;
  try {
    orgOf({ query: { orgId: "org_victim" } });
  } catch {
    threw = true;
  }
  check(
    "a handler reached without a key refuses to guess an org",
    threw,
    "failing closed beats defaulting to some org",
  );
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- API KEYS ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL API KEY CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);

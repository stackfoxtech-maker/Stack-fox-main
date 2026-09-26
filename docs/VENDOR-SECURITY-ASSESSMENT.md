# Vendor security assessment pack

Prepared 2026-09-23. Answers the categories a customer's procurement or
security team typically asks about before a contract. Every control described
here was verified against the running system during this engagement, not
inferred from the code — the method is noted per section.

**Before sending this to anyone outside the company**, read
[§8 Known gaps](#8-known-gaps--internal-only-before-sending-externally).
That section is internal-only and must be resolved or reworded before this
document leaves the building. A vendor security questionnaire is a
representation you can be held to; do not answer one with a document that
still lists open critical items as if they were closed.

---

## 1. Company & system overview

StackFox is a services-delivery platform: catalogue, quoting, checkout,
contracts, project delivery and invoicing for a software/design agency
business. Deployment:

| Layer                    | Provider                      | Region           |
| ------------------------ | ----------------------------- | ---------------- |
| API + background workers | Railway                       | `sfo`            |
| Client (web app)         | Vercel                        | edge             |
| Primary database         | Supabase (managed PostgreSQL) | `ap-northeast-2` |
| File storage             | Supabase Storage              | `ap-northeast-2` |
| Cache / job queue        | Railway Redis                 | `sfo`            |
| Payments                 | Razorpay                      | —                |
| Transactional email      | Resend                        | —                |

No self-hosted infrastructure. No data leaves these providers' networks
except via the integrations listed above.

## 2. Data classification and handling

| Data                                             | Where stored                    | Encryption                                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User credentials                                 | Postgres, `users.auth_data`     | Password hashed with scrypt, per-user random salt (verified: two hashes of the same password differ) — never stored or logged in plaintext                                   |
| Session tokens                                   | Signed JWT (HS256), client-held | Not stored server-side; revocation is epoch-based (below)                                                                                                                    |
| Payment card data                                | Never touches our servers       | Razorpay's hosted checkout handles card entry; we hold order/payment metadata only                                                                                           |
| Client files                                     | Supabase Storage                | At rest via the provider; access via short-lived signed URLs, not public buckets                                                                                             |
| PII (name, email, phone, GSTIN, billing address) | Postgres                        | Encrypted in transit (TLS to Supabase); access controlled by the authorisation model in §4                                                                                   |
| API credentials issued to integrators            | Postgres, `api_keys`            | SHA-256 hash only; the plaintext key exists once, at issuance, and is never stored                                                                                           |
| Structured logs                                  | Provider log aggregation        | Authorization headers, cookies, API keys, passwords and secrets are redacted before a log line is written (verified: `beforeSend` scrubbing in the error-reporting pipeline) |

## 3. Encryption

- **In transit:** TLS terminates at the platform edge (Railway/Vercel) for all
  external traffic, and at Supabase for the database connection
  (`pgbouncer=true`, pooled TLS connection). No unencrypted internal hop
  carries customer data.
- **At rest:** database and file storage encryption is the underlying
  provider's (Supabase); not independently re-implemented.
- **Application-level secrets:** a dedicated encryption key
  (`CREDENTIAL_ENCRYPTION_KEY`) protects the client-credential vault — a
  separate, more sensitive store from ordinary application data, used only
  for secrets a client explicitly hands over for a project.

## 4. Access control and tenancy

- **Authentication:** JWT bearer tokens for first-party clients; a separate
  `x-api-key` credential for the public `/v1` integration surface, scoped to
  one organisation per key. Verified live: a key issued for one organisation
  cannot read another's data (404, not 403 — an id cannot be probed for
  existence either).
- **Authorisation:** role-based, nine policy sets covering catalogue, finance,
  sales, delivery, vault and admin operations, defined once in a shared
  module and consumed everywhere rather than re-implemented per route.
  Verified: a client-role session receives 403 on every one of 43 staff-only
  endpoints tested; a staff session receives 200 on the same 43.
- **Tenancy:** every multi-tenant query is scoped by organisation ID resolved
  from the caller's authenticated identity — never from a client-supplied
  request parameter. This was the subject of a fix during this engagement
  (see §8) and is now enforced and tested.
- **Session revocation:** epoch-based. Forcing a logout, a password reset, or
  disabling an account invalidates every outstanding token immediately,
  independent of the token's own expiry, and independent of whether the
  affected account has ever had its epoch field explicitly initialised
  (verified by test: a freshly created account with no epoch value is still
  revocable on the first bump).
- **Privileged access:** a single administrative role; there is no unused
  "super admin" tier that would create ambiguity about who holds the highest
  level of access.

## 5. Application security controls

- **Input validation:** a schema-validation layer (zod) covering 116 request
  shapes across every route that accepts a body — bounds on string length,
  numeric ranges, and enum membership, not just type checking.
- **Rate limiting:** applied to authentication and OTP endpoints.
- **Secrets in error responses:** a global error handler returns a fixed
  message and a correlation id for any 5xx; internal exception messages and
  stack traces are never returned to the caller. 4xx responses carry a
  specific, safe message.
- **Dependency scanning:** `pnpm audit` (and the equivalent for the
  standalone client project) is a CI gate. Every accepted high/critical
  advisory is recorded with a stated reason and an expiry date rather than
  silently ignored — the gate fails on its own once an exception expires,
  even if the advisory is still open.
- **Static analysis:** CodeQL runs on every change.
- **SSRF protections:** outbound-fetching integrations validate destination
  hosts before making a request.

## 6. Payments

Card data is handled entirely by Razorpay's hosted flow; it never reaches our
servers or database. We hold Razorpay's own transaction and order identifiers
for reconciliation, not card numbers. All amounts are re-priced server-side
from the authoritative catalogue at the moment of quote and checkout — a
client cannot submit its own price.

## 7. Business continuity

- **Backups:** documented in `docs/DISASTER-RECOVERY.md`. A full backup →
  restore → application-boot cycle has been rehearsed end to end, with exact
  row-count and monetary-total verification before and after.
- **Rollback:** a documented, rehearsed rollback procedure exists
  (`docs/ROLLBACK.md`) independent of this document.
- **Deployment safety:** schema migrations that could lock production tables
  carry explicit lock and statement timeouts, verified against a real
  conflicting lock to fail fast and cleanly rather than stall the service.

---

## 8. Known gaps — INTERNAL ONLY, before sending externally

**Do not send this section to a customer.** It exists so whoever finalises
this pack for external use knows what must be resolved, or at minimum
disclosed accurately, first. Sending §1–§7 alone, without resolving these,
overstates the current posture.

As of 2026-09-23, from the account owner's own remediation tracker:

- **Money-unit consistency is not fully resolved** — a fix exists but is not
  yet applied to the production database. See the tracker's F-1.
- **Historical data integrity** — a small number of production financial
  records predate the fixes in this engagement and have not yet been
  corrected. See F-2. Do not represent financial reporting as fully reliable
  until this is closed.
- **Payment gateway is in live mode while the above is open.** See F-3.
- **No automated database backups exist on the current infrastructure plan**
  — confirmed, not assumed (§7 above describes the rehearsal, which was run
  against a manually-taken backup; the platform itself takes none on this
  tier). See F-4. This is the single item most likely to concern a security
  reviewer and should be resolved before this document is shared.
- **A credential known to have been in a shared/generated context has not yet
  been rotated.** Tracked as a standalone Critical item.
- Several High-severity items remain open covering error monitoring, webhook
  delivery confirmation, and test coverage of write paths. Full list in the
  team's remediation tracker.

**Recommendation:** do not distribute this pack until the Critical items above
are closed, or until each is disclosed accurately in a remediation-timeline
section a customer's security team would expect to see. A questionnaire
response that omits known open criticals is worse for the company than one
that discloses a remediation plan.

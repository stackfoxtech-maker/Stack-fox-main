# Deploying the remediation branch

Written 2026-09-22 for the first deploy of `fix/phase0-critical-security`. Every
fact below was checked against the live Railway project and the running code on
`main`, not inferred from the repo. Where something is unverified it says so.

For rolling _back_, see [ROLLBACK.md](ROLLBACK.md).

---

## Why this is urgent

Re-confirmed against production on **2026-09-22**:

```
GET /v1/engagements   x-api-key: anything-at-all   ->  200
GET /v1/invoices      x-api-key: anything-at-all   ->  200
GET /v1/projects      x-api-key: anything-at-all   ->  200
GET /v1/engagements   (no header at all)           ->  401
```

The last line is the diagnosis: the check is **"is the header present"**, not
"is the key valid". Any non-empty string authenticates, and the organisation is
then taken from a request parameter, so one arbitrary string reads across
tenants.

The fix is written and tested. It is not deployed. `main` has been serving the
same build since **2026-09-12**.

`GET /v1/services` returns **500** on production as well — three fields that do
not exist on the model, hidden behind an `as any`.

---

## How a deploy actually happens here

| Thing           | Value                                                       | Why it matters                                                                                                     |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Railway source  | repo `stackfoxtech-maker/Stack-fox-main`, branch **`main`** | **Merging to `main` IS the deploy.** There is no separate deploy step.                                             |
| `checkSuites`   | **`false`**                                                 | Railway does **not** wait for CI. A merge deploys whether CI is green or red.                                      |
| Replicas        | 1, region `sfo`                                             | Expect a short gap at cutover. There is no rolling overlap.                                                        |
| Container `CMD` | `prisma migrate deploy && node dist/server.js`              | **Migrations run on every boot, before the server starts.**                                                        |
| Restart policy  | `ON_FAILURE`, max 3                                         | A boot that keeps failing marks the deploy failed; Railway does not cut traffic to a container that never came up. |

Because `checkSuites` is false, **CI being green is something you have to check
yourself before merging.** That is the one manual gate standing between a red
build and production.

---

## The migration

This deploy carries `20260921120000_money_bigint`: 26 money columns across 15
tables widened `INTEGER -> BIGINT`. In Postgres that **rewrites each table**
under an `ACCESS EXCLUSIVE` lock.

It runs while the _previous_ container is still serving, so it runs against a
live database.

The migration now opens with:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '120s';
```

Without `lock_timeout`, an `ACCESS EXCLUSIVE` lock waits behind any open
transaction on the table — and every query arriving after it queues behind the
_lock_, not the transaction. A single `idle in transaction` session is enough to
stall reads and writes on `invoices`, `orders` and `payments` for as long as it
lasts. With the timeout, that becomes a **clean failed deploy** instead: Railway
never cuts over, the old container keeps serving, and you retry in a quiet
window.

Each migration runs in a transaction, so a timeout leaves **no half-widened
schema**.

### Not verified

- **Production row counts.** The migration's original note claimed the rewrite
  is "sub-second". That was measured against a local test database. Production
  reads were unavailable, so treat it as an assumption — the `lock_timeout` is
  what makes acting on it safe, not the claim itself.
- **The edited migration has not been run against a live Postgres.** Docker was
  unavailable. The SQL change is two `SET` statements, but it is untested.
  Prisma checksums only migrations it has already recorded, and production has
  never applied this one, so the edit does not cause a checksum error there.
  A _local_ database that already applied the old file **will** complain that
  the migration was modified; re-resolve it there.

---

## Order of operations

The order matters, and the reason is evidence, not convenience.

1. **Push the branch and open a PR.** Opening the PR runs CI (it triggers on
   `pull_request`).

   ```bash
   git push -u origin fix/phase0-critical-security
   ```

2. **Wait for CI to be green.** Railway will not do this for you. It covers
   typecheck, lint, format, the API/client contract, the docs sync gate, both
   builds, client unit tests, and the integration suites.

3. **Merge to `main`.** This deploys. Watch the Railway build and boot logs —
   specifically for `migrate deploy` completing, since that is where a lock
   timeout would show up.

4. **Re-run check 5. It must now return 401.**

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "x-api-key: anything-at-all" \
     https://stackfox-api-production-c639.up.railway.app/v1/engagements
   ```

   Anything other than `401` means the exposure is still open — go to
   [ROLLBACK.md](ROLLBACK.md) and reassess rather than continuing.

5. **Then run runbook checks 1–4** against the production database, to find out
   whether the exposure was _used_. These are the difference between "exposed"
   and "exposed and taken".

6. **Only then rotate the seeded credentials.** Rotating earlier destroys the
   evidence checks 1–4 depend on. This ordering is from the Phase 0 runbook and
   is deliberate.

---

## Environment variables

Set these when convenient; none of them block the deploy.

| Variable                            | State         | Note                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                        | unset         | Sentry is inert without it. Boots fine — an empty value is treated as absent.                                                                                                                                                                                 |
| `DATABASE_URL`                      | set           | Wants `connection_limit=5` appended. Supabase's pooler is in transaction mode and the default Prisma pool is larger than this service needs.                                                                                                                  |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`     | unset         | After this deploy `/webhooks/whatsapp` returns **503** instead of accepting unauthenticated calls. Nothing functional is lost: the outbound half reads `WHATSAPP_BSP_URL`, which is not set in production either, so that integration has never worked there. |
| `AUTH_SECRET`                       | set, **dead** | Nothing reads it. `plugins/auth.ts` reads `JWT_SECRET ?? NEXTAUTH_SECRET`; Railway has `JWT_SECRET`. Safe to delete — but **copy the value out first**, because Railway redacts it and it cannot be recovered.                                                |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | set, **dead** | Production Redis is the Railway `Redis` service via `REDIS_URL`. These are live credentials to a metered service that this environment never calls. Same warning: copy before deleting.                                                                       |

---

## Known behaviour changes on this deploy

Things that are _supposed_ to change, listed so they are not mistaken for
breakage:

- `/v1/*` requires a real API key and resolves the organisation from that key.
  **Any existing integration passing a junk key will start getting 401.**
- A resource outside the caller's tenancy returns **404, not 403**, so an id
  cannot be probed for existence.
- 500s no longer include the internal error message; they carry a `requestId`.
- `/webhooks/whatsapp` returns 503 until its token is set (see above).
- `POST /quotes` re-prices every line from the catalogue and **400s an item it
  cannot price**, instead of trusting a client-supplied `price`.

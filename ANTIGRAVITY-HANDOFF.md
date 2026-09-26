# StackFox — overnight agent handoff

Paste everything below into Antigravity as the opening prompt.

---

You are picking up a remediation backlog on **StackFox**, a live production
services platform. The owner is asleep. Work through the tasks in §5 in order,
one commit each, verifying as you go.

Read §1–§4 before touching anything. §3 is the part that will bite you.

## 1. What this is

pnpm + Turborepo monorepo.

- `apps/api` — Fastify 5 + Prisma 5 + PostgreSQL + BullMQ. 295 endpoints.
- `packages/core` — shared domain logic. **Role constants live here** (`src/roles/index.ts`) and are the single source of truth.
- `packages/prisma` — schema + migrations.
- `client/` — Vite + React 18, **plain JS/JSX**, a standalone npm project _outside_ the pnpm workspace (its own lockfile, installs with `--legacy-peer-deps`).

Production: API + workers on Railway (one service, one replica), client on
Vercel at `https://stackfox.in`, Postgres on Supabase (free plan), Redis on
Railway, files in Supabase Storage, email via Resend, payments via Razorpay
**in live mode**.

Docs worth reading before you start: `docs/DEPLOY.md`, `docs/ROLLBACK.md`,
`docs/API.md`, `docs/DISASTER-RECOVERY.md`.

## 2. Hard rules — do not violate these

1. **Never touch the production database.** No writes, no migrations against it, no `prisma db push`, no seeds. `.env` in the repo root points `DATABASE_URL` at **live production Supabase** — this is a known bug (task F-11). Always override it. Use `scripts/test-stack.sh`, which exports its own values (shell exports beat dotenv, which does not override existing vars).
2. **Never deploy.** Do not merge to `main`. Railway deploys from `main`, so **merging _is_ deploying**, and `checkSuites: false` means Railway does **not** wait for CI. Push branches; open PRs; stop there.
3. **Never run a GSTR-1 export** (`/finance/gstr1`). It emits a filing-ready GST return built from corrupt invoices. See F-24.
4. **Do not create or elevate user accounts.**
5. **Do not commit work you did not write.** See §3.
6. If a task needs a dashboard, a credential, or a purchase, **skip it and note why**. Several in the backlog do; they are excluded from §5.

## 3. ⚠️ The working tree is not clean

Another agent ("codex") has **~25 uncommitted files** in progress, mostly the
money layer: `routes/quotes.ts`, `routes/checkout.ts`, `routes/finance.ts`,
`lib/billing.ts`, `lib/payments.ts`, plus several test files and a new
`apps/api/tests/production-audit.mts`.

There are also **my own uncommitted changes**: `packages/core/src/roles/index.ts`,
`apps/api/src/routes/admin.ts`, `client/src/app/admin/Catalog.jsx`,
`apps/api/scripts/seed-master-admin.mts`, `routes/blog.ts`, `routes/analytics.ts`,
`packages/prisma/prisma/backfill-personal-orgs.ts`,
`apps/api/tests/critical-regressions.mts`, `client/src/lib/__tests__/roles.test.js`.

**Before you start:**

```bash
git status --short
git branch --show-current
```

Then:

- **Never** `git add -A` or `git commit -a`. Stage explicit paths only.
- If a task needs a file that is already modified and you did not modify it, **skip that task** and say so. Do not untangle someone else's half-finished work.
- Two pre-existing lint errors are codex's, not yours: an unused `ExpressCheckoutSchema` import in `routes/checkout.ts`, and an unnecessary type assertion in `tests/production-audit.mts`. **Leave both alone.** If `pnpm lint` shows exactly these two, that is the expected baseline.

## 4. How to verify — run these after every task

```bash
pnpm --filter @stackfox/api typecheck     # src + tests
pnpm lint                                  # expect 0 errors beyond the 2 above
pnpm format:check
node scripts/check-api-contract.mjs
pnpm --filter @stackfox/api docs:api:check # fails if docs/ drifted from routes
```

For anything touching the API at runtime, bring up the local stack (needs
Docker):

```bash
bash scripts/test-stack.sh up     # throwaway Postgres :55432 + Redis :56379, migrates, seeds, builds, boots on :4000
bash scripts/test-stack.sh test   # all 19 integration suites
bash scripts/test-stack.sh down
```

Client work:

```bash
cd client && npm test && npm run build
```

**Known flake:** in a _full_ suite run, `access-control.mts` and `cart.mts` can
fail because the suites share one Redis rate limiter. They pass individually.
This is documented in `tests/run-all.mts`. Do not "fix" it by removing rate
limiting.

### Standards this codebase holds to

- **Every non-trivial fix leaves a runnable check behind.** Look at `apps/api/tests/critical-regressions.mts` for the house style.
- **Control-test your assertions.** A test that passes before your fix proves nothing. Break the thing deliberately, watch the test fail, then fix it. Several bugs here were originally found because a "passing" test was passing vacuously.
- Comments explain **why**, not what.
- Money is integer **paise** everywhere except `quotes`, which is the bug in F-1. Read that task before touching anything financial.

## 5. The queue — do these, in this order

One commit per task. Conventional commit messages. After each, run §4.

### 5.1 · F-8 — `/catalogue/services/:id/features` 200s for an unknown id

`apps/api/src/routes/catalogue.ts`. It returns an empty success for a service
that does not exist, while `/catalogue/services/:id` correctly 404s. Mirror the
parent's lookup. It was the only one of 135 swept GET endpoints doing this.

### 5.2 · F-25 — `/api-keys` returns 403 for a missing parameter

`apps/api/src/routes/apiKeys.ts`. Internal staff have `orgId: null` by design,
so `targetOrg()` falls through to `null` and replies `403 Insufficient
permissions` when no `?orgId=` is given. With `?orgId=` it returns 200.
Distinguish "not permitted" (403) from "you didn't say which org" (400).
`/vault` already does this correctly — copy it. This misleading error may be
_why_ no API key has ever been issued.

### 5.3 · F-26 — `activeClients: 0` on the admin overview

`apps/api/src/routes/analytics.ts`. Returns `activeClients: 0` while 11 orgs and
6 engagements exist; `totalProjects: 6` is correct off the same data. Trace the
query. **Do not touch `totalRevenue`** — its wrongness belongs to F-1/F-2 and
fixing it here would mask real data corruption.

### 5.4 · F-24 — guard the GSTR-1 export

`apps/api/src/routes/finance.ts`. The export is correct code fed junk, so it
formats corrupt invoices into a plausible, filing-ready GST return. Add a guard
that **refuses to emit a row** failing the invoice invariant (status `PAID`
with no `Payment` row, or an implausibly small `grandTotal`) rather than
silently exporting it. An export destined for a tax authority should fail loudly
on bad input. Do not clean production data — that is F-2 and it is the owner's.

### 5.5 · F-15 — backfill `sessionEpoch`

Only 7 of 13 users carry `sessionEpoch` in `auth_data`. Revocation is
epoch-based, so "log everyone out" silently does nothing for the other six.
Write the migration/backfill script and make the field non-optional going
forward. **Write it; do not run it against production.** Verify on the local
stack: `SELECT count(*) FROM users WHERE NOT (auth_data ? 'sessionEpoch')` → 0.

### 5.6 · Convert the 19 JS-side aggregations to DB-side

`analytics.ts`, `reports.ts`, `adminReports.ts`, `catalogue.ts`, `programs.ts`,
`finance.ts`, `reviews.ts`, `estimates.ts`, `quotes.ts`. Each pulls rows into
Node and reduces them in JavaScript. Move them to `groupBy` / `aggregate` /
`count`. Do these **one endpoint per commit** and assert the output is
unchanged before and after — these feed dashboards and an off-by-one becomes a
wrong number on a screen. This is a direct continuation of the admin-catalog
pagination work already done in `routes/admin.ts`; use it as the pattern.

### 5.7 · Playwright smoke test

Tracked as "Client tests (Vitest unit tier done; Playwright smoke test open)".
Cover the journeys that have **never** been tested: signup → login → cart →
quote → the client dashboard tabs. Run against the **local stack**, never
production. This is the highest-leverage item in the list — roughly two thirds
of the product has never run in production at all (F-14), and ~160 non-GET
endpoints have never been exercised (F-22).

### 5.8 · F-16 — API key issuance

`apps/api/src/routes/apiKeys.ts`, `publicApi.ts`. `api_keys` has **zero rows**,
so the entire `/v1` public API — 13 endpoints — cannot be called by anyone.
Revocation exists; there is no way to _create_ a key to revoke. Add issuance
with scopes, plus docs. Do 5.2 first, it may be the actual blocker.

### 5.9 · Scope-level authentication defaults

`apps/api/src/server.ts`. Today each route opts _in_ to a guard. Invert it so
routes are protected by default and public ones opt _out_. **High risk of
lockout** — do this only if 5.1–5.8 are done, keep it in its own branch, and
make `tests/access-control.mts` (48 checks) pass unchanged. If anything is
ambiguous, stop and leave it for the owner.

## 6. Explicitly NOT for you

Leave these. They need a human, a credential, or a purchase:

| Task                                      | Why                                               |
| ----------------------------------------- | ------------------------------------------------- |
| **F-1** money units (paise vs rupees)     | codex is mid-flight on exactly these files        |
| **F-2** clean the 6 corrupt invoices      | production data; the owner decides void vs delete |
| **F-3** Razorpay live/test mode           | Razorpay dashboard                                |
| **F-4** buy Supabase Pro                  | a purchase                                        |
| **F-5** set `SENTRY_DSN`                  | needs a Sentry project                            |
| **F-6** split out the worker service      | Railway dashboard                                 |
| **F-12** delete dead Railway credentials  | values are redacted and unrecoverable once gone   |
| **F-23** verify the Razorpay webhook      | Razorpay dashboard                                |
| Rotate seeded credentials                 | the owner's                                       |
| **F-13** / fold client into the workspace | large, and collides with codex                    |

## 7. Leave a report

Write `OVERNIGHT-REPORT.md` at the repo root as you go — not at the end:

- Task, commit SHA, what changed
- What you verified and the actual numbers (not "tests pass" — _which_ tests, _how many_)
- **Anything you skipped and why**
- Anything you found that is not in this list
- Anything you are unsure about

Be accurate over reassuring. If something is half-done, say so plainly. A
wrong "done" is worse than an honest "blocked" — the owner is asleep and cannot
correct you.

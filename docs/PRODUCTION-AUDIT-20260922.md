# Production audit remediation — 22 September 2026

Source: https://holly-roadrunner-a08.notion.site/Production-Audit-22-Sep-2026-post-deploy-3e3f24fc3b3781f995d3f775c45de6aa

Baseline: a47fb07 (PR #10). Local main was 48 commits behind; work is on
`codex/production-audit-20260922` from current origin/main.

Updated 25 September 2026. Changes are local and have not been deployed.
Production verification and local regression evidence are recorded separately.
The original Notion page still returns 404 through the connected account
`artwalllabs@gmail.com` in `artwall labs’s Space` (rechecked after the user's
25 September request). Workspace search did not find the original audit.
Do not mark undeployed code as a resolved production finding.

User-confirmed role policy: ADMIN is the sole administrator role. Read-only
production SQL confirms one ADMIN and twelve INDIVIDUAL_CLIENT users, no
SUPER_ADMIN. The concurrent role retirement changes have been preserved.

| Finding                                     | Status                                                                                                                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-1 canonical paise                         | Implemented and locally verified: quote columns/JSON migration, paise pricing, gateway amount without multiplier, explicit client display conversion. Migration applied to isolated PostgreSQL. Production rollout/reconciliation pending.                            |
| F-2 corrupt invoices and database invariant | Locally verified prevention: deferred captured-payment evidence trigger, amount/status check, atomic settlement. All six production rows remain unreconciled; no records deleted/voided without classification.                                                       |
| F-3 live payment mode/webhook delivery      | Code now blocks live order creation unless LIVE_PAYMENTS_ENABLED=true. Not deployed; production remains live. Local signed webhook/callback replay tests pass. Actual Razorpay delivery and charge remain unverified; available local gateway credentials return 401. |
| F-4 off-site backup and restore             | BLOCKED: no approved off-site destination or paid backup configuration. Existing local dump is not off-site. No backup purchase made.                                                                                                                                 |
| F-5 Sentry                                  | BLOCKED: no API/client DSNs or Sentry project access available. Existing integration remains inert in production.                                                                                                                                                     |
| F-6 separate worker process                 | OPEN: code entrypoint exists; production Railway still has one API service with inline workers. Separate service and verified queue processing required. Use node apps/api/dist/workers/index.js from /repo.                                                          |
| F-7 business email                          | Invoice-issued and payment-receipt transactional outbox implemented; deterministic provider keys, leasing, backoff and failure state. Local retry/concurrent-delivery tests pass. Production delivery and other event templates remain open.                          |
| F-8 unknown service features                | Locally verified 404 for unknown/unpublished service. Production deployment pending.                                                                                                                                                                                  |
| F-9 stranded quotes                         | INVESTIGATED, not resolved: current production has 7 checkout quotes; only 1 has a gateway order, 6 never initiated payment. Gateway reconciliation required before classifying the remaining one; no statuses fabricated.                                            |
| F-10 contract counts                        | ✅ Investigation resolved against production: five engagements each have DPA, IP_WFH, MSA, NDA and SOW; one has MICRO_SOW. 5×5+1=26. No duplicate (engagement_id,type). No data repair warranted by the count.                                                        |
| F-11 developer database safety              | Root ignored .env database URLs changed to localhost. Audit environment explicitly isolates DB/Redis and removes external credentials; test mode never reloads .env. Seed scripts now reject nonlocal database hosts; final guard check pending.                      |
| F-12 unused credentials                     | BLOCKED: Railway OAuth returns redacted values, so the requested recovery copy cannot be made. Nothing deleted. Owner must securely export before removal.                                                                                                            |
| F-13 role definitions                       | Client guards/store/tests now import the shared canonical policy; no hand-maintained role mirror. ADMIN-only policy verified by 24 role tests and local ADMIN/SE login. Production bundle deployment pending.                                                         |

## Newly discovered issues

- N-1, P0: quote PATCH accepts arbitrary `checkoutDetails`, including
  `amountPaid`, `payments` and `pendingOrderAmount` which settlement trusts.
  Root cause: customer answers and server payment state share an unrestricted JSON object.
- N-2, P0: quote verification updates the quote before provisioning, creates a
  PAID invoice without amountPaid or Payment, and has no quote handling in the
  Razorpay webhook. A retry or concurrent verification can lose or duplicate
  provisioning. Root cause: independent payment/provisioning writes and missing
  gateway reconciliation.
- N-3, P0: invoice browser verification still updates the invoice outside the
  payment transaction; payment rows are skipped entirely without an Order.
  Webhook partial-payment replay increments amountPaid again before deduplication.
- N-4, P1: Razorpay checkout signature validation accepts an empty configured secret.
  Root cause: missing configuration uses an empty HMAC key instead of failing closed.

N-1–N-4 are fixed locally and covered by `apps/api/tests/production-audit.mts`:
strict customer fields, payment-bound quote immutability, row locks, gateway capture
lookup, atomic provisioning/payment writes, capture deduplication and fail-closed HMAC.

- N-5, P0: revenue worker blindly appended entries on retries and skipped later
  installments if any entry existed. Fixed by invoice-locked reconciliation to
  captured Payment sums; cron recovers missing queue submissions. Concurrent
  partial/final recognition regression passes. Production ledger review pending.
- N-6, P0: UPFRONT charged 95% but left a 5% outstanding quote balance. Fixed by
  reducing invoice liability and tax base when creating the initial order.
  ₹10,000 subtotal -> ₹9,500 subtotal + ₹1,710 tax = ₹11,210 verified locally.
- N-7, P1: checkout session operations lacked owner checks; client-owned estimate
  creation also accepted another user's workspace. Owner checks added; completed
  sessions/payment-bound edits are locked. Checkout/document/tenant suites pass;
  live flows still require verification.
- N-8, P1: Admin Overview/Analytics read an envelope where the API returned bare
  JSON and silently showed zeros; Finance's fetch function returned undefined,
  so its summary crashed inside a swallowed promise rejection. Response handling,
  finance summary and pagination repaired; browser now shows real local totals.
  Revenue reports now use captured payment evidence and honor the selected range.
- N-9, P1: Team project cards/milestones read title/projectNumber while API sends
  name/id. Repaired field mapping; browser verification of final change pending.
- N-10, P1: contract-signing UI advanced after a failed save. It now shows failure
  and stays on the step. Failure-path browser verification pending.
- N-11, P0: repeated invoice order initiation could replace a live gateway order;
  checkout completion relied only on an expiring Redis lock. Invoice initiation
  now locks its database row/reuses a matching gateway order; checkout consumption
  also checks under a database lock. Local regression suites passed 25 September;
  actual gateway initiation/capture and production rollout remain pending.
- N-12, P1: legacy quote backfill could delete invoices/contracts before failing
  reprovisioning. Non-dry-run legacy backfills now fail before writes, pending
  evidence-based reconciliation.
- N-13, P1: the express checkout endpoint created an orphan gateway order without
  a settlement/provisioning path. It is temporarily disabled with 503 directing
  callers to cart checkout; replacement flow remains open.

## Mandatory verification gaps

### 25 September continuation

- N-14, P1 — Disabled/deleted accounts could retain access through cached session
  epochs. Session validation now checks the active database user; the targeted
  access-control suite passed 50 checks again on 25 September, including account disable
  and deletion. Production deployment remains pending.
- N-15, P0 — A checkout payment initiation had no database lock and a form request
  that passed the pre-handler could overwrite terms after gateway order creation.
  Initiation now locks/rechecks the durable session, and form writes conditionally
  require an unconsumed session without a gateway order. Completion compares the
  commercial fields again under its database lock. The checkout integrity suite
  passed 15/15 checks, including rejection of late writes and preservation of
  gateway order/payment terms. Actual gateway concurrency remains unverified;
  production deployment pending.
- Finance CSV now refuses incomplete/invalid GSTR-1 exports, including missing
  captured-payment evidence and capped result sets. Production export remains
  unverified; do not use this as reconciliation of the six historical invoices.
- Full-suite rate-limit counters previously contaminated later suites (429s).
  The runner now clears only limiter keys between suites in dedicated local test
  services, preserving rate-limit assertions inside each suite. All 21 suites
  passed together after this isolation fix.

Current verification: workspace build (3/3), workspace typecheck (5/5), client
tests (44/44), client production build, lint (0 errors, 220 warnings), auth
coverage (282 routes), and client/API contract check (257 routes) passed on
25 September. The final targeted API build/typecheck after the checkout edits
also passed, as did targeted lint (zero errors). OpenAPI drift check passed:
295 endpoints and 116 schemas. The final full-repository format check and
`git diff --check` passed after formatting corrections.

Docker startup blocker cleared by the user on 25 September. Rechecked both
containers: PostgreSQL accepts connections, Redis returns PONG, and all ten
migrations are applied to the isolated audit database. The final 21-suite API
rerun passed with exit code 0, including the latest checkout regressions.
Evidence: `.audit-docker-restored-tests.log`; API health reports database/Redis
true, external storage/error reporting false and inline workers false.
The in-app browser also timed out opening the local Vite site. Prior evidence
below is historical, not a substitute for these remaining checks.

Admin/Team/Client/Public UI; role-by-role API writes; cross-tenant access; database
constraints; captured payment, duplicate/concurrent webhook and callback delivery;
worker retries; file upload/messages/tickets/contracts/handover/change requests;
mobile/error/loading states. These remain open until actual test evidence is added.

## Verification evidence

- Isolated PostgreSQL: `stackfox_audit_20260922` on localhost:55432; Redis DB9 on
  localhost:56379; API localhost:4001; Vite localhost:5175. No real charge or customer
  email was sent by audit tests.
- Final API regression run: **21/21 suites passed** on 25 September. This
  supersedes the earlier partial runs and rate-limit-contaminated run. Includes
  access control 50/50, checkout integrity 15/15, critical regressions 47/47,
  and mutation smoke 17/17. Passing these suites does not cover every production
  endpoint or the external gateway/storage integrations.
- Dedicated production-audit regressions pass: paise persistence, malicious payment
  JSON rejection, missing service404, concurrent partial settlement, signed webhook
  completion/replay, orderless invoices, database invariant/evidence deletion,
  empty-secret refusal, revenue retries and durable mail retries.
- Client unit tests: 44/44 passed on 25 September.
- Client production build and final API build/typecheck passed.
- Root ESLint: zero errors,220 warnings. API/client contract check:
  257 routes, all client calls matched. OpenAPI drift check passed.
- Browser: ADMIN login and 22 navigation screens exercised. Overview and Finance
  bugs reproduced and repaired. Fast navigation triggered rate-limit429 on late
  Analytics/Settings checks, so those checks need a paced rerun. SE login succeeds;
  task/project/timesheet/calendar/review/knowledge/queue/sprint pages exercised.
  Empty states are not evidence that all associated writes work.

## Production rollout requirements

1. Reconcile gateway captures for the six corrupt invoices and eight paid/partial
   quotes before voiding or rebuilding anything. Preserve gateway references.
2. Take a fresh backup, copy it to approved off-site storage and restore-test it.
3. Stop old API writers during the paise migration. The old binary interprets
   quotes as rupees and is not safe alongside converted rows. Apply migrations,
   deploy API and client together, then verify a known-price quote and invoice.
4. Keep live payments gated until reconciliation, gateway test-mode completion,
   verified webhook delivery and replay tests pass. Register the webhook endpoint
   and confirm the matching secret through the gateway account.
5. Deploy a dedicated worker from the same revision/image with the worker command;
   verify jobs before setting WORKERS_INLINE=false on API. Configure DSNs and
   verify an intentional captured error in Sentry.
6. Verify receipt/invoice delivery, privileged and client UI/write paths on the
   deployed revision, then update original Notion statuses with that evidence.

This ledger preserves original findings and is ready to transfer to the original
Notion page once the correct account/workspace grants editing access.

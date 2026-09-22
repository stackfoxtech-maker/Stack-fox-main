-- Widen every money column from INTEGER to BIGINT.
--
-- int4 caps a value at 2,147,483,647 paise — Rs 2,14,74,836.47. Past that
-- Postgres rejects the write outright with "integer out of range", so a single
-- invoice above about Rs 2.15 crore could not be created at all. Verified
-- against this database rather than assumed.
--
-- int8 raises the ceiling to 9.2e18 paise, which is past any real amount.
--
-- Columns that merely happen to be Int are deliberately untouched: gst_rate is
-- a percentage, rate_card_ver and current_version are versions, feedback_round
-- and base_weight are counters. Widening those would be noise.
--
-- On the JS side nothing changes shape. packages/prisma converts BigInt to
-- number at the client boundary, because a double represents every integer up
-- to 2^53 exactly (about Rs 90 trillion in paise) and ~45 arithmetic sites
-- plus Math.min/Math.max would otherwise have had to change.
--
-- OPERATIONAL NOTE: int4 -> int8 rewrites the table and takes an ACCESS
-- EXCLUSIVE lock for the duration. If these tables grow to millions of rows,
-- revisit this with an add-column/backfill/swap approach instead.
--
-- The two SETs below are the deployment safety net, and they matter because
-- the container's CMD runs `migrate deploy` BEFORE the server starts while the
-- PREVIOUS container is still serving traffic. So this runs against a live
-- database, not a quiet one.
--
--   lock_timeout       An ACCESS EXCLUSIVE lock waits behind any open
--                      transaction touching the table -- and while it waits,
--                      every later query queues behind IT. One idle-in-
--                      transaction session is therefore enough to stall reads
--                      and writes on invoices, orders and payments for as long
--                      as it lasts. Failing after 5s instead turns an
--                      unbounded production stall into a fast failure:
--                      Railway never cuts over and the old container keeps
--                      serving. Note it is NOT simply retryable -- Prisma
--                      records the failure and then refuses every later
--                      migration with P3009, so the container fail-loops until
--                      someone runs `migrate resolve --rolled-back` on this
--                      migration. See docs/DEPLOY.md.
--
--   statement_timeout  Bounds the rewrite itself. Sized for small tables,
--                      which is what this database is believed to hold -- but
--                      that was measured locally, not in production, so this
--                      is the guard rather than the assumption.
--
-- Plain SET, not SET LOCAL, deliberately. SET LOCAL is the transaction-scoped
-- form, but outside a transaction it silently does nothing -- so if the runner
-- ever stopped wrapping migrations, the protection would vanish with no error.
-- Plain SET applies either way; it is session-scoped, and the session here is
-- a short-lived CLI connection that exits immediately afterwards, so there is
-- nothing for it to leak into.
--
-- If the ALTERs do fail, they fail together: each migration runs in a
-- transaction, so a timeout leaves no half-widened schema.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- AlterTable
ALTER TABLE "bench" ALTER COLUMN "cost_per_day" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "change_requests" ALTER COLUMN "cost_delta" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "credits" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET DATA TYPE BIGINT,
ALTER COLUMN "cgst" SET DATA TYPE BIGINT,
ALTER COLUMN "sgst" SET DATA TYPE BIGINT,
ALTER COLUMN "igst" SET DATA TYPE BIGINT,
ALTER COLUMN "grand_total" SET DATA TYPE BIGINT,
ALTER COLUMN "amount_paid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "subtotal" SET DATA TYPE BIGINT,
ALTER COLUMN "gst" SET DATA TYPE BIGINT,
ALTER COLUMN "grand_total" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "packages" ALTER COLUMN "flat_price" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "budget_envelope" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "subtotal" SET DATA TYPE BIGINT,
ALTER COLUMN "gst_amount" SET DATA TYPE BIGINT,
ALTER COLUMN "total" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "rate_cards" ALTER COLUMN "rate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "referrals" ALTER COLUMN "commission_amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "revrec_ledger" ALTER COLUMN "recognised" SET DATA TYPE BIGINT,
ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "service_units" ALTER COLUMN "starter_price" SET DATA TYPE BIGINT,
ALTER COLUMN "premium_minimum" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "timesheet_lines" ALTER COLUMN "rate" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "wip_ledger" ALTER COLUMN "amount" SET DATA TYPE BIGINT;


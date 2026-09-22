-- Durable checkout sessions.
--
-- The in-progress purchase lived only in Redis under checkout:<sid>. A restart,
-- failover or eviction mid-checkout returned "Session expired" and the customer
-- had to start over -- possibly after the gateway had already charged them.
--
-- consumed_at and result_order_id give POST /checkout/:sid/complete somewhere
-- durable to record that it has already run. Both are written inside the same
-- transaction that provisions the engagement, so a double-submit returns the
-- original result instead of creating a second engagement, order and invoice.
CREATE TABLE IF NOT EXISTS "checkout_sessions" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "user_id" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'GROWTH',
    "step" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "razorpay_order_id" TEXT,
    "consumed_at" TIMESTAMP(3),
    "result_order_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "checkout_sessions_estimate_id_idx" ON "checkout_sessions"("estimate_id");
CREATE INDEX IF NOT EXISTS "checkout_sessions_expires_at_idx" ON "checkout_sessions"("expires_at");

-- A Razorpay order should back exactly one internal Order, and a gateway
-- payment id exactly one internal Payment. Both columns are nullable and
-- Postgres unique indexes already treat NULL as distinct from every other
-- NULL, so existing rows without a gateway reference are unaffected.
CREATE UNIQUE INDEX "orders_razorpay_order_id_key" ON "orders"("razorpay_order_id");
CREATE UNIQUE INDEX "payments_gateway_payment_id_key" ON "payments"("gateway_payment_id");

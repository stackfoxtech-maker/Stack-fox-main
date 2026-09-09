-- The number printed on the tax invoice PDF (AWL/INV/<FY>/NNN).
-- Nullable: existing rows are backfilled lazily the first time their PDF is built.
ALTER TABLE "invoices" ADD COLUMN "invoice_no" TEXT;

CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

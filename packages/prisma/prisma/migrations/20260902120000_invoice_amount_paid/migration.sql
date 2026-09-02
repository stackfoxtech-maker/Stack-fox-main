-- AlterTable: track partial payment and the applied GST rate on each invoice.
ALTER TABLE "invoices" ADD COLUMN     "amount_paid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gst_rate" INTEGER NOT NULL DEFAULT 18;

-- Backfill: any invoice already marked PAID has collected its full grand total.
UPDATE "invoices" SET "amount_paid" = "grand_total" WHERE "status" = 'PAID';

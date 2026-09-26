-- Requires an API/worker maintenance window: old writers use quote rupees.
-- Take and restore-test an off-site backup before applying in production.
BEGIN;
ALTER TABLE quotes ADD COLUMN invoice_id TEXT;
CREATE UNIQUE INDEX quotes_invoice_id_key ON quotes(invoice_id);
UPDATE quotes SET subtotal = subtotal * 100, gst_amount = gst_amount * 100, total = total * 100,
  items = COALESCE((SELECT jsonb_agg(CASE WHEN x ? 'price' THEN jsonb_set(x, '{price}', to_jsonb((x->>'price')::numeric * 100)) ELSE x END) FROM jsonb_array_elements(items::jsonb) x), '[]'::jsonb),
  "estimateRange" = "estimateRange"::jsonb || jsonb_build_object(
    'low', COALESCE(("estimateRange"->>'low')::numeric,0)*100,
    'mid', COALESCE(("estimateRange"->>'mid')::numeric,0)*100,
    'high', COALESCE(("estimateRange"->>'high')::numeric,0)*100),
  "checkoutDetails" = "checkoutDetails"::jsonb || jsonb_build_object(
    'amountPaid', COALESCE(("checkoutDetails"->>'amountPaid')::numeric,0)*100,
    'pendingOrderAmount', COALESCE(("checkoutDetails"->>'pendingOrderAmount')::numeric,0)*100);
ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN invoice_id TEXT REFERENCES invoices(id);
CREATE INDEX payments_invoice_id_idx ON payments(invoice_id);
-- Refuse migration if duplicates exist; never silently discard payment evidence.
CREATE UNIQUE INDEX payments_gateway_gateway_payment_id_key ON payments(gateway, gateway_payment_id);
UPDATE payments p SET invoice_id = i.id FROM invoices i WHERE p.metadata->>'invoiceId' = i.id;
-- NOT VALID preserves old corrupt records for explicit, evidence-based repair.
-- New inserts/updates are checked immediately. Validate after F-2 remediation.
ALTER TABLE invoices ADD CONSTRAINT invoices_paid_amount_check
  CHECK (status <> 'PAID' OR (grand_total > 0 AND amount_paid >= grand_total)) NOT VALID;

CREATE FUNCTION check_paid_invoice_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT;
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN target := NEW.id;
  ELSE target := OLD.invoice_id;
  END IF;
  IF EXISTS (SELECT 1 FROM invoices i WHERE i.id = target AND i.status = 'PAID'
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id=i.id AND p.status='CAPTURED' AND p.amount>0)) THEN
    RAISE EXCEPTION 'Paid invoice % requires captured payment evidence', target USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER invoice_payment_evidence
  AFTER INSERT OR UPDATE ON invoices DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_paid_invoice_evidence();
CREATE CONSTRAINT TRIGGER preserve_invoice_payment_evidence
  AFTER UPDATE OR DELETE ON payments DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_paid_invoice_evidence();
COMMIT;

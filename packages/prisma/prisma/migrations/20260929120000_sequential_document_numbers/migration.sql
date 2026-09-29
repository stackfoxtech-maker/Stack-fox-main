-- Sequential, per-financial-year numbers for tax invoices (INV), contracts (CON) and payment
-- receipts (RCP): AWL/<KIND>/<FY>/NNNN.
--
-- Until now the number printed on an invoice was the last four digits of its random id
-- modulo 1000, contracts had no number, and payments had no receipt number.

CREATE TABLE document_counters (
  kind TEXT NOT NULL,
  fy   TEXT NOT NULL,
  last INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, fy)
);
-- Internal bookkeeping, never a client-facing Supabase resource.
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE contracts ADD COLUMN contract_no TEXT;
CREATE UNIQUE INDEX contracts_contract_no_key ON contracts(contract_no);
ALTER TABLE payments ADD COLUMN receipt_no TEXT;
CREATE UNIQUE INDEX payments_receipt_no_key ON payments(receipt_no);

-- Indian financial year (April to March), in IST, for a timestamp: 2026-27.
CREATE FUNCTION pg_temp.fy_of(ts TIMESTAMPTZ) RETURNS TEXT AS $$
  SELECT CASE WHEN extract(month FROM ts AT TIME ZONE 'Asia/Kolkata') >= 4
              THEN extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int
              ELSE extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int - 1 END
         || '-' ||
         lpad(((CASE WHEN extract(month FROM ts AT TIME ZONE 'Asia/Kolkata') >= 4
                     THEN extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int
                     ELSE extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int - 1 END + 1) % 100)::text, 2, '0');
$$ LANGUAGE sql IMMUTABLE;

-- Backfill in creation order, per financial year. Existing invoices carried a number derived
-- from their random id (AWL/INV/<FY>/<1-3 digits>); those are renumbered. Drafts stay
-- unnumbered until they are issued.
WITH n AS (
  SELECT id,
         'AWL/INV/' || fy || '/' || lpad(row_number() OVER (PARTITION BY fy ORDER BY created_at, id)::text, 4, '0') AS no
  FROM (SELECT id, created_at, pg_temp.fy_of(created_at) AS fy FROM invoices WHERE status <> 'DRAFT') x
)
UPDATE invoices i SET invoice_no = n.no
FROM n
WHERE i.id = n.id
  AND (i.invoice_no IS NULL OR i.invoice_no ~ '^AWL/INV/[0-9]{4}-[0-9]{2}/[0-9]{1,3}$');

WITH n AS (
  SELECT id,
         'AWL/CON/' || fy || '/' || lpad(row_number() OVER (PARTITION BY fy ORDER BY created_at, id)::text, 4, '0') AS no
  FROM (SELECT id, created_at, pg_temp.fy_of(created_at) AS fy FROM contracts) x
)
UPDATE contracts c SET contract_no = n.no FROM n WHERE c.id = n.id;

WITH n AS (
  SELECT id,
         'AWL/RCP/' || fy || '/' || lpad(row_number() OVER (PARTITION BY fy ORDER BY created_at, id)::text, 4, '0') AS no
  FROM (SELECT id, created_at, pg_temp.fy_of(created_at) AS fy FROM payments WHERE status IN ('CAPTURED', 'REFUNDED')) x
)
UPDATE payments p SET receipt_no = n.no FROM n WHERE p.id = n.id;

-- Counters resume after the highest number handed out.
INSERT INTO document_counters (kind, fy, last)
SELECT 'INV', split_part(invoice_no, '/', 3), max(split_part(invoice_no, '/', 4)::int)
FROM invoices WHERE invoice_no ~ '^AWL/INV/[0-9]{4}-[0-9]{2}/[0-9]{4,}$' GROUP BY 1, 2;
INSERT INTO document_counters (kind, fy, last)
SELECT 'CON', split_part(contract_no, '/', 3), max(split_part(contract_no, '/', 4)::int)
FROM contracts WHERE contract_no IS NOT NULL GROUP BY 1, 2;
INSERT INTO document_counters (kind, fy, last)
SELECT 'RCP', split_part(receipt_no, '/', 3), max(split_part(receipt_no, '/', 4)::int)
FROM payments WHERE receipt_no IS NOT NULL GROUP BY 1, 2;

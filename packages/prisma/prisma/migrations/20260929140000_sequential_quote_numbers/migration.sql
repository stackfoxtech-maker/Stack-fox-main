-- Quotes get the same sequential numbers as invoices, contracts and receipts:
-- AWL/QTN/<FY>/NNNN. They were `SF-Q-` plus a random UUID. Existing quotes are renumbered in
-- creation order, per Indian financial year (IST); counters resume after the highest.
-- created_at is a naive UTC timestamp, so it is read as UTC explicitly (not in the session zone).

-- Prisma applies every pending migration on ONE connection, so the pg_temp helper that
-- 20260929120000 created is still there: replace it rather than create it.
CREATE OR REPLACE FUNCTION pg_temp.fy_of(ts TIMESTAMPTZ) RETURNS TEXT AS $$
  SELECT CASE WHEN extract(month FROM ts AT TIME ZONE 'Asia/Kolkata') >= 4
              THEN extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int
              ELSE extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int - 1 END
         || '-' ||
         lpad(((CASE WHEN extract(month FROM ts AT TIME ZONE 'Asia/Kolkata') >= 4
                     THEN extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int
                     ELSE extract(year FROM ts AT TIME ZONE 'Asia/Kolkata')::int - 1 END + 1) % 100)::text, 2, '0');
$$ LANGUAGE sql IMMUTABLE;

WITH n AS (
  SELECT id,
         'AWL/QTN/' || fy || '/' || lpad(row_number() OVER (PARTITION BY fy ORDER BY created_at, id)::text, 4, '0') AS no
  FROM (SELECT id, created_at, pg_temp.fy_of(created_at AT TIME ZONE 'UTC') AS fy FROM quotes) x
)
UPDATE quotes q SET quote_number = n.no FROM n WHERE q.id = n.id AND q.quote_number NOT LIKE 'AWL/QTN/%';

INSERT INTO document_counters (kind, fy, last)
SELECT 'QTN', split_part(quote_number, '/', 3), max(split_part(quote_number, '/', 4)::int)
FROM quotes WHERE quote_number ~ '^AWL/QTN/[0-9]{4}-[0-9]{2}/[0-9]{4,}$' GROUP BY 1, 2
ON CONFLICT (kind, fy) DO UPDATE SET last = GREATEST(document_counters.last, EXCLUDED.last);

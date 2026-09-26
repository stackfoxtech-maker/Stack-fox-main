CREATE TABLE business_mail (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  last_error TEXT
);
CREATE INDEX business_mail_pending_idx ON business_mail(status, next_attempt_at);
-- This is an internal outbox, never a client-facing Supabase resource.
ALTER TABLE business_mail ENABLE ROW LEVEL SECURITY;

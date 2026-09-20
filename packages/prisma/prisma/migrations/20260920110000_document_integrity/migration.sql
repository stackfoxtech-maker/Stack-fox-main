-- Tamper-evidence and an access trail for documents of record.
--
-- Before this: only contracts computed a hash and only contracts got an archive
-- copy, while the contract PDF text claimed the signed copy was retained in
-- write-once storage. And the only audited access anywhere in the system was
-- credential reveal -- every invoice and contract download handed out a signed
-- URL and recorded nothing.
--
-- document_ledger is append-only by convention: nothing in the application
-- updates or deletes a row. A regenerated document with different bytes is a
-- NEW row, and the disagreement between rows is the evidence.
CREATE TABLE IF NOT EXISTS "document_ledger" (
    "id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "archive_key" TEXT,
    "size_bytes" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_ledger_document_type_document_id_idx"
    ON "document_ledger"("document_type", "document_id");
CREATE INDEX IF NOT EXISTS "document_ledger_sha256_idx"
    ON "document_ledger"("sha256");

-- Recorded when the signed URL is ISSUED. The fetch itself goes straight to
-- object storage and never reaches the API, so issuance is the only moment the
-- application can observe.
CREATE TABLE IF NOT EXISTS "document_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_access_document_type_document_id_issued_at_idx"
    ON "document_access"("document_type", "document_id", "issued_at");
CREATE INDEX IF NOT EXISTS "document_access_user_id_issued_at_idx"
    ON "document_access"("user_id", "issued_at");

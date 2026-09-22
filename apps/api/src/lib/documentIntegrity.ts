import { createHash } from "crypto";
import type { FastifyRequest } from "fastify";
import { prisma } from "@stackfox/prisma";
import { getPresignedDownload } from "./storage";

/**
 * Tamper-evidence and an access trail for documents of record.
 *
 * Two gaps this closes.
 *
 * Only contracts computed a `docHash` and only contracts got an archive copy;
 * invoices and accepted quotes got neither — while the contract PDF states that
 * the signed copy is retained in write-once storage as the contract of record.
 *
 * And the only audited access anywhere was credential reveal. Every invoice and
 * contract download returned a signed URL and recorded nothing, so "who
 * accessed this contract, and when?" had no answer. That is question one in an
 * enterprise security review.
 */

export type DocumentType =
  "INVOICE" | "CONTRACT" | "QUOTE" | "REPORT" | "FILE" | "ESTIMATE" | "HANDOVER";

/**
 * Signed-URL lifetime.
 *
 * Was 3600s. A URL that leaks into a chat message, a proxy log or a Referer
 * header stayed usable for a full hour. The client asks for the URL immediately
 * before navigating, so a short window costs nothing in practice.
 */
export const DOWNLOAD_TTL_SEC = 120;

export function sha256(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Records that a document of record was generated, with the hash of the exact
 * bytes written. Append-only: a regenerated document is a NEW row, and the
 * disagreement between rows is what makes tampering visible.
 */
export async function recordDocument(input: {
  documentType: DocumentType;
  documentId: string;
  bytes: Buffer;
  storageKey: string;
  archiveKey?: string;
}): Promise<string> {
  const digest = sha256(input.bytes);
  await prisma.documentLedger.create({
    data: {
      documentType: input.documentType,
      documentId: input.documentId,
      sha256: digest,
      storageKey: input.storageKey,
      archiveKey: input.archiveKey,
      sizeBytes: input.bytes.length,
    },
  });
  return digest;
}

/**
 * Issues a short-lived download URL AND records who asked for it.
 *
 * Every caller that hands a document to a human should go through here rather
 * than calling getPresignedDownload directly — the audit trail is only as
 * complete as its least disciplined call site.
 *
 * The write is best-effort: failing to log must not deny a client their own
 * invoice. It is logged loudly instead, because a silently empty audit trail is
 * worse than a noisy one.
 */
export async function issueDownload(
  req: FastifyRequest,
  opts: {
    documentType: DocumentType;
    documentId: string;
    storageKey: string;
    expiresIn?: number;
    /** Read the write-once bucket rather than the primary one. */
    archive?: boolean;
  },
): Promise<string> {
  const url = await getPresignedDownload(
    opts.storageKey,
    opts.expiresIn ?? DOWNLOAD_TTL_SEC,
    {
      archive: opts.archive,
    },
  );

  try {
    await prisma.documentAccess.create({
      data: {
        userId: req.user?.sub,
        documentType: opts.documentType,
        documentId: opts.documentId,
        storageKey: opts.storageKey,
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
      },
    });
  } catch (err) {
    req.log.error(
      { err, documentType: opts.documentType, documentId: opts.documentId },
      "Document access could not be recorded — the audit trail is incomplete",
    );
  }

  return url;
}

/**
 * Re-reads a document from storage and compares it against the ledger.
 *
 * This is the endpoint you reach for in a dispute, so it is deliberately
 * explicit about the three distinct outcomes rather than returning a boolean:
 * "matches", "differs" and "no ledger entry" mean very different things.
 */
export async function verifyDocument(
  documentType: DocumentType,
  documentId: string,
): Promise<
  | { status: "MATCH"; sha256: string; generatedAt: Date }
  | { status: "MISMATCH"; expected: string; actual: string; generatedAt: Date }
  | { status: "NO_LEDGER_ENTRY" }
  | { status: "UNREADABLE"; reason: string }
> {
  const entry = await prisma.documentLedger.findFirst({
    where: { documentType, documentId },
    orderBy: { generatedAt: "desc" },
  });
  if (!entry) return { status: "NO_LEDGER_ENTRY" };

  let bytes: Buffer;
  try {
    const { downloadFromStorage } = await import("./storage");
    bytes = await downloadFromStorage(entry.storageKey);
  } catch (err) {
    return { status: "UNREADABLE", reason: (err as Error).message };
  }

  const actual = sha256(bytes);
  return actual === entry.sha256
    ? { status: "MATCH", sha256: actual, generatedAt: entry.generatedAt }
    : {
        status: "MISMATCH",
        expected: entry.sha256,
        actual,
        generatedAt: entry.generatedAt,
      };
}

/**
 * Storage keys the retention worker must never delete.
 *
 * workers/archiveRetention.ts hard-deletes objects past FILE_RETENTION_DAYS
 * (default 365). It queries `prisma.file`, and invoice/contract PDFs live on
 * Invoice.fileKey and Contract.fileKey, so today it does not reach them — but
 * that is luck, not design. One refactor moving PDFs into the File table turns
 * a cleanup job into a compliance incident.
 */
export async function isRetainedDocument(storageKey: string): Promise<boolean> {
  const hit = await prisma.documentLedger.findFirst({
    where: { OR: [{ storageKey }, { archiveKey: storageKey }] },
    select: { id: true },
  });
  return Boolean(hit);
}

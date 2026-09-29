/**
 * Sequential numbers for the documents StackFox issues:
 *
 *   AWL/INV/2026-27/0001   tax invoice
 *   AWL/CON/2026-27/0001   contract
 *   AWL/RCP/2026-27/0001   payment receipt
 *
 * One series per kind per Indian financial year (April to March, IST). Each number comes from
 * an atomic upsert on `document_counters`, so two requests can never receive the same one, and
 * when the caller passes its transaction the number rolls back with it (no gap for an order
 * that failed). A number is assigned once and then never changes.
 *
 * The numbers used to be random: an invoice's printed number was the last four digits of its
 * random id modulo 1000, contracts had none, and payments had no receipt.
 */
import { prisma } from "@stackfox/prisma";

export type DocKind = "INV" | "CON" | "RCP";

/** Anything that can run a raw query: the client, or a transaction handed to the caller. */
type RawDb = Pick<typeof prisma, "$queryRaw">;

/** Indian financial year of an instant, in IST: 2026-27 runs 1 Apr 2026 to 31 Mar 2027. */
export function financialYear(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 3_600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatDocNumber(kind: DocKind, fy: string, n: number): string {
  return `AWL/${kind}/${fy}/${String(n).padStart(4, "0")}`;
}

/** Hands out the next number in the series. Pass a transaction to make it atomic with the row. */
export async function nextDocNumber(
  db: RawDb,
  kind: DocKind,
  date: Date = new Date(),
): Promise<string> {
  const fy = financialYear(date);
  const rows = await db.$queryRaw<Array<{ last: number }>>`
    INSERT INTO document_counters (kind, fy, last) VALUES (${kind}, ${fy}, 1)
    ON CONFLICT (kind, fy) DO UPDATE SET last = document_counters.last + 1
    RETURNING last`;
  return formatDocNumber(kind, fy, Number(rows[0].last));
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Gives a row its number if it has none, once. The advisory lock serialises concurrent first
 * calls for the same row so only one of them consumes a number; the rest read the winner's.
 */
async function ensureNo(
  db: Tx | typeof prisma,
  kind: DocKind,
  id: string,
  read: (tx: Tx) => Promise<{ no: string | null } | null>,
  write: (tx: Tx, no: string) => Promise<unknown>,
): Promise<string | null> {
  const run = async (tx: Tx): Promise<string | null> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}-no:${id}`}))`;
    const row = await read(tx);
    if (!row) return null;
    if (row.no) return row.no;
    const no = await nextDocNumber(tx, kind);
    await write(tx, no);
    return no;
  };
  return "$transaction" in db ? db.$transaction((tx) => run(tx)) : run(db);
}

/**
 * The invoice's number, assigning one if it has none yet. A draft gets its number when it is
 * first issued, so a discarded draft never leaves a hole in the series.
 */
export function ensureInvoiceNo(db: Tx | typeof prisma, id: string) {
  return ensureNo(
    db,
    "INV",
    id,
    async (tx) => {
      const r = await tx.invoice.findUnique({
        where: { id },
        select: { invoiceNo: true },
      });
      return r && { no: r.invoiceNo };
    },
    (tx, no) => tx.invoice.update({ where: { id }, data: { invoiceNo: no } }),
  );
}

export function ensureContractNo(db: Tx | typeof prisma, id: string) {
  return ensureNo(
    db,
    "CON",
    id,
    async (tx) => {
      const r = await tx.contract.findUnique({
        where: { id },
        select: { contractNo: true },
      });
      return r && { no: r.contractNo };
    },
    (tx, no) => tx.contract.update({ where: { id }, data: { contractNo: no } }),
  );
}

export function ensureReceiptNo(db: Tx | typeof prisma, id: string) {
  return ensureNo(
    db,
    "RCP",
    id,
    async (tx) => {
      const r = await tx.payment.findUnique({
        where: { id },
        select: { receiptNo: true },
      });
      return r && { no: r.receiptNo };
    },
    (tx, no) => tx.payment.update({ where: { id }, data: { receiptNo: no } }),
  );
}

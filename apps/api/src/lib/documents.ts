import { createHash } from "crypto";
import { prisma } from "@stackfox/prisma";
import { uploadFile, copyToWorm } from "./storage";
import { recordDocument } from "./documentIntegrity";
import { renderAgreementPack, type PackContract, type Pack } from "./contractPdf";
import { PACK_ORDER } from "./contractText";
import { inr2 } from "./companyInvoice";
import { log } from "./logger";
import { ensureContractNo, ensureInvoiceNo, ensureReceiptNo } from "./docNumber";
import { renderReceiptPdf } from "./receiptPdf";
import {
  renderCompanyInvoicePdf,
  SUPPLIER,
  type CompanyInvoiceLine,
} from "./companyInvoice";

/**
 * Document rendering shared by the docGen worker and the client-facing download
 * routes.
 *
 * The worker used to own this code outright, which meant a PDF existed only if
 * its queue job had run and succeeded. When it hadn't — a job dropped on a
 * redeploy, an invoice created by a path that never enqueued one — the client
 * portal had no file to offer and simply hid the download. Building here lets
 * `GET /invoices/:id/pdf` and `GET /contracts/:id/pdf` regenerate on demand, so
 * the document is always reachable from the panel.
 */

export function invoiceKey(inv: { id: string; engagementId: string | null }): string {
  return `invoices/${inv.engagementId ?? "unassigned"}/${inv.id}.pdf`;
}

export function contractKey(c: { id: string; engagementId: string | null }): string {
  return `contracts/${c.engagementId ?? "unassigned"}/${c.id}.pdf`;
}

/**
 * Renders (or re-renders) an invoice, stores it, and records the key on the
 * row. Re-rendering matters after payment: the stored copy then shows the
 * amount received and the nil balance rather than the original demand.
 * Returns the storage key, or null when the invoice does not exist.
 */
export async function buildInvoicePdf(
  invoiceId: string,
  opts: { description?: string } = {},
): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { org: true, engagement: true },
  });
  if (!invoice) return null;

  // Invoice carries only `orderId` (no relation), so the order is a second read
  // and is optional — it only supplies a nicer line description.
  const order = invoice.orderId
    ? await prisma.order.findUnique({
        where: { id: invoice.orderId },
        select: { projectName: true },
      })
    : null;

  // Money is stored in paise; the printed document is in rupees.
  const P = (paise: number | bigint) => Math.round(Number(paise)) / 100;

  const paid =
    invoice.status === "PAID"
      ? Number(invoice.grandTotal)
      : Math.min(
          Math.max(0, Number(invoice.amountPaid ?? 0)),
          Number(invoice.grandTotal),
        );
  const rate = invoice.gstRate ?? 18;
  const isInterState = invoice.gstType === "IGST";

  // The printed number is assigned once and never changes: reissuing a tax invoice under a new
  // number would break the buyer's ITC trail. It normally already exists (set when the invoice
  // was issued); a draft that reaches a PDF first is numbered here, from the same series.
  const printedNo =
    invoice.invoiceNo ?? (await ensureInvoiceNo(prisma, invoice.id)) ?? invoice.id;

  const billing = (invoice.org?.billingAddress ?? {}) as Record<string, unknown>;
  const addressLine = [billing.line1, billing.city, billing.state, billing.pincode]
    .filter((v) => typeof v === "string" && v.trim())
    .join(", ");

  const description =
    opts.description ??
    order?.projectName ??
    (invoice.milestoneRef
      ? `Professional services - milestone ${invoice.milestoneRef}`
      : "Professional services");

  const lines: CompanyInvoiceLine[] = [
    {
      name: description,
      sacCode: invoice.sacCode || "998314",
      sacDesc: "IT Software Dev",
      qty: 1,
      unit: "Nos",
      rate: P(invoice.subtotal),
      discount: 0,
      amount: P(invoice.subtotal),
    },
  ];

  const pdf = await renderCompanyInvoicePdf({
    invoiceNo: printedNo,
    date: invoice.createdAt,
    dueDate: invoice.dueDate,
    isInterState,
    gstRate: rate,
    recipient: {
      name: invoice.org?.name ?? "Client",
      email: invoice.org?.contactEmail ?? undefined,
      phone: invoice.org?.contactPhone ?? undefined,
      gstin: invoice.org?.gstin ?? undefined,
      address: addressLine || undefined,
      stateName: isInterState ? undefined : SUPPLIER.stateName,
      stateCode:
        invoice.org?.gstin?.slice(0, 2) ||
        (isInterState ? undefined : SUPPLIER.stateCode),
    },
    lines,
    subtotal: P(invoice.subtotal),
    cgst: P(invoice.cgst),
    sgst: P(invoice.sgst),
    igst: P(invoice.igst),
    payable: P(invoice.grandTotal),
    amountPaid: P(paid),
    status: invoice.status,
  });

  const key = invoiceKey(invoice);
  const invoiceArchiveKey = `invoices/${invoice.id}.worm.pdf`;
  await uploadFile(key, pdf, "application/pdf");

  // Invoices previously got neither a content hash nor an archive copy — only
  // contracts did. An invoice is a document of record too.
  let invoiceArchived: string | undefined;
  try {
    await copyToWorm(invoiceArchiveKey, pdf);
    invoiceArchived = `worm/${invoiceArchiveKey}`;
  } catch (err) {
    log().error({ err, invoiceId: invoice.id }, "archive copy failed");
  }

  // The hash lives in the ledger, not on the invoice row — Invoice has no
  // docHash column and does not need one, since document_ledger is the record.
  await recordDocument({
    documentType: "INVOICE",
    documentId: invoice.id,
    bytes: pdf,
    storageKey: key,
    archiveKey: invoiceArchived,
  });

  await prisma.invoice.update({ where: { id: invoice.id }, data: { fileKey: key } });
  return key;
}

const packKey = (engagementId: string) => `contracts/${engagementId}/agreement-pack.pdf`;

function addressLine(a: unknown): string | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  const parts = [o.line1, o.line2, o.street, o.city, o.state, o.pincode ?? o.postalCode]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

const paise = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
};

/** Everything a contract's wording and signature blocks are filled from. */
async function loadPack(
  engagementId: string,
  only?: string,
  cover = true,
): Promise<Pack | null> {
  const eng = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      contracts: {
        include: { signatures: { include: { signer: { select: { name: true } } } } },
      },
      projects: {
        include: {
          milestones: { orderBy: { number: "asc" } },
          service: { select: { name: true } },
        },
      },
    },
  });
  if (!eng) return null;

  // Every contract carries its printed number by now; number any that predate that.
  for (const c of eng.contracts)
    if (!c.contractNo) c.contractNo = (await ensureContractNo(prisma, c.id)) ?? c.id;

  const commercial = (eng.commercial ?? {}) as Record<string, unknown>;
  const total = paise(commercial.total);
  const tax = paise(commercial.gst);
  const schedule = (eng.projects[0]?.milestones ?? []).map((m) => ({
    name: m.name,
    pct: m.paymentPct,
  }));
  const rounds = eng.projects.flatMap((p) => p.milestones.map((m) => m.maxRounds));
  const context = {
    clientName: eng.client.name,
    clientKind: eng.client.type,
    clientGstin: eng.client.gstin,
    clientAddress: addressLine(eng.client.billingAddress),
    engagementId: eng.id,
    projects: eng.projects.map((p) => p.name || p.service?.name || p.id),
    schedule,
    feeTotal: total ? `Rs ${inr2(total)}` : null,
    feeTax: tax ? `Rs ${inr2(tax)}` : null,
    revisionRounds: rounds.length ? Math.min(...rounds) : 2,
    effectiveDate: "",
  };

  const rank = (t: string) =>
    PACK_ORDER.includes(t) ? PACK_ORDER.indexOf(t) : PACK_ORDER.length;
  const contracts: PackContract[] = eng.contracts
    .filter((c) => !only || c.id === only)
    .sort(
      (a, b) =>
        rank(a.type) - rank(b.type) || a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map((c) => ({
      id: c.id,
      contractNo: c.contractNo ?? c.id,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt,
      executedAt: c.executedAt,
      signatures: c.signatures.map((sg) => {
        const ev = (sg.evidence ?? {}) as Record<string, unknown>;
        return {
          side: sg.side,
          name: typeof ev.name === "string" ? ev.name : (sg.signer?.name ?? undefined),
          signedAt: sg.signedAt,
        };
      }),
      context,
    }));

  return {
    clientName: eng.client.name,
    clientKind: eng.client.type,
    clientGstin: eng.client.gstin,
    clientAddress: addressLine(eng.client.billingAddress),
    engagementId: eng.id,
    generatedOn: new Date(),
    contracts,
    cover,
  };
}

/**
 * One PDF holding every contract of an engagement: a cover with the contents,
 * then each contract on its own pages with its own signature block.
 *
 * It is rebuilt on every request rather than cached, because it must show the
 * signatures as they stand now; each build is recorded in the document ledger.
 * Returns the storage key, or null when the engagement has no contracts.
 */
export async function buildAgreementPack(engagementId: string): Promise<string | null> {
  const pack = await loadPack(engagementId);
  if (!pack || pack.contracts.length === 0) return null;

  const pdf = await renderAgreementPack(pack);
  const key = packKey(engagementId);
  await uploadFile(key, pdf, "application/pdf");
  await recordDocument({
    documentType: "CONTRACT",
    documentId: `pack:${engagementId}`,
    bytes: pdf,
    storageKey: key,
  });
  return key;
}

/**
 * Renders (or re-renders) one contract, stores it, and records the key on the
 * row. The executed copy is also placed in write-once storage.
 */
export async function buildContractPdf(contractId: string): Promise<string | null> {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return null;
  if (!contract.engagementId) return null;

  const pack = await loadPack(contract.engagementId, contract.id, false);
  if (!pack || pack.contracts.length === 0) return null;

  const pdf = await renderAgreementPack(pack);
  const key = contractKey(contract);
  const wormKey = `contracts/${contract.engagementId}/${contract.id}.worm.pdf`;
  const docHash = createHash("sha256").update(pdf).digest("hex");

  await uploadFile(key, pdf, "application/pdf");

  // If the archive copy never landed, nothing would say so while the contract
  // text asserts the signed copy is retained. Surface it.
  let contractArchived: string | undefined;
  try {
    await copyToWorm(wormKey, pdf);
    contractArchived = `worm/${wormKey}`;
  } catch (err) {
    log().error({ err, contractId: contract.id }, "archive copy failed");
  }

  await recordDocument({
    documentType: "CONTRACT",
    documentId: contract.id,
    bytes: pdf,
    storageKey: key,
    archiveKey: contractArchived,
  });
  await prisma.contract.update({
    where: { id: contract.id },
    data: { fileKey: key, wormKey, docHash },
  });

  return key;
}

export function receiptKey(p: { id: string; invoiceId: string | null }): string {
  return `receipts/${p.invoiceId ?? "unassigned"}/${p.id}.pdf`;
}

/**
 * Renders the receipt for one captured payment and stores it. The receipt is a record of what
 * was received at that moment, so the balance shown is the invoice's position right after this
 * payment, not today's. Returns the storage key, or null when there is no such payment.
 */
export async function buildReceiptPdf(paymentId: string): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { org: true } } },
  });
  if (!payment || !["CAPTURED", "REFUNDED"].includes(payment.status)) return null;

  const receiptNo =
    payment.receiptNo ?? (await ensureReceiptNo(prisma, payment.id)) ?? payment.id;
  const rupees = (v: bigint | number) => Math.round(Number(v)) / 100;

  let invoice: { invoiceNo: string; total: number; balance: number } | null = null;
  if (payment.invoice) {
    const inv = payment.invoice;
    const invoiceNo = inv.invoiceNo ?? (await ensureInvoiceNo(prisma, inv.id)) ?? inv.id;
    const upTo = await prisma.payment.aggregate({
      where: {
        invoiceId: inv.id,
        status: "CAPTURED",
        OR: [
          { createdAt: { lt: payment.createdAt } },
          { createdAt: payment.createdAt, id: { lte: payment.id } },
        ],
      },
      _sum: { amount: true },
    });
    const total = rupees(inv.grandTotal);
    invoice = {
      invoiceNo,
      total,
      balance: Math.max(0, total - rupees(upTo._sum.amount ?? 0)),
    };
  }

  const org = payment.invoice?.org;
  const pdf = await renderReceiptPdf({
    receiptNo,
    receivedOn: payment.createdAt,
    amount: rupees(payment.amount),
    method: payment.method,
    gateway: payment.gateway,
    reference: payment.gatewayPaymentId,
    payer: {
      name: org?.name ?? "Client",
      email: org?.contactEmail,
      gstin: org?.gstin,
    },
    invoice,
  });

  const key = receiptKey(payment);
  await uploadFile(key, pdf, "application/pdf");
  await recordDocument({
    documentType: "RECEIPT",
    documentId: payment.id,
    bytes: pdf,
    storageKey: key,
  });
  return key;
}

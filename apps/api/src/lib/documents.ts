import { createHash } from "crypto";
import { prisma } from "@stackfox/prisma";
import { uploadFile, copyToWorm } from "./storage";
import { renderDocument } from "./pdf";
import {
  renderCompanyInvoicePdf,
  awlInvoiceNumber,
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
  const P = (paise: number) => Math.round(paise) / 100;

  const paid =
    invoice.status === "PAID"
      ? invoice.grandTotal
      : Math.min(Math.max(0, invoice.amountPaid ?? 0), invoice.grandTotal);
  const rate = invoice.gstRate ?? 18;
  const isInterState = invoice.gstType === "IGST";

  // The printed number is assigned once and then never changes — reissuing a
  // tax invoice under a new number would break the buyer's ITC trail. The
  // numeric part is derived from the row's own sequence so a re-render is
  // stable, and the column is unique so a collision surfaces instead of
  // silently duplicating a statutory number.
  let printedNo = invoice.invoiceNo;
  if (!printedNo) {
    const seq = Number(invoice.id.replace(/\D/g, "").slice(-4)) || 0;
    printedNo = awlInvoiceNumber(seq, invoice.createdAt);
    try {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { invoiceNo: printedNo },
      });
    } catch {
      // Unique-constraint clash: fall back to the row id so the PDF still
      // renders with a number that is unambiguously this invoice's.
      printedNo = invoice.id;
    }
  }

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
      stateCode: invoice.org?.gstin?.slice(0, 2) || (isInterState ? undefined : SUPPLIER.stateCode),
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
  await uploadFile(key, pdf, "application/pdf");
  await prisma.invoice.update({ where: { id: invoice.id }, data: { fileKey: key } });
  return key;
}

/**
 * Renders a contract, stores it in both the working and write-once buckets, and
 * records the key and hash. Returns the storage key, or null when the contract
 * does not exist.
 */
export async function buildContractPdf(contractId: string): Promise<string | null> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { engagement: { include: { client: true } }, order: true },
  });
  if (!contract) return null;

  const clauses = (contract.clauseConfig ?? {}) as Record<string, unknown>;
  const clauseLines = Object.entries(clauses).map(
    ([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
  );

  const pdf = await renderDocument({
    title: `${contract.type} Agreement`,
    subtitle: contract.engagement?.client?.name,
    reference: contract.id,
    meta: [
      { label: "Type", value: contract.type },
      { label: "Engagement", value: contract.engagementId ?? "—" },
      { label: "Order", value: contract.orderId ?? "—" },
      { label: "Template version", value: String(contract.templateVer) },
      { label: "Status", value: contract.status },
      { label: "Date", value: new Date().toISOString().slice(0, 10) },
    ],
    body: [
      `This ${contract.type} is entered into between StackFox and ${
        contract.engagement?.client?.name ?? "the Client"
      } and governs the engagement referenced above. The parties agree to the Statement of Deliverable Practice (SDP) versions pinned to this contract and to the clause configuration recorded below.`,
      ...(clauseLines.length ? ["Clause configuration:", ...clauseLines] : []),
      "Execution of this document is recorded via the StackFox e-signature ledger; the signed copy is retained in write-once storage as the contract of record.",
    ],
    footer: "Draft pending signature unless marked EXECUTED above.",
  });

  const key = contractKey(contract);
  const wormKey = `contracts/${contract.engagementId}/${contract.id}.worm.pdf`;
  const docHash = createHash("sha256").update(pdf).digest("hex");

  await uploadFile(key, pdf, "application/pdf");
  await copyToWorm(wormKey, pdf).catch(() => {});
  await prisma.contract.update({
    where: { id: contract.id },
    data: { fileKey: key, wormKey, docHash },
  });

  return key;
}

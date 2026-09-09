import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { uploadFile } from "../lib/storage";
import { emitEvent } from "../lib/events";
import { renderDocument, inr, type DocLineItem } from "../lib/pdf";
import { buildInvoicePdf, buildContractPdf } from "../lib/documents";
import * as ids from "../lib/id";
import { resolveGstType, splitGst } from "../lib/gst";

const GST_RATE = 0.18;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

createWorker(QUEUE.docGen, async (job) => {
  const { type } = job.data;

  // ── Milestone invoice ──────────────────────────────────────────────────────
  // Emitted when a milestone is approved. Creates the Invoice row (if it does
  // not exist yet) and the PDF, so milestone billing is a real artifact rather
  // than an event with nothing behind it.
  if (type === "milestone-invoice") {
    const { projectId, milestoneNumber, engagementId } = job.data;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { engagement: { include: { client: true } }, milestones: true },
    });
    if (!project?.engagement) return;

    const milestone = project.milestones.find((m) => m.number === milestoneNumber);
    if (!milestone) return;

    const milestoneRef = `M${milestoneNumber}`;
    const commercial = (project.engagement.commercial ?? {}) as Record<string, unknown>;
    const engagementGrand = num(commercial.grand);
    const invoiceGross = Math.round((engagementGrand * milestone.paymentPct) / 100);
    const subtotal = Math.round(invoiceGross / (1 + GST_RATE));
    const gstType = resolveGstType(project.engagement.client);
    const { cgst, sgst, igst } = splitGst(invoiceGross - subtotal, gstType);

    let invoice = await prisma.invoice.findFirst({
      where: { engagementId: project.engagementId, milestoneRef },
    });

    if (!invoice && invoiceGross > 0) {
      invoice = await prisma.invoice.create({
        data: {
          id: ids.invoiceId(),
          orderId: project.orderId,
          engagementId: project.engagementId,
          orgId: project.engagement.clientId,
          milestoneRef,
          sacCode: "998314",
          gstType,
          subtotal,
          cgst,
          sgst,
          igst,
          grandTotal: invoiceGross,
          status: "SENT",
          dueDate: new Date(Date.now() + 7 * 86400000),
        },
      });
      await emitEvent({
        code: "INVOICE_CREATED",
        payload: { invoiceId: invoice.id, milestoneRef, projectId },
        actor: "system",
        engagementId: project.engagementId ?? undefined,
        projectId,
      });
    }

    const key = invoice
      ? await buildInvoicePdf(invoice.id, {
          description: `${milestone.name} — milestone ${milestoneNumber} (${milestone.paymentPct}%)`,
        })
      : null;

    await emitEvent({
      code: "INVOICE_GENERATED",
      payload: { projectId, milestoneNumber, invoiceId: invoice?.id, key },
      actor: "system",
      engagementId: engagementId ?? project.engagementId ?? undefined,
      projectId,
    });
    return;
  }

  // ── Contract ───────────────────────────────────────────────────────────────
  if (type === "contract") {
    const { contractId } = job.data;
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) return;

    const key = await buildContractPdf(contract.id);
    if (!key) return;

    await emitEvent({
      code: "CONTRACT_GENERATED",
      payload: { contractId: contract.id, key },
      actor: "system",
      engagementId: contract.engagementId ?? undefined,
    });
    return;
  }

  // ── Standalone invoice ─────────────────────────────────────────────────────
  // Every path that creates or settles an Invoice enqueues this, so the row
  // always has a downloadable PDF behind it — checkout's first invoice had
  // none at all, and a paid invoice kept showing its original balance.
  if (type === "invoice") {
    const { invoiceId } = job.data as { invoiceId: string };
    const key = await buildInvoicePdf(invoiceId);
    if (!key) return;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    await emitEvent({
      code: "INVOICE_GENERATED",
      payload: { invoiceId, key },
      actor: "system",
      engagementId: invoice?.engagementId ?? undefined,
    });
    return;
  }

  // ── Estimate ───────────────────────────────────────────────────────────────
  // routes/estimates.ts enqueues this with type "estimate"; keep "estimate-pdf"
  // working too since older jobs / callers use that.
  if (type === "estimate" || type === "estimate-pdf") {
    const estimateId = job.data.estimateId as string;
    const estimate = await prisma.estimate.findUnique({ where: { id: estimateId } });
    if (!estimate) return;

    const t = (estimate.totals ?? {}) as Record<string, unknown>;
    const pdf = await renderDocument({
      title: "Project Estimate",
      reference: estimate.id,
      meta: [
        { label: "Rate version", value: estimate.rateVersion },
        { label: "Status", value: estimate.status },
        { label: "Valid until", value: estimate.lockedUntil.toISOString().slice(0, 10) },
      ],
      lineItems: [
        { desc: "Base", amount: inr(num(t.base)) },
        { desc: "Features", amount: inr(num(t.features)) },
        { desc: "Custom", amount: inr(num(t.custom)) },
        { desc: "Discount", amount: inr(-Math.abs(num(t.discount))) },
        { desc: "GST", amount: inr(num(t.gst)) },
      ],
      total: { desc: "Grand total", amount: inr(num(t.grand)) },
      footer: "Indicative estimate. Final commercials are fixed at contract.",
    });

    const key = `estimates/${estimate.id}.pdf`;
    await uploadFile(key, pdf, "application/pdf");
    await emitEvent({
      code: "ESTIMATE_PDF_GENERATED",
      payload: { estimateId: estimate.id, key },
      actor: "system",
    });
    return;
  }

  // ── Sales proposal ─────────────────────────────────────────────────────────
  if (type === "proposal") {
    const proposal = await prisma.proposal.findUnique({
      where: { id: job.data.proposalId },
      include: { lead: true },
    });
    if (!proposal) return;

    const pkgs = (proposal.packages ?? {}) as Record<string, unknown>;
    const lines: DocLineItem[] = Object.entries(pkgs)
      .filter(([, v]) => v)
      .map(([k, v]) => ({
        desc: k.replace(/^\w/, (c) => c.toUpperCase()),
        amount: typeof v === "object" ? "" : String(v),
      }));

    const range = proposal.totalMin === proposal.totalMax
      ? inr(proposal.totalMax)
      : `${inr(proposal.totalMin)} – ${inr(proposal.totalMax)}`;

    const pdf = await renderDocument({
      title: "Proposal",
      subtitle: proposal.lead.company ?? proposal.lead.name,
      reference: proposal.id,
      meta: [
        { label: "Prepared for", value: proposal.lead.ownerName ?? proposal.lead.name },
        { label: "Business", value: proposal.lead.company ?? "—" },
        { label: "Date", value: new Date().toISOString().slice(0, 10) },
      ],
      lineItems: lines.length ? lines : undefined,
      total: { desc: "Estimated investment", amount: range },
      body: proposal.notes ? [proposal.notes] : undefined,
      footer: "Indicative pricing. Final scope and cost are confirmed at contract.",
    });

    const key = `proposals/${proposal.leadId}/${proposal.id}.pdf`;
    await uploadFile(key, pdf, "application/pdf");
    await prisma.proposal.update({ where: { id: proposal.id }, data: { fileKey: key } });
    await emitEvent({
      code: "PROPOSAL_PDF_GENERATED",
      payload: { proposalId: proposal.id, leadId: proposal.leadId, key },
      actor: "system",
    });
    return;
  }
});

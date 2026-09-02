import { createHash } from "crypto";
import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { uploadFile, copyToWorm } from "../lib/storage";
import { emitEvent } from "../lib/events";
import { renderDocument, inr, type DocLineItem } from "../lib/pdf";
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

    const items: DocLineItem[] = [
      {
        desc: `${milestone.name} — milestone ${milestoneNumber} (${milestone.paymentPct}%)`,
        amount: inr(invoice ? invoice.subtotal : subtotal),
      },
      ...(gstType === "CGST_SGST"
        ? [
            { desc: `CGST @ ${GST_RATE * 50}%`, amount: inr(invoice ? invoice.cgst : cgst) },
            { desc: `SGST @ ${GST_RATE * 50}%`, amount: inr(invoice ? invoice.sgst : sgst) },
          ]
        : [{ desc: `IGST @ ${Math.round(GST_RATE * 100)}%`, amount: inr(invoice ? invoice.igst : igst) }]),
    ];

    const pdf = await renderDocument({
      title: "Tax Invoice",
      subtitle: project.engagement.client?.name,
      reference: invoice?.id ?? `${project.id}/${milestoneRef}`,
      meta: [
        { label: "Engagement", value: project.engagementId ?? "—" },
        { label: "Project", value: project.id },
        { label: "Milestone", value: `${milestone.name} (#${milestoneNumber})` },
        { label: "SAC code", value: "998314" },
        { label: "Date", value: new Date().toISOString().slice(0, 10) },
      ],
      lineItems: items,
      total: { desc: "Amount due", amount: inr(invoice ? invoice.grandTotal : invoiceGross) },
      footer: "Payable within 7 days. This is a computer-generated invoice.",
    });

    const key = invoice
      ? `invoices/${project.engagementId}/${invoice.id}.pdf`
      : `invoices/${project.engagementId}/${projectId}/${milestoneRef}.pdf`;
    await uploadFile(key, pdf, "application/pdf");

    if (invoice) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { fileKey: key } });
    }

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
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { engagement: { include: { client: true } }, order: true },
    });
    if (!contract) return;

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

    const key = `contracts/${contract.engagementId}/${contract.id}.pdf`;
    const wormKey = `contracts/${contract.engagementId}/${contract.id}.worm.pdf`;
    const docHash = createHash("sha256").update(pdf).digest("hex");

    await uploadFile(key, pdf, "application/pdf");
    await copyToWorm(wormKey, pdf).catch(() => {});

    await prisma.contract.update({
      where: { id: contract.id },
      data: { fileKey: key, wormKey, docHash },
    });

    await emitEvent({
      code: "CONTRACT_GENERATED",
      payload: { contractId: contract.id, key, docHash },
      actor: "system",
      engagementId: contract.engagementId ?? undefined,
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

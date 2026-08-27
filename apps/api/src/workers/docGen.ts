import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { uploadFile, copyToWorm } from "../lib/storage";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.docGen, async (job) => {
  const { type, engagementId, projectId, milestoneNumber, orderId, contractId } = job.data;

  if (type === "milestone-invoice") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { engagement: true, milestones: true },
    });
    if (!project) return;

    const milestone = project.milestones.find((m) => m.number === milestoneNumber);
    if (!milestone) return;

    const pdfContent = Buffer.from(
      JSON.stringify({
        type: "milestone-invoice",
        project: project.id,
        milestone: milestone.name,
        number: milestoneNumber,
        paymentPct: milestone.paymentPct,
        generatedAt: new Date().toISOString(),
      })
    );

    const key = `invoices/${engagementId}/${projectId}/milestone-${milestoneNumber}.pdf`;
    await uploadFile(key, pdfContent, "application/pdf");

    await emitEvent({
      code: "INVOICE_GENERATED",
      payload: { projectId, milestoneNumber, key },
      actor: "system",
      engagementId,
      projectId,
    });
  }

  if (type === "contract") {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) return;

    const pdfContent = Buffer.from(
      JSON.stringify({
        type: "contract",
        contractId,
        contractType: contract.type,
        generatedAt: new Date().toISOString(),
      })
    );

    const key = `contracts/${engagementId}/${contractId}.pdf`;
    await uploadFile(key, pdfContent, "application/pdf");
    await copyToWorm(key, pdfContent);

    await prisma.contract.update({
      where: { id: contractId },
      data: { fileKey: key },
    });

    await emitEvent({
      code: "CONTRACT_GENERATED",
      payload: { contractId, key },
      actor: "system",
      engagementId,
    });
  }

  if (type === "estimate-pdf") {
    const key = `estimates/${job.data.estimateId}.pdf`;
    await uploadFile(key, Buffer.from(JSON.stringify(job.data)), "application/pdf");
  }
});

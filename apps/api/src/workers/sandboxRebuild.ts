import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.sandboxRebuild, async (job) => {
  const { sdpVersionId } = job.data;

  const sdp = await prisma.sdpVersion.findUnique({
    where: { id: sdpVersionId },
    include: { service: true },
  });
  if (!sdp) return;

  // Rebuild sandbox preview for the SDP version
  await prisma.sdpVersion.update({
    where: { id: sdpVersionId },
    data: {
      sandboxStatus: "BUILDING",
    },
  });

  // Simulate sandbox build
  await new Promise((r) => setTimeout(r, 2000));

  await prisma.sdpVersion.update({
    where: { id: sdpVersionId },
    data: {
      sandboxStatus: "READY",
      sandboxUrl: `https://sandbox.stackfox.com/preview/${sdpVersionId}`,
    },
  });

  await emitEvent({
    code: "SANDBOX_READY",
    payload: { sdpVersionId, serviceId: sdp.serviceId },
    actor: "system",
  });
});

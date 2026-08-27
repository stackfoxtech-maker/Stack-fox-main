import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { generateContent } from "../lib/gemini";
import { uploadFile } from "../lib/storage";
import { toJson } from "../lib/json";

interface PreviewJob {
  serviceId: string;
  tier?: string;
}

createWorker<PreviewJob>(QUEUE.previewGen, async (job) => {
  const { serviceId, tier = "GROWTH" } = job.data;

  const service = await prisma.serviceUnit.findUnique({
    where: { id: serviceId },
    include: { featureUnits: true },
  });
  if (!service) return;

  const prompt = `Generate a detailed preview/mockup description for the IT service "${service.name}" at ${tier} tier.
Features included: ${service.featureUnits.map((f) => f.name).join(", ")}
Create a realistic preview that shows what the client will receive.
Return as JSON with: title, description, sections (array of {heading, content}), estimatedTimeline, keyDeliverables.`;

  const result = await generateContent(prompt);

  const preview = await prisma.preview.create({
    data: {
      serviceId,
      inputData: toJson({ tier, content: result }),
      status: "GENERATED",
    },
  });

  const key = `previews/${serviceId}/${tier}/${preview.id}.json`;
  await uploadFile(key, Buffer.from(result), "application/json");

  await prisma.preview.update({ where: { id: preview.id }, data: { previewUrl: key } });
});

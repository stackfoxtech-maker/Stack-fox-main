import { createWorker, QUEUE } from "../lib/queue";
import { generateContent } from "../lib/gemini";
import { prisma } from "@stackfox/prisma";

/**
 * Renders the client-facing Activity feed. Events are stored with a machine
 * `code` (372 of them); this turns each into one plain sentence a non-technical
 * stakeholder can read. Events are keyed by `seq` (BigInt), not `id`.
 */
createWorker<{ eventSeq: number }>(QUEUE.activityTranslator, async (job) => {
  const { eventSeq } = job.data;
  if (eventSeq === undefined || eventSeq === null) return;

  const seq = BigInt(eventSeq);
  const event = await prisma.event.findUnique({ where: { seq } });
  if (!event || event.humanReadable) return;

  const prompt = `Translate this technical event into a simple, human-readable activity update for a non-technical client:
Event code: ${event.code}
Payload: ${JSON.stringify(event.payload)}
Write a single sentence that a business stakeholder would understand.`;

  let translation: string;
  try {
    translation = (await generateContent(prompt)).trim();
  } catch (err) {
    // The feed must still render if the LLM is unavailable — fall back to a
    // readable form of the event code rather than leaving the row blank.
    translation = event.code
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  await prisma.event.update({ where: { seq }, data: { humanReadable: translation } });
});

import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { generateContent } from "../lib/gemini";
import { queues } from "../lib/queue";

createWorker(QUEUE.whatsappCommerce, async (job) => {
  const { from, message, type, timestamp } = job.data;

  if (type === "text" || type === "interactive") {
    const userMessage = typeof message === "string" ? message : message?.body ?? "";

    // Use Gemini to understand intent
    const prompt = `You are a StackFox IT services assistant on WhatsApp. The user said: "${userMessage}"
Classify the intent as one of: BROWSE_SERVICES, GET_ESTIMATE, CHECK_STATUS, SUPPORT, OTHER.
Also extract any service names, project references, or ticket numbers mentioned.
Return as JSON: { intent, entities: { services: [], projectRef: null, ticketRef: null }, suggestedReply: "..." }`;

    const result = await generateContent(prompt);
    let parsed: any;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { intent: "OTHER", entities: {}, suggestedReply: "I'd be happy to help! Could you tell me more about what you're looking for?" };
    }

    // Store conversation
    await prisma.toolSession.create({
      data: {
        tool: "WHATSAPP",
        input: { from, message: userMessage, intent: parsed.intent },
        output: parsed,
        status: "COMPLETED",
      },
    });

    // Send reply via WhatsApp BSP
    if (process.env.WHATSAPP_BSP_URL) {
      try {
        await fetch(process.env.WHATSAPP_BSP_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_BSP_TOKEN}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: parsed.suggestedReply },
          }),
        });
      } catch (err) {
        console.error("[whatsappCommerce] Failed to send reply:", err);
      }
    }
  }
});

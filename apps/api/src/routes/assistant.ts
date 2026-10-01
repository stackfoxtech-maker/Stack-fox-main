import { TIMEOUT } from "../lib/timeouts";
import type { FastifyInstance } from "fastify";
import { parseBody } from "../lib/validate";
import { AssistantChatSchema, AssistantRecommendSchema } from "./opsSchemas";
import { answerQuestion, starterSuggestions } from "../lib/assistantKnowledge";

const GEMINI_MODEL = "gemini-3.6-flash";

export async function assistantRoutes(app: FastifyInstance) {
  // POST /assistant/chat: FoxBot. Answers come from StackFox's own data and written
  // policies (see lib/assistantKnowledge.ts), never from a language model.
  app.post(
    "/assistant/chat",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = parseBody(req, reply, AssistantChatSchema);
      if (!body) return;
      try {
        return { data: await answerQuestion(body.message, { page: body.page }) };
      } catch (err: any) {
        req.log.error(err);
        return reply
          .code(503)
          .send({ message: "FoxBot is unavailable right now, try again shortly" });
      }
    },
  );

  // GET /assistant/suggestions?page=/pricing: the opening chips for that page.
  app.get("/assistant/suggestions", async (req) => {
    const { page } = req.query as { page?: string };
    return { data: { suggestions: await starterSuggestions(page?.slice(0, 200)) } };
  });

  // POST /assistant/advise — AI Scope Advisor (Product Bible §4.2).
  // Takes the 10-question flow's answers plus the client's own catalog
  // (small — id/name/category/price only) and asks Gemini to pick a
  // config from that exact catalog, so every itemId it returns is one the
  // Builder can actually load via its existing ?cart= mechanism.
  app.post(
    "/assistant/advise",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = parseBody(req, reply, AssistantRecommendSchema);
      if (!body) return;
      const { answers, catalog } = body;
      if (Object.keys(answers).length === 0) {
        return reply.code(400).send({ message: "answers are required" });
      }
      if (catalog.length === 0) {
        return reply.code(400).send({ message: "catalog is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey)
        return reply.code(500).send({ message: "AI assistant is not configured" });

      const catalogLines = catalog
        .map((c) => `${c.id} | ${c.name} | ₹${c.price}`)
        .join("\n");
      const answerLines = Object.entries(answers)
        .map(([q, a]) => `${q}: ${a}`)
        .join("\n");

      const prompt = `You are the StackFox AI Scope Advisor. A prospective client answered a 10-question
intake. Recommend a service configuration using ONLY item ids from the catalog below — never invent
an id or price.

CATALOG (id | name | starting price):
${catalogLines}

CLIENT ANSWERS:
${answerLines}

Respond with strict JSON matching this shape, nothing else:
{
  "tier": "STARTER" | "GROWTH" | "PREMIUM",
  "rationale": "2-3 sentences explaining the recommendation",
  "itemIds": ["id1", "id2", ...],
  "lighterAlt": { "rationale": "1 sentence", "itemIds": ["..."] },
  "heavierAlt": { "rationale": "1 sentence", "itemIds": ["..."] }
}
Pick STARTER only if the scope is genuinely simple and low-budget. itemIds must all exist in the catalog above.`;

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            signal: AbortSignal.timeout(TIMEOUT.llm),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
              },
            }),
          },
        );

        const data = (await res.json()) as any;
        if (!res.ok) {
          req.log.error({ geminiError: data?.error }, "Gemini advisor request failed");
          return reply.code(502).send({
            message: data?.error?.message ?? "AI assistant is temporarily unavailable",
          });
        }

        const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
          return reply
            .code(502)
            .send({ message: "AI assistant returned an empty response" });

        let advice: any;
        try {
          advice = JSON.parse(text);
        } catch {
          return reply
            .code(502)
            .send({ message: "AI assistant returned malformed output" });
        }

        // Guard against hallucinated ids so "Load into Builder" never breaks.
        const validIds = new Set(catalog.map((c) => c.id));
        const clean = (ids: unknown) =>
          Array.isArray(ids) ? ids.filter((id) => validIds.has(id)) : [];
        advice.itemIds = clean(advice.itemIds);
        if (advice.lighterAlt)
          advice.lighterAlt.itemIds = clean(advice.lighterAlt.itemIds);
        if (advice.heavierAlt)
          advice.heavierAlt.itemIds = clean(advice.heavierAlt.itemIds);

        return { data: advice };
      } catch (err: any) {
        req.log.error(err);
        return reply
          .code(502)
          .send({ message: "AI assistant is temporarily unavailable" });
      }
    },
  );
}

import type { FastifyInstance } from "fastify";

const GEMINI_MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You are FoxBot, the AI assistant on the StackFox website (stackfox.com).

StackFox is a full-lifecycle IT-services marketplace: browse services, configure them, get an
instant estimate, get a legally structured contract generated automatically, pay, and track
delivery end-to-end — all backed by a human-delivered team augmented by AI.

Service categories (242 individual service units across these): Web Development, Mobile App
Development, AI & GenAI, Automation, E-Commerce, UI/UX Design, Backend & APIs, DevOps & Cloud,
Cybersecurity, SEO & Digital Marketing, IT Consultancy, SaaS Products, Maintenance & Support.

Popular bundled packages:
- Starter Website Package — ₹35,000
- Business Website Package — ₹65,000
- E-Commerce Launchpad — ₹85,000
- Mobile App Launch Package — ₹1,10,000
- SaaS Starter Kit — ₹2,50,000
- AI Integration Package — ₹90,000
- Security Hardening Package — ₹95,000
- Digital Growth Package — ₹70,000

Every service comes in three tiers — Starter, Growth, Premium — with transparent pricing at
each tier. Clients can also build a custom scope in the Builder and get an instant estimate.

Your job: help visitors figure out what they need, explain how StackFox works, and point them
toward the right next step (the Service Builder, a specific package, the instant estimator, or
booking a free call at /contact). Keep answers short (2-4 sentences), friendly, and concrete —
prefer naming a specific package or category over vague reassurance. If asked something totally
unrelated to StackFox or software/IT services, gently redirect back to what StackFox can help
with. Never invent a specific price beyond what's listed above — for anything more specific,
point them to the estimator or Builder.`;

export async function assistantRoutes(app: FastifyInstance) {
  app.post(
    "/assistant/chat",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { message, history } = req.body as {
      message?: string;
      history?: { role: "user" | "model"; text: string }[];
    };
    if (!message?.trim()) return reply.code(400).send({ message: "message is required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return reply.code(500).send({ message: "AI assistant is not configured" });

    const contents = [
      ...(history ?? []).slice(-10).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            // gemini-3.6-flash spends part of the output budget on internal
            // "thinking" tokens before the visible answer — too low a cap
            // here truncates mid-thought and returns garbled/partial text.
            generationConfig: { maxOutputTokens: 2048 },
          }),
        },
      );

      const data = (await res.json()) as any;
      if (!res.ok) {
        req.log.error({ geminiError: data?.error }, "Gemini request failed");
        return reply.code(502).send({ message: data?.error?.message ?? "AI assistant is temporarily unavailable" });
      }

      const reply_text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply_text) {
        return reply.code(502).send({ message: "AI assistant returned an empty response" });
      }

      return { data: { reply: reply_text } };
    } catch (err: any) {
      req.log.error(err);
      return reply.code(502).send({ message: "AI assistant is temporarily unavailable" });
    }
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
    const { answers, catalog } = req.body as {
      answers?: Record<string, string>;
      catalog?: { id: string; name: string; catId: string; price: number }[];
    };
    if (!answers || Object.keys(answers).length === 0) {
      return reply.code(400).send({ message: "answers are required" });
    }
    if (!catalog || catalog.length === 0) {
      return reply.code(400).send({ message: "catalog is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return reply.code(500).send({ message: "AI assistant is not configured" });

    const catalogLines = catalog.map((c) => `${c.id} | ${c.name} | ₹${c.price}`).join("\n");
    const answerLines = Object.entries(answers).map(([q, a]) => `${q}: ${a}`).join("\n");

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2048, responseMimeType: "application/json" },
          }),
        },
      );

      const data = (await res.json()) as any;
      if (!res.ok) {
        req.log.error({ geminiError: data?.error }, "Gemini advisor request failed");
        return reply.code(502).send({ message: data?.error?.message ?? "AI assistant is temporarily unavailable" });
      }

      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return reply.code(502).send({ message: "AI assistant returned an empty response" });

      let advice: any;
      try {
        advice = JSON.parse(text);
      } catch {
        return reply.code(502).send({ message: "AI assistant returned malformed output" });
      }

      // Guard against hallucinated ids so "Load into Builder" never breaks.
      const validIds = new Set(catalog.map((c) => c.id));
      const clean = (ids: unknown) => (Array.isArray(ids) ? ids.filter((id) => validIds.has(id)) : []);
      advice.itemIds = clean(advice.itemIds);
      if (advice.lighterAlt) advice.lighterAlt.itemIds = clean(advice.lighterAlt.itemIds);
      if (advice.heavierAlt) advice.heavierAlt.itemIds = clean(advice.heavierAlt.itemIds);

      return { data: advice };
    } catch (err: any) {
      req.log.error(err);
      return reply.code(502).send({ message: "AI assistant is temporarily unavailable" });
    }
  });
}

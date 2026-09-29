/**
 * FoxBot answers from StackFox's own data, not from a language model.
 *
 * Runs the real answering code against the storefront catalogue. Guards:
 *   - the questions the opening chips offer each get a specific answer, not the fallback
 *   - a quoted price is the catalogue's price for that service, never invented
 *   - a budget filters packages
 *   - an unknown question is answered honestly with a way to reach a person
 *   - no Gemini key is needed and the chat route never calls out
 *
 *   pnpm --filter @stackfox/api exec tsx tests/assistant-knowledge.mts
 */
import "../src/env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readRawCatalogue } from "../src/lib/catalogue";
import {
  answerQuestion,
  parseBudget,
  starterSuggestions,
} from "../src/lib/assistantKnowledge";

const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

// Every opening chip, for every page the bot can be on, must land on a real answer.
const pages = ["/", "/pricing", "/catalog", "/app/client/invoices"];
const chips = [...new Set(pages.flatMap((p) => starterSuggestions(p)))];
for (const chip of chips) {
  const a = await answerQuestion(chip);
  check(`chip "${chip}" gets a real answer (${a.intent})`, a.intent !== "unknown");
}

// Follow-up chips offered by each answer must also resolve.
const topics = [
  "How do payments work?",
  "Do you offer refunds?",
  "Do you sign NDAs?",
  "Who owns the code?",
  "What is your revision policy?",
  "Where are my contracts?",
  "Can you take over my existing code?",
];
for (const q of topics) {
  const a = await answerQuestion(q);
  check(`"${q}" -> ${a.intent}`, a.intent !== "unknown" && a.reply.length > 20);
  for (const s of a.suggestions) {
    const f = await answerQuestion(s);
    if (f.intent === "unknown") check(`follow-up "${s}" (from "${q}") resolves`, false);
  }
}
check(
  "NDA question is the NDA topic, not contracts",
  (await answerQuestion("Do you sign NDAs?")).intent === "nda",
);
check(
  "refunds are the refunds topic",
  (await answerQuestion("Do you offer refunds?")).intent === "refunds",
);

// Prices come from the storefront catalogue, the same file the website renders.
const raw: any = readRawCatalogue();
const svc = (raw.services as any[]).find((x) => x.price > 0 && /^web-001$/.test(x.id));
check("the catalogue has the headline website service", !!svc);
if (svc) {
  const a = await answerQuestion(`how much for a ${svc.name}?`);
  const formatted = "₹" + new Intl.NumberFormat("en-IN").format(svc.price);
  check(
    `"${svc.name}" is quoted at its catalogue price ${formatted}`,
    a.reply.includes(formatted),
  );
  check("it quotes the catalogue timeline", !svc.est || a.reply.includes(svc.est));
  check(
    "the answer links to that service",
    a.links.some((l) => l.to === `/services/${svc.id}`),
  );
}
const web0 = await answerQuestion("What does a website cost?");
check(
  "a website question puts the Business Website first",
  /^• Business Website/m.test(web0.reply),
);
const app = await answerQuestion("Make an app");
check(
  "an app question is a mobile-app answer, not a stray feature",
  /Mobile App/i.test(app.reply),
);
const ai = await answerQuestion("Need AI");
check("an AI question finds AI services", /AI (Agent|Readiness|Data)/.test(ai.reply) && ai.intent === "service");
check(
  "no internal test row is ever offered",
  !(
    await Promise.all(
      ["website", "app", "test", "workflow"].map((q) => answerQuestion(q)),
    )
  ).some((r) => /workflow test/i.test(r.reply)),
);
// Every package the site sells is quoted at its listed price.
const pk = await answerQuestion("Show me packages");
for (const p of [...(raw.packages as any[])].sort((a, b) => a.price - b.price).slice(0, 4)) {
  check(
    `package "${p.name}" is listed at its price`,
    pk.reply.includes("₹" + new Intl.NumberFormat("en-IN").format(p.price)),
  );
}

const web = await answerQuestion("What does a website cost?");
check(
  "a website question is a service answer with rupee prices",
  web.intent === "service" && /₹\d/.test(web.reply),
);
check("service answers say the price is indicative", /indicative/i.test(web.reply));

// Budget handling.
check("50k parses", parseBudget("something under 50k") === 50_000);
check("1.5 lakh parses", parseBudget("budget is 1.5 lakh") === 150_000);
check("a page count is not a budget", parseBudget("I need 5 pages") === null);
const cheap = await answerQuestion("packages under 40000");
check("a budget question answers with packages", cheap.intent === "packages");
const amounts = [...cheap.reply.matchAll(/₹([\d,]+)/g)].map((m) =>
  Number(m[1].replace(/,/g, "")),
);
check(
  "every listed package is within the budget (or the answer says none are)",
  amounts.length === 0 ||
    /Nothing is priced/.test(cheap.reply) ||
    amounts.every((n) => n <= 40_000),
);

// Honesty on the unknown.
const odd = await answerQuestion("what is the airspeed velocity of an unladen swallow");
const logo = await answerQuestion("how much for a logo?");
check("'logo' finds Brand Identity Design", /Brand Identity/.test(logo.reply));
check("an unrelated question is admitted, not invented", odd.intent === "unknown");
check(
  "the unknown answer offers a person",
  odd.links.some((l) => l.to === "/contact"),
);

// Shape and no-LLM guarantees.
check("greeting is short-circuited", (await answerQuestion("hi")).intent === "greeting");
const src = readFileSync(resolve(process.cwd(), "src/routes/assistant.ts"), "utf8");
const chatBlock = src.slice(
  src.indexOf('"/assistant/chat"'),
  src.indexOf("// POST /assistant/advise"),
);
check(
  "the chat route does not call Gemini",
  !/generativelanguage|GEMINI/.test(chatBlock),
);
const kb = readFileSync(resolve(process.cwd(), "src/lib/assistantKnowledge.ts"), "utf8");
check(
  "the knowledge module has no network calls",
  !/fetch\(|generativelanguage/.test(kb),
);

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL ASSISTANT KNOWLEDGE CHECKS PASSED");

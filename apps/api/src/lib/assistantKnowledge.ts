/**
 * FoxBot's brain: answers a visitor's question from StackFox's own data.
 *
 * There is no language model in this path. Every reply is either a fact written down
 * here (how payments, milestones, contracts, refunds and support work) or a row of the
 * storefront catalogue (shared/stackfox-data.json: services, prices, timelines, packages,
 * industry bundles, FAQ), which is exactly what the website itself shows. Because nothing
 * is generated, the bot cannot invent a price, and a question it does not know is answered
 * with an honest "ask a person" plus the pages most likely to help.
 *
 * Catalogue prices are already in rupees.
 */
import { TIER_MULTIPLIERS } from "./estimate";
import { readRawCatalogue } from "./catalogue";

export interface Link {
  label: string;
  to: string;
}
export interface Answer {
  intent: string;
  reply: string;
  suggestions: string[];
  links: Link[];
}

const inr = (n: number) => "₹" + new Intl.NumberFormat("en-IN").format(n);

const FALLBACK_SUGGESTIONS = [
  "What does a website cost?",
  "How do payments work?",
  "How long will it take?",
  "Talk to a human",
];

interface Topic {
  intent: string;
  /** Any of these words/phrases in the question selects the topic. */
  match: RegExp;
  reply: string;
  links?: Link[];
  next: string[];
}

/** Facts about how StackFox works. Kept in step with /faq, /pricing and the dashboard. */
const TOPICS: Topic[] = [
  {
    intent: "human",
    match:
      /\b(human|person|someone|call|talk|speak|phone|whatsapp|contact|meeting|consult|callback)\b/,
    reply:
      "You can book a free call and a person will confirm scope and answer anything I can't. We usually reply within 24 hours.",
    links: [{ label: "Book a free call", to: "/contact" }],
    next: ["What does a website cost?", "How do payments work?", "Show me packages"],
  },
  {
    intent: "payments",
    match:
      /\b(pay|payment|payments|upi|card|net ?banking|razorpay|installment|instalment|advance|upfront)\b/,
    reply:
      "You can pay by UPI, credit or debit card, net banking or bank transfer, all processed securely through Razorpay. Projects are paid milestone by milestone rather than all upfront.",
    links: [{ label: "How pricing works", to: "/pricing" }],
    next: [
      "Do you offer refunds?",
      "Do you give GST invoices?",
      "How long will it take?",
    ],
  },
  {
    intent: "refunds",
    match: /\b(refund|refunds|money back|cancel|cancellation|not satisfied|unhappy)\b/,
    reply:
      "Payments are milestone-based. If you are not satisfied after the first milestone, you can request a full refund for undelivered work.",
    links: [{ label: "Refund and legal terms", to: "/legal" }],
    next: ["How do payments work?", "What is your revision policy?", "Talk to a human"],
  },
  {
    intent: "gst",
    match: /\b(gst|invoice|invoices|tax|receipt|bill|billing|tds|sac)\b/,
    reply:
      "Every quote is itemised with 18% GST shown, and you get a GST invoice for each payment. You can download invoices from your dashboard, and there's a free GST invoice tool for your own billing too.",
    links: [
      { label: "Your invoices", to: "/app/client/invoices" },
      { label: "Free GST invoice tool", to: "/tools/gst-invoice" },
    ],
    next: [
      "How do payments work?",
      "Where are my contracts?",
      "What does a website cost?",
    ],
  },
  {
    intent: "timeline",
    match:
      /\b(how long|timeline|time|days|weeks|deadline|duration|delivery|deliver|quick|fast|urgent|turnaround)\b/,
    reply:
      "Timelines depend on scope. As a guide, a simple website takes about 7–10 days, a mobile app 30–45 days and a full SaaS product 60–90 days. Every service shows its own estimated delivery time.",
    links: [{ label: "Browse services", to: "/catalog" }],
    next: ["What does a website cost?", "Show me packages", "How do I track my project?"],
  },
  {
    intent: "tracking",
    match:
      /\b(track|tracking|progress|status|dashboard|milestone|milestones|update|updates|portal|login)\b/,
    reply:
      "Every client gets a dashboard with live project tracking, milestones, files, messages and invoices. Each project is split into milestones, and you can see them move from build to review to done.",
    links: [
      { label: "Your projects", to: "/app/client/projects" },
      { label: "Milestones", to: "/app/client/milestones" },
    ],
    next: ["Where are my contracts?", "How do payments work?", "Talk to a human"],
  },
  {
    intent: "contracts",
    match:
      /\b(contract|contracts|agreement|agreements|sign|signing|esign|e-sign|msa|sow|dpa|legal)\b/,
    reply:
      "Agreements are generated for your engagement automatically: master service agreement, statement of work, NDA and IP assignment where they apply. You sign online and can download them all as a single PDF from your dashboard.",
    links: [{ label: "Your contracts", to: "/app/client/contracts" }],
    next: ["Do you sign NDAs?", "Who owns the code?", "How do payments work?"],
  },
  {
    intent: "nda",
    match: /\b(ndas?|confidential|confidentiality)\b/,
    reply:
      "Yes, we sign an NDA before any project discussion, on request. You can also download an NDA template from the legal tools.",
    links: [{ label: "Legal templates", to: "/tools/legal-templates" }],
    next: ["Who owns the code?", "Where are my contracts?", "Talk to a human"],
  },
  {
    intent: "ownership",
    match: /\b(owns?|owner|ownership|ip|intellectual|copyright|source code|rights)\b/,
    reply:
      "You own the code and the IP we build for you. It's assigned to you in the agreement you sign, and an NDA is available on request.",
    links: [{ label: "Your contracts", to: "/app/client/contracts" }],
    next: [
      "Do you sign NDAs?",
      "Can you take over my existing code?",
      "How do payments work?",
    ],
  },
  {
    intent: "support",
    match:
      /\b(support|maintenance|maintain|retainer|bug|bugs|fix|after launch|ongoing|hosting)\b/,
    reply:
      "Yes. Monthly maintenance retainers start at ₹15,000/month, or you can buy a 10-hour bug-fix package when you need it.",
    links: [{ label: "Support tickets", to: "/app/client/support" }],
    next: ["What does a website cost?", "How do I track my project?", "Talk to a human"],
  },
  {
    intent: "tech",
    match:
      /\b(tech|technology|technologies|stack|react|next|node|python|aws|framework|language|database|postgres)\b/,
    reply:
      "We use React, Next.js, React Native, Node.js, Python, PostgreSQL, Redis, AWS, Docker and Kubernetes, and pick the best stack for your project rather than forcing one.",
    next: ["Can you take over my existing code?", "Make an app", "Need AI"],
  },
  {
    intent: "takeover",
    match:
      /\b(existing|takeover|take over|already have|legacy|other agency|rebuild|revamp|redesign|audit)\b/,
    reply:
      "Yes, we regularly take over projects from other teams. We start with a code audit and then agree a stabilisation plan with you.",
    links: [{ label: "Free website audit", to: "/tools/website-audit" }],
    next: ["What does a website cost?", "How long will it take?", "Talk to a human"],
  },
  {
    intent: "discounts",
    match:
      /\b(discount|discounts|startup|coupon|offer|offers|cheaper|student|referral|refer)\b/,
    reply:
      "Our Startup Program offers up to 30% off for early-stage startups, and bundles can bring the price down further. You can also earn credit by referring other clients.",
    links: [
      { label: "Startup program", to: "/programs" },
      { label: "Referral programme", to: "/referral" },
    ],
    next: ["Show me packages", "What does a website cost?", "How do payments work?"],
  },
  {
    intent: "revisions",
    match:
      /\b(revision|revisions|changes|change request|rework|edits|modify|scope change)\b/,
    reply:
      "Each milestone includes 2 rounds of revisions. Extra revisions, or new scope, are billed at our hourly rate, and you approve any change to the plan before work starts.",
    links: [{ label: "Change requests", to: "/app/client/changes" }],
    next: ["How do payments work?", "How do I track my project?", "Talk to a human"],
  },
  {
    intent: "how",
    match:
      /\b(how does it work|how it works|process|get started|start|begin|steps|onboarding|builder)\b/,
    reply:
      "It takes three steps. Browse services, each with a real price. Add the pieces you need in the Builder and watch the total update, GST included. Then send us the itemised plan and we confirm scope on a free call.",
    links: [
      { label: "Open the Builder", to: "/builder" },
      { label: "Instant estimate", to: "/tools/instant-estimate" },
    ],
    next: ["Show me packages", "What does a website cost?", "How long will it take?"],
  },
  {
    intent: "security",
    match:
      /\b(secure|security|safe|privacy|gdpr|iso|data protection|encrypt|pentest|hack)\b/,
    reply:
      "Payments run through Razorpay, agreements are signed and stored securely, and an NDA is available on request. We can also run a security review as a service.",
    links: [{ label: "Browse security services", to: "/builder?category=cybersecurity" }],
    next: ["Do you sign NDAs?", "How do payments work?", "Talk to a human"],
  },
];

/** Words that carry no meaning for matching a service name. */
const STOP = new Set(
  "a an and the for to of in on with my me i we you your our is are do does can could would want need looking build make create get have any some what how much cost price pricing about please need needs new".split(
    " ",
  ),
);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9₹ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length > 2 || w === "ai") && !STOP.has(w));

/** "under 50k", "budget ₹1.5 lakh", "₹75,000" → rupees, or null. */
export function parseBudget(message: string): number | null {
  const m = message
    .toLowerCase()
    .replace(/,/g, "")
    .match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|lakh|lakhs|lac|l|cr|crore)?\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2];
  const value =
    unit === "k"
      ? n * 1_000
      : unit && /^l/.test(unit)
        ? n * 100_000
        : unit && /^c/.test(unit)
          ? n * 10_000_000
          : n;
  // A bare small number ("2 pages") is not a budget.
  return value >= 5_000 ? Math.round(value) : null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  catId?: string;
  est?: string;
  lay?: string;
}

/** The public catalogue, minus anything that is an internal test row. */
function catalogue() {
  const raw = (readRawCatalogue() ?? {}) as any;
  const categories = new Map<string, any>(
    (raw.categories ?? []).map((c: any) => [c.id, c]),
  );
  const services: Service[] = (raw.services ?? []).filter(
    (s: Service) => s?.id && s.price > 0 && !/workflow test/i.test(s.name),
  );
  return {
    categories,
    services,
    packages: (raw.packages ?? []) as Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
      items?: string[];
    }>,
    bundles: (raw.industryBundles ?? []) as Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
    }>,
    faq: (raw.faq ?? []) as Array<{ q: string; a: string }>,
  };
}

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Best-matching services for the words in a question, most relevant first. */
/** Everyday words a visitor uses for things the catalogue names differently. */
const ALIASES: Record<string, string> = {
  logo: "brand identity",
  branding: "brand identity",
  shop: "e-commerce",
  store: "e-commerce",
  ecommerce: "e-commerce",
  online: "e-commerce",
  android: "mobile app",
  ios: "mobile app",
  chatbot: "chatbot",
  hosting: "cloud devops",
  hack: "security",
  ranking: "seo",
  google: "seo",
};

export function findServices(message: string, limit = 3): Service[] {
  const words = tokens(message).flatMap((w) =>
    ALIASES[w] ? [w, ...tokens(ALIASES[w])] : [w],
  );
  if (words.length === 0) return [];
  const { categories, services } = catalogue();
  return services
    .map((s) => {
      const name = s.name.toLowerCase();
      const cat =
        `${categories.get(s.catId ?? "")?.name ?? ""} ${s.catId ?? ""}`.toLowerCase();
      const score = words.reduce((sum, w) => {
        const whole = new RegExp(`\\b${escapeRe(w)}\\b`);
        const start = new RegExp(`\\b${escapeRe(w)}`);
        return (
          sum +
          (whole.test(name)
            ? 3
            : start.test(name)
              ? 2
              : whole.test(cat)
                ? 1.5
                : start.test(cat)
                  ? 1
                  : 0)
        );
      }, 0);
      // The first services of a category are its headline ones ("Business Website"
      // before "Website Speed Optimization"): a small nudge, never enough to beat a name match.
      const headline = /-00[1-3]$/.test(s.id) ? 0.5 : 0;
      return { s, score: score > 0 ? score + headline : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.price - b.s.price)
    .slice(0, limit)
    .map((x) => x.s);
}

function serviceAnswer(message: string): Answer | null {
  const hits = findServices(message);
  if (hits.length === 0) return null;
  const lines = hits.map((s) => {
    const g = Math.round(s.price * TIER_MULTIPLIERS.GROWTH);
    const p = Math.round(s.price * TIER_MULTIPLIERS.PREMIUM);
    return `• ${s.name}: from ${inr(s.price)} (Growth ${inr(g)}, Premium ${inr(p)})${s.est ? `, about ${s.est}` : ""}`;
  });
  const top = hits[0];
  const cats = catalogue().categories;
  return {
    intent: "service",
    reply: `Here's what we have that fits:\n${lines.join("\n")}\nPrices are indicative and the final quote is confirmed after a free call.`,
    suggestions: [
      "How long will it take?",
      "How do payments work?",
      "Show me packages",
      "Talk to a human",
    ],
    links: [
      { label: `See ${top.name}`, to: `/services/${top.id}` },
      ...(top.catId && cats.has(top.catId)
        ? [
            {
              label: `More in ${cats.get(top.catId).name}`,
              to: `/builder?category=${top.catId}`,
            },
          ]
        : [{ label: "Open the Builder", to: "/builder" }]),
    ],
  };
}

function packageAnswer(message: string): Answer {
  const budget = parseBudget(message);
  const { packages } = catalogue();
  const rows = [...packages].filter((p) => p.price > 0).sort((a, b) => a.price - b.price);
  if (rows.length === 0)
    return {
      intent: "packages",
      reply: "Packages are fixed-price bundles. The full list is on the packages page.",
      suggestions: FALLBACK_SUGGESTIONS,
      links: [{ label: "See packages", to: "/packages" }],
    };
  const within = budget ? rows.filter((p) => p.price <= budget) : rows;
  const shown = (within.length ? within : rows).slice(0, 4);
  const intro = budget
    ? within.length
      ? `Within ${inr(budget)}, these fixed-price packages fit:`
      : `Nothing is priced under ${inr(budget)} as a fixed package. The closest are:`
    : "Here are our fixed-price packages, cheapest first:";
  return {
    intent: "packages",
    reply: `${intro}\n${shown
      .map(
        (p) =>
          `• ${p.name}: ${inr(p.price)}${p.items ? `, ${p.items.length} services included` : ""}`,
      )
      .join("\n")}\nAny package can be customised in the Builder.`,
    suggestions: [
      "How do payments work?",
      "Can I customize a package?",
      "Talk to a human",
    ],
    links: [{ label: "See all packages", to: "/packages" }],
  };
}

function categoryAnswer(): Answer {
  const { categories, services } = catalogue();
  const counts = new Map<string, number>();
  for (const s of services)
    counts.set(s.catId ?? "", (counts.get(s.catId ?? "") ?? 0) + 1);
  const list = [...counts.entries()]
    .filter(([id]) => categories.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, n]) => `${categories.get(id).name} (${n})`)
    .join(", ");
  return {
    intent: "catalog",
    reply: `We have ${services.length} priced services. The biggest areas: ${list}. Every one shows a starting price, and you can mix and match in the Builder.`,
    suggestions: ["What does a website cost?", "Show me packages", "How does it work?"],
    links: [
      { label: "Browse the catalog", to: "/catalog" },
      { label: "Open the Builder", to: "/builder" },
    ],
  };
}

/** A published FAQ entry that shares most of the question's words. */
function faqAnswer(message: string): Answer | null {
  const words = new Set(tokens(message));
  if (words.size < 2) return null;
  let best: { q: string; a: string; score: number } | null = null;
  for (const f of catalogue().faq) {
    const qw = tokens(f.q);
    const shared = qw.filter((w) => words.has(w)).length;
    const score = shared / Math.max(words.size, 1);
    if (shared >= 2 && score >= 0.5 && (!best || score > best.score))
      best = { ...f, score };
  }
  return best
    ? {
        intent: "faq",
        reply: best.a,
        suggestions: ["Show me packages", "How do payments work?", "Talk to a human"],
        links: [{ label: "More questions", to: "/faq" }],
      }
    : null;
}

/** When a question matches several topics, the earlier one here answers it. */
const ORDER = [
  "nda",
  "ownership",
  "refunds",
  "payments",
  "gst",
  "contracts",
  "revisions",
  "discounts",
  "support",
  "takeover",
  "timeline",
  "tracking",
  "tech",
  "security",
  "how",
  "human",
];
/** Topics that still answer a question which also mentions cost. */
const PRICE_TOPICS = new Set(["gst", "payments", "discounts", "support", "refunds"]);

const GREETING = /^(hi|hii|hello|hey|namaste|good (morning|afternoon|evening)|yo|sup)\b/;
const THANKS = /\b(thanks|thank you|thx|ty|great|awesome|perfect|got it)\b/;
const PACKAGE =
  /\b(package|packages|bundle|bundles|fixed price|fixed-price|combo|deal)\b/;
const CATALOG =
  /\b(services|catalog|catalogue|what do you (do|offer)|offerings|everything you)\b/;
const PRICE =
  /\b(cost|price|pricing|charge|rate|rates|quote|budget|estimate|how much|expensive|affordable)\b/;

/** Chips shown before anyone has typed — picked for the page (and who) is asking. */
export function starterSuggestions(page?: string, signedIn?: boolean): string[] {
  if (page?.startsWith("/app/client") || signedIn)
    return [
      "Where are my invoices?",
      "Where are my contracts?",
      "How do I track my project?",
      "Talk to a human",
    ];
  if (page?.startsWith("/pricing") || page?.startsWith("/packages"))
    return [
      "What does a website cost?",
      "Show me packages",
      "Do you offer discounts?",
      "How do payments work?",
    ];
  if (page?.startsWith("/catalog") || page?.startsWith("/builder"))
    return [
      "What does a website cost?",
      "How does it work?",
      "How long will it take?",
      "Talk to a human",
    ];
  return [
    "What does a website cost?",
    "Show me packages",
    "How does it work?",
    "How do payments work?",
  ];
}

export async function answerQuestion(
  rawMessage: string,
  ctx: { page?: string } = {},
): Promise<Answer> {
  const message = rawMessage.trim();
  const lower = message.toLowerCase();

  if (GREETING.test(lower) && lower.split(/\s+/).length <= 4)
    return {
      intent: "greeting",
      reply:
        "Hi! I can price a service, compare packages, explain how payments, milestones and contracts work, or point you to the right page. What are you building?",
      suggestions: starterSuggestions(ctx.page),
      links: [],
    };
  if (THANKS.test(lower) && lower.split(/\s+/).length <= 5)
    return {
      intent: "thanks",
      reply:
        "Happy to help! If you want a person to confirm scope, book a free call any time.",
      suggestions: ["Show me packages", "How do payments work?", "Talk to a human"],
      links: [{ label: "Book a free call", to: "/contact" }],
    };

  // Direct topics first when the question is plainly about one (payments, refunds, ...).
  // "human/call" only wins when the question is not also asking for a price.
  const topic = TOPICS.filter((t) => t.match.test(lower)).sort(
    (a, b) => ORDER.indexOf(a.intent) - ORDER.indexOf(b.intent),
  )[0];
  const asksPrice = PRICE.test(lower);

  if (
    PACKAGE.test(lower) ||
    (asksPrice && parseBudget(message) && !tokens(message).length)
  )
    return packageAnswer(message);

  if (topic && (!asksPrice || PRICE_TOPICS.has(topic.intent)))
    return {
      intent: topic.intent,
      reply: topic.reply,
      suggestions: topic.next,
      links: topic.links ?? [],
    };

  const faq = faqAnswer(message);
  if (faq) return faq;
  const service = serviceAnswer(message);
  if (service) return service;

  if (asksPrice && parseBudget(message)) {
    const pk = packageAnswer(message);
    return {
      ...pk,
      reply: `I couldn't match that to one service, but by budget: ${pk.reply}`,
    };
  }
  if (CATALOG.test(lower)) return categoryAnswer();
  if (asksPrice)
    return {
      intent: "pricing",
      reply:
        "Every service has a real starting price in three tiers: Starter, Growth (about 1.5×) and Premium (about 2.2×). Tell me what you want built, for example a website, an app or a logo, and I'll show the prices. Or use the Builder for a live total.",
      suggestions: [
        "What does a website cost?",
        "Show me packages",
        "Make an app",
        "Need AI",
      ],
      links: [
        { label: "How pricing works", to: "/pricing" },
        { label: "Instant estimate", to: "/tools/instant-estimate" },
      ],
    };
  if (topic)
    return {
      intent: topic.intent,
      reply: topic.reply,
      suggestions: topic.next,
      links: topic.links ?? [],
    };

  return {
    intent: "unknown",
    reply:
      "I don't have a confident answer to that. A person can, usually within 24 hours. In the meantime, these might help.",
    suggestions: FALLBACK_SUGGESTIONS,
    links: [
      { label: "Book a free call", to: "/contact" },
      { label: "FAQ", to: "/faq" },
    ],
  };
}

/**
 * Post-build prerender (runs automatically as npm "postbuild").
 *
 * StackFox is a client-rendered SPA: every URL used to return the same empty shell, which
 * search engines can only index after rendering JS and most AI crawlers never index at all.
 * This writes, into dist/:
 *   • <route>/index.html  — the shell with that route's own <title>, description, canonical,
 *                           Open Graph tags, JSON-LD and a crawlable text body (replaced by
 *                           React on load; visually hidden until then, never shown to users)
 *   • app-shell.html      — the generic shell Vercel falls back to for app/auth routes
 *   • sitemap.xml, llms.txt
 * Content comes from the same sources the pages use (shared/stackfox-data.json,
 * src/data/faqs.json, src/data/guides.json), so the HTML can't drift from the app.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SITE,
  absUrl,
  clip,
  inr,
  indexableServices,
  servicePath,
  serviceMeta,
  fillTokens,
  landingPath,
} from "../src/lib/seo.js";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const load = (p) => JSON.parse(readFileSync(join(here, "..", p), "utf8"));
const data = load("../shared/stackfox-data.json");
const faqs = load("src/data/faqs.json");
const guides = load("src/data/guides.json");
const landings = load("src/data/landings.json");
const template = readFileSync(join(dist, "index.html"), "utf8");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const brand = data.meta.brand;
const services = indexableServices(data);
const catName = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
const countLabel = `${Math.floor(services.length / 10) * 10}+`;
const minPrice = Math.min(...services.map((s) => s.price));
const ORG_ID = `${SITE.url}/#organization`;

const orgLd = {
  "@type": ["Organization", "ProfessionalService"],
  "@id": ORG_ID,
  name: SITE.name,
  alternateName: brand.name,
  url: SITE.url + "/",
  logo: `${SITE.url}/logo-512.png`,
  description: SITE.description,
  email: brand.email,
  telephone: brand.phone,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Jaipur",
    addressRegion: "Rajasthan",
    addressCountry: "IN",
  },
  areaServed: [
    { "@type": "City", name: "Jaipur" },
    { "@type": "Country", name: "India" },
  ],
  knowsAbout: [
    "Web development",
    "Mobile app development",
    "E-commerce development",
    "AI chatbots and automation",
    "SaaS development",
    "Technical SEO",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: brand.email,
    telephone: brand.phone,
    areaServed: "IN",
    availableLanguage: ["English", "Hindi"],
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "StackFox IT services",
    url: absUrl("/catalog"),
    itemListElement: data.categories.map((c) => ({
      "@type": "OfferCatalog",
      name: c.name,
      description: c.description,
    })),
  },
  parentOrganization: { "@type": "Organization", name: "Artwall Labs" },
};
const siteLd = {
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  url: SITE.url + "/",
  name: SITE.name,
  publisher: { "@id": ORG_ID },
  inLanguage: "en-IN",
};

const crumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: absUrl(path),
  })),
});

const ul = (items) => `<ul>${items.join("")}</ul>`;
const li = (html) => `<li>${html}</li>`;
const a = (path, text) => `<a href="${esc(path)}">${esc(text)}</a>`;

const NAV = [
  ["/catalog", "All services"],
  ["/builder", "Build & Price"],
  ["/packages", "Packages"],
  ["/pricing", "Pricing"],
  ["/industries", "Industries"],
  ["/portfolio", "Portfolio"],
  ["/guides", "Guides"],
  ...landings.map((l) => [landingPath(l), l.title]),
  ["/faq", "FAQ"],
  ["/about", "About"],
  ["/contact", "Contact"],
];
const navHtml = `<nav aria-label="Site">${ul(NAV.map(([p, t]) => li(a(p, t))))}</nav>`;

const catalogBody = () =>
  data.categories
    .map((c) => {
      const rows = services.filter((s) => s.catId === c.id);
      return `<h2>${esc(c.name)}</h2><p>${esc(c.description)} ${rows.length} services.</p>${ul(
        rows.map((s) =>
          li(
            `${a(servicePath(s), s.name)} — from ${inr(s.price)} per ${esc(s.unit)}, ${esc(s.est)}`,
          ),
        ),
      )}`;
    })
    .join("");

const faqBody = () => faqs.map((f) => `<h2>${esc(f.q)}</h2><p>${esc(f.a)}</p>`).join("");

const pkgBody = () =>
  ul(
    data.packages.map((p) =>
      li(`<strong>${esc(p.name)}</strong> — ${inr(p.price)}. ${esc(p.description)}`),
    ),
  );

const industriesBody = () =>
  ul(
    data.industryBundles.map((p) =>
      li(`<strong>${esc(p.name)}</strong> — ${inr(p.price)}. ${esc(p.description)}`),
    ),
  );

const pricingBody = () =>
  `<p>All prices are indicative starting points in Indian rupees and exclude ${data.meta.gstRate}% GST. Final pricing depends on scope, timeline and requirements.</p>` +
  ul(
    data.categories.map((c) => {
      const p = services.filter((s) => s.catId === c.id).map((s) => s.price);
      return li(`${esc(c.name)}: ${inr(Math.min(...p))} – ${inr(Math.max(...p))}`);
    }),
  );

/** path → { title, description, h1, body, ld[], noNav } */
const pages = [
  {
    path: "/",
    title: "Web development and IT services company in Jaipur, India",
    description: SITE.description,
    h1: "StackFox — web development and IT services company in Jaipur, India",
    body: () =>
      `<p>StackFox by Artwall Labs is a web development and IT services company in Jaipur, India that publishes the price of every service. Browse ${countLabel} services across ${data.categories.length} categories — web development, mobile apps, AI and automation, e-commerce, UI/UX, DevOps, cybersecurity and SEO — see the price of each in rupees (from ${inr(minPrice)}), build a cart and get a quote instantly. Based in ${esc(brand.address)}.</p><h2>Service categories</h2>${ul(
        data.categories.map((c) => li(`${esc(c.name)} — ${esc(c.description)}`)),
      )}`,
    ld: [orgLd, siteLd],
  },
  {
    path: "/builder",
    title: "Build & Price: configure an IT project and get a quote",
    description:
      "Pick the exact IT services you need, see a live total in INR and request a quote — no meetings or proposals required.",
    h1: "Build & Price your project",
    body: () =>
      `<p>Choose from ${countLabel} services, see the running total with ${data.meta.gstRate}% GST, and send the cart as a quote request.</p>`,
  },
  {
    path: "/catalog",
    title: `All IT services & prices (${countLabel} services)`,
    description: `Browse ${countLabel} IT services in ${data.categories.length} categories with transparent INR pricing and delivery times, from ${inr(minPrice)}.`,
    h1: "IT services catalogue",
    body: catalogBody,
  },
  {
    path: "/packages",
    title: "Pre-built IT packages that save 15–30%",
    description:
      "Curated bundles of web, mobile, e-commerce, SaaS, AI and security services priced below buying each service separately.",
    h1: "Pre-built packages",
    body: pkgBody,
  },
  {
    path: "/pricing",
    title: "Transparent IT services pricing in INR",
    description:
      "Every StackFox service is priced individually in rupees. See the price range for each category before you talk to anyone.",
    h1: "Transparent pricing, no surprises",
    body: pricingBody,
  },
  {
    path: "/industries",
    title: "IT solutions by industry: healthcare, real estate, e-commerce",
    description:
      "Pre-configured bundles for healthcare, real estate, e-commerce, education, food and events businesses.",
    h1: "Solutions built for your industry",
    body: industriesBody,
  },
  {
    path: "/portfolio",
    title: "Portfolio: selected projects across industries",
    description:
      "Selected StackFox projects across industries, from storefronts to patient portals.",
    h1: "Our work",
    body: () =>
      `<p>Selected projects across e-commerce, education, events, food, healthcare and real estate.</p>`,
  },
  {
    path: "/about",
    title: "About StackFox by Artwall Labs",
    description: clip(data.company.story),
    h1: "About StackFox",
    body: () =>
      `<p>${esc(data.company.story)}</p><h2>Our values</h2>${ul(data.company.values.map((v) => li(`<strong>${esc(v.title)}</strong> — ${esc(v.description)}`)))}`,
    ld: [orgLd],
  },
  {
    path: "/contact",
    title: "Contact StackFox",
    description: `Talk to the StackFox team in ${brand.address}. Email ${brand.email} or call ${brand.phone}.`,
    h1: "Contact us",
    body: () =>
      `<p>Email ${esc(brand.email)} · Phone ${esc(brand.phone)} · ${esc(brand.address)}.</p>`,
  },
  {
    path: "/resources",
    title: "Resources & blog",
    description:
      "Insights on web development, AI and product strategy from the StackFox team.",
    h1: "Learn, build and grow",
    body: () =>
      `<p>Articles and how-to guides.</p>${ul(guides.map((g) => li(a(`/guides/${g.slug}`, g.title))))}`,
  },
  {
    path: "/guides",
    title: "How-to guides for startups and SMEs",
    description:
      "Practical guides on choosing a website, GST for service businesses, SEO basics, mobile vs web apps and AI automation ROI.",
    h1: "How-to guides and explainers",
    body: () =>
      ul(
        guides.map((g) =>
          li(`${a(`/guides/${g.slug}`, g.title)} — ${esc(g.description)}`),
        ),
      ),
  },
  {
    path: "/faq",
    title: "FAQ: pricing, timelines, payments and support",
    description:
      "Answers on how StackFox pricing works, payment methods, project timelines, refunds, revisions, NDAs and ongoing support.",
    h1: "Frequently asked questions",
    body: faqBody,
    ld: [
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  },
  {
    path: "/careers",
    title: "Careers at StackFox",
    description:
      "Join a team that ships fast, learns constantly and trusts its people. Roles in Jaipur and remote.",
    h1: "Build the future with us",
    body: () => `<p>Open roles are listed on the page.</p>`,
  },
  {
    path: "/programs",
    title: "Startup program and partnerships",
    description:
      "Early-stage startups can get up to 30% off StackFox services. See programs and partnership options.",
    h1: "Programs & partnerships",
    body: () =>
      `<p>Our Startup Program offers up to 30% off for early-stage startups.</p>`,
  },
  {
    path: "/tools/gst-invoice",
    title: "Free GST invoice generator for India",
    description:
      "Create a GST-compliant tax invoice with GSTIN, SAC code, place of supply and CGST/SGST/IGST breakup, and download it as PDF.",
    h1: "Free GST Invoice Generator",
    body: () =>
      `<p>Generate a tax invoice with GSTIN of both parties, SAC code, place of supply and the correct IGST or CGST + SGST split.</p>`,
  },
  {
    path: "/tools/website-audit",
    title: "Free AI website audit",
    description: "Run a free AI-powered audit of your website and see what to fix first.",
    h1: "Free AI Website Audit",
    body: () => `<p>Paste your website URL to get a quick audit.</p>`,
  },
  {
    path: "/tools/brief-generator",
    title: "AI project brief generator",
    description:
      "Turn a rough idea into a structured project brief you can hand to any development team.",
    h1: "AI Brief Generator",
    body: () => `<p>Describe your idea and get a structured brief.</p>`,
  },
  {
    path: "/tools/legal-templates",
    title: "Free legal templates for IT projects",
    description:
      "Download starter legal templates such as NDAs for software and IT engagements.",
    h1: "Legal templates",
    body: () => `<p>Starter templates for IT engagements.</p>`,
  },
  {
    path: "/tools/glossary",
    title: "IT glossary in plain English",
    description:
      "Plain-language definitions of common web, mobile, cloud and security terms for non-technical buyers.",
    h1: "IT glossary",
    body: () => `<p>Plain-English explanations of technical terms.</p>`,
  },
  ...landings.map((l) => {
    const f = (t) => fillTokens(t, data.services);
    const rows = l.serviceIds.map((id) => data.services.find((s) => s.id === id));
    const jaipur = l.slug.includes("jaipur");
    return {
      path: landingPath(l),
      title: l.title,
      description: f(l.description),
      h1: l.h1,
      body: () =>
        `<p>${esc(f(l.answer))}</p><h2>What you get</h2>${ul(l.why.map((w) => li(`<strong>${esc(w.t)}.</strong> ${esc(w.d)}`)))}<h2>Prices</h2><p>Indicative starting prices in rupees, excluding ${data.meta.gstRate}% GST.</p>${ul(rows.map((s) => li(`${esc(s.name)} — from ${inr(s.price)} per ${esc(s.unit)}, ${esc(s.est)}`)))}<h2>Common questions</h2>${l.faqs.map((q) => `<h3>${esc(q.q)}</h3><p>${esc(f(q.a))}</p>`).join("")}<h2>Guides</h2>${ul(
          l.guides
            .map((g) => guides.find((x) => x.slug === g))
            .filter(Boolean)
            .map((g) => li(a(`/guides/${g.slug}`, g.title))),
        )}`,
      ld: [
        {
          "@type": "Service",
          name: l.title,
          description: f(l.answer),
          provider: { "@id": ORG_ID },
          areaServed: jaipur
            ? [
                { "@type": "City", name: "Jaipur" },
                { "@type": "Country", name: "India" },
              ]
            : { "@type": "Country", name: "India" },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: l.title,
            itemListElement: rows.map((s) => ({
              "@type": "Offer",
              priceCurrency: "INR",
              price: s.price,
              itemOffered: { "@type": "Service", name: s.name },
            })),
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: l.faqs.map((q) => ({
            "@type": "Question",
            name: q.q,
            acceptedAnswer: { "@type": "Answer", text: f(q.a) },
          })),
        },
      ],
    };
  }),
  ...guides.map((g) => ({
    path: `/guides/${g.slug}`,
    title: g.title,
    description: g.description,
    h1: g.title,
    body: () => g.html,
    ld: [
      {
        "@type": "Article",
        headline: g.title,
        description: g.description,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        mainEntityOfPage: absUrl(`/guides/${g.slug}`),
      },
    ],
    crumb: [["Guides", "/guides"]],
  })),
  ...services.map((s) => {
    const m = serviceMeta(s);
    return {
      path: servicePath(s),
      title: m.title,
      description: m.description,
      h1: `${s.name}: cost and pricing`,
      body: () =>
        `<p>${esc(s.name)} starts at ${inr(s.price)} per ${esc(s.unit)} (excluding ${data.meta.gstRate}% GST), with typical delivery in ${esc(s.est)}. Category: ${esc(catName[s.catId])}.</p><p>${esc(s.lay || "")}</p><p>${esc(data.meta.priceDisclaimer)}</p>`,
      ld: [
        {
          "@type": "Service",
          name: s.name,
          description: s.lay || m.description,
          category: catName[s.catId],
          provider: { "@id": ORG_ID },
          areaServed: "IN",
          offers: {
            "@type": "Offer",
            price: s.price,
            priceCurrency: "INR",
            url: absUrl(servicePath(s)),
          },
        },
      ],
      crumb: [
        ["Services", "/catalog"],
        [catName[s.catId], "/catalog"],
      ],
    };
  }),
];

const metaRe = (attr, key) =>
  new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/>`);
const rep = (html, re, val) => {
  if (!re.test(html)) throw new Error(`prerender: template drift, no match for ${re}`);
  return html.replace(re, () => val);
};

function render(p) {
  const title = `${p.title} — ${SITE.name}`;
  const url = absUrl(p.path);
  const desc = clip(p.description, 200);
  let html = template;
  html = rep(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = rep(
    html,
    metaRe("name", "description"),
    `<meta name="description" content="${esc(desc)}" />\n    <link rel="canonical" href="${url}" />`,
  );
  html = rep(
    html,
    metaRe("property", "og:title"),
    `<meta property="og:title" content="${esc(title)}" />`,
  );
  html = rep(
    html,
    metaRe("property", "og:description"),
    `<meta property="og:description" content="${esc(desc)}" />`,
  );
  html = rep(
    html,
    metaRe("property", "og:url"),
    `<meta property="og:url" content="${url}" />`,
  );
  html = rep(
    html,
    metaRe("name", "twitter:title"),
    `<meta name="twitter:title" content="${esc(title)}" />`,
  );
  html = rep(
    html,
    metaRe("name", "twitter:description"),
    `<meta name="twitter:description" content="${esc(desc)}" />`,
  );
  const graph = [
    ...(p.ld || []),
    crumbs([
      ["Home", "/"],
      ...(p.crumb || []),
      ...(p.path === "/" ? [] : [[p.h1, p.path]]),
    ]),
  ];
  if (p.path === "/") graph.pop();
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
  html = rep(html, /<\/head>/, `    ${ld}\n  </head>`);
  const sr =
    "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
  html = rep(
    html,
    /<div id="root"><\/div>/,
    `<div id="root"><main style="${sr}"><h1>${esc(p.h1)}</h1>${p.body()}${navHtml}</main></div>`,
  );
  return html;
}

const out = (rel, content) => {
  const f = join(dist, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, content);
};

for (const p of pages)
  out(p.path === "/" ? "index.html" : `${p.path.slice(1)}/index.html`, render(p));
out("app-shell.html", template);

out(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${absUrl(p.path)}</loc></url>`).join("\n")}\n</urlset>\n`,
);

out(
  "llms.txt",
  `# StackFox

> ${SITE.description} StackFox is a product of Artwall Labs, based in ${brand.address}. Prices are in INR and exclude ${data.meta.gstRate}% GST.

## Key pages
${[
  [
    "/catalog",
    "Service catalogue",
    `${countLabel} IT services with prices and delivery times`,
  ],
  ["/builder", "Build & Price", "Configure services and get an instant quote"],
  ["/packages", "Packages", "Pre-built packages"],
  ["/pricing", "Pricing", "Price ranges by category"],
  ["/faq", "FAQ", "Frequently asked questions"],
  ["/about", "About", "About StackFox"],
  ["/contact", "Contact", "Contact details"],
]
  .map(([p, t, d]) => `- [${t}](${absUrl(p)}): ${d}`)
  .join("\n")}

## Services by location
${landings.map((l) => `- [${l.title}](${absUrl(landingPath(l))}): ${fillTokens(l.description, data.services)}`).join("\n")}

## Guides
${guides.map((g) => `- [${g.title}](${absUrl(`/guides/${g.slug}`)}): ${g.description}`).join("\n")}

## Service categories
${data.categories.map((c) => `- ${c.name}: ${c.description}`).join("\n")}

## Contact
- Email: ${brand.email}
- Phone: ${brand.phone}
`,
);

// Full plain-text catalogue for AI assistants that want prices and FAQs in one fetch.
const L = (arr) => arr.join("\n");
out(
  "llms-full.txt",
  `# StackFox — full catalogue

> ${SITE.description} Prices are indicative, in INR, and exclude ${data.meta.gstRate}% GST. Contact: ${brand.email}, ${brand.phone}, ${brand.address}.

${data.categories
  .map((c) =>
    L([
      `## ${c.name}`,
      c.description,
      ...services
        .filter((s) => s.catId === c.id)
        .map(
          (s) =>
            `- ${s.name}: from ${inr(s.price)} per ${s.unit}, ${s.est}. ${(s.lay || "").trim()}`,
        ),
    ]),
  )
  .join("\n\n")}

## Packages
${L(data.packages.map((p) => `- ${p.name}: ${inr(p.price)}. ${p.description}`))}

## Frequently asked questions
${faqs.map((f) => L([`### ${f.q}`, f.a])).join("\n\n")}
`,
);

console.log(
  `prerender: ${pages.length} pages, sitemap.xml, llms.txt, llms-full.txt, app-shell.html`,
);

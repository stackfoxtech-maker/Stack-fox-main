// Shared by the app (hooks.js) and the build-time prerender (scripts/prerender.mjs),
// so it must stay dependency-free plain ESM.

export const SITE = {
  url: 'https://www.stackfox.in', // apex stackfox.in 308s to www
  name: 'StackFox',
  tagline: 'Smart Code, Swift Delivery',
  description:
    'Web development and IT services company in Jaipur, India. Websites, mobile apps, AI and automation with every price published in INR. Build a quote in minutes.',
};

export const absUrl = (path = '/') => {
  const p = '/' + String(path).replace(/^\/+|\/+$/g, '');
  return SITE.url + (p === '/' ? '/' : p);
};

export const clip = (s, n = 155) => {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
};

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

/** The shared catalogue carries test rows (₹2/₹5 workflow tests, "Fuzz" fixtures; real services start at ₹1,500) — keep them out of search. */
export const indexableServices = (data) => {
  const cats = new Set(data.categories.map((c) => c.id));
  return data.services.filter((s) => cats.has(s.catId) && s.price >= 100);
};

export const servicePath = (s) => `/services/${s.catId}/${s.slug || s.id}/cost`;

export const serviceMeta = (s) => ({
  title: `${s.name} cost in India`.length > 55 ? `${s.name} cost` : `${s.name} cost in India`,
  description: clip(
    `${s.name}: starts at ${inr(s.price)} per ${s.unit}, delivered in about ${s.est}. ${s.lay || ''}`,
  ),
});

/** Landing-page copy carries {p:<serviceId>} (price) and {e:<serviceId>} (delivery time) tokens so figures follow the catalogue. */
export const fillTokens = (text, services) =>
  String(text).replace(/\{([pe]):([\w-]+)\}/g, (_, kind, id) => {
    const s = services.find((x) => x.id === id);
    if (!s) throw new Error(`landing token: unknown service ${id}`);
    return kind === 'p' ? inr(s.price) : s.est;
  });

export const landingPath = (l) => `/${l.slug}`;

/**
 * Regenerate client/src/data/catalog-summary.json from the canonical catalogue.
 *
 *   node scripts/gen-catalog-summary.mjs
 *
 * The homepage only needs category names + per-category counts, not the full
 * 100 KB service list. This ~2 KB summary keeps that data off the landing-page
 * bundle (PERF_AUDIT P1-1). Re-run whenever shared/stackfox-data.json changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'shared', 'stackfox-data.json');
const out = join(here, '..', 'src', 'data', 'catalog-summary.json');

const data = JSON.parse(readFileSync(src, 'utf8'));
const counts = {};
for (const s of data.services) counts[s.catId] = (counts[s.catId] || 0) + 1;

const summary = {
  serviceCount: data.services.length,
  categories: data.categories.map((c) => ({
    id: c.id, name: c.name, icon: c.icon, description: c.description, count: counts[c.id] || 0,
  })),
};

writeFileSync(out, JSON.stringify(summary, null, 2) + '\n');
console.log(`catalog-summary.json — ${summary.categories.length} categories, ${summary.serviceCount} services`);

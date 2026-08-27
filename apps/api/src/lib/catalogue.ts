import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * The storefront catalogue.
 *
 * StackFox has two catalogues that were never reconciled: the `ServiceUnit`
 * table (219 rows, ids like `SF-UI-017`, prices in paise) and this JSON file
 * (255 services, ids like `web-001`, prices in rupees). Every public page —
 * Catalog, Builder, Packages, Industries — renders from the JSON, so the ids
 * and prices a customer actually clicks come from here.
 *
 * The cart therefore has to price against this file, or server-side price
 * validation rejects every real item. Prices here are in RUPEES, matching what
 * the storefront displays.
 *
 * The file is read once and cached; it ships with the API image (see
 * Dockerfile.server) so this works in production, not just in the workspace.
 */

export type CatalogueItemType = "service" | "package" | "bundle" | "addon";

export interface CatalogueItem {
  id: string;
  name: string;
  price: number; // rupees
  type: CatalogueItemType;
  category?: string;
}

interface RawCatalogue {
  services?: Array<{ id: string; name: string; price: number; catId?: string; unit?: string; est?: string; lay?: string }>;
  packages?: Array<{ id: string; name: string; price: number }>;
  industryBundles?: Array<{ id: string; name: string; price: number }>;
  addons?: Array<{ id: string; name: string; price: number; desc?: string }>;
  categories?: Array<{ id: string; name: string }>;
  meta?: Record<string, any>;
  tourSteps?: any[];
  resources?: any[];
  careers?: any;
  company?: any;
  testimonials?: any[];
  faq?: any[];
}

/**
 * Candidate locations, in order. `CATALOGUE_PATH` wins so a deployment can
 * point somewhere else without a rebuild; `shared/` is the canonical home; the
 * client copy is a workspace fallback for local development.
 */
function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.CATALOGUE_PATH) paths.push(resolve(process.env.CATALOGUE_PATH));
  paths.push(
    resolve(__dirname, "../../../../shared/stackfox-data.json"),
    resolve(process.cwd(), "shared/stackfox-data.json"),
    resolve(process.cwd(), "../../shared/stackfox-data.json"),
    resolve(__dirname, "../../../../client/src/data/stackfox-data.json"),
  );
  return paths;
}

let cache: Map<string, CatalogueItem> | null = null;
let loadedFrom: string | null = null;

function load(): Map<string, CatalogueItem> {
  if (cache) return cache;

  const path = candidatePaths().find((p) => existsSync(p));
  if (!path) {
    throw new Error(
      "Catalogue file not found. Looked in: " +
        candidatePaths().join(", ") +
        ". Set CATALOGUE_PATH to override.",
    );
  }

  const raw = JSON.parse(readFileSync(path, "utf8")) as RawCatalogue;
  const map = new Map<string, CatalogueItem>();
  const categories = new Map((raw.categories ?? []).map((c) => [c.id, c.name]));

  const add = (
    rows: Array<{ id: string; name: string; price: number; catId?: string }> | undefined,
    type: CatalogueItemType,
  ) => {
    for (const row of rows ?? []) {
      if (!row?.id) continue;
      map.set(row.id, {
        id: row.id,
        name: row.name,
        price: Number(row.price) || 0,
        type,
        category: row.catId ? categories.get(row.catId) : undefined,
      });
    }
  };

  add(raw.services, "service");
  add(raw.packages, "package");
  add(raw.industryBundles, "bundle");
  add(raw.addons, "addon");

  cache = map;
  loadedFrom = path;
  console.log(`[catalogue] Loaded ${map.size} purchasable items from ${path}`);
  return cache;
}

/** Looks an item up by id. Type is advisory — ids are unique across the file. */
export function findCatalogueItem(id: string): CatalogueItem | null {
  if (!id) return null;
  return load().get(id) ?? null;
}

export function catalogueSize(): number {
  return load().size;
}

export function catalogueSource(): string | null {
  if (!cache) load();
  return loadedFrom;
}

/** Clears the cache — used by tests and after an operator edits the file. */
export function reloadCatalogue(): void {
  cache = null;
  loadedFrom = null;
}

// ── File-backed sync (admin edits → static JSON) ──

const TIER_TO_PREFIX: Record<string, string> = {
  WEB: "web",
  MOB: "mob",
  AI: "ai",
  AUTO: "auto",
  ECO: "ecom",
  UIX: "ui",
  API: "be",
  DEV: "devops",
  SEC: "sec",
  SEO: "seo",
  CON: "consult",
  SAAS: "saas",
  MNT: "maint",
};

function dbIdToJsonPrefix(dbId: string): string | null {
  const match = dbId.match(/^SF-([A-Z]+)-/);
  if (!match) return null;
  return TIER_TO_PREFIX[match[1]] ?? null;
}

function dbIdToJsonId(dbId: string): string | null {
  const match = dbId.match(/^SF-([A-Z]+)-(\d+)$/);
  if (!match) return null;
  const prefix = dbIdToJsonPrefix(dbId);
  if (!prefix) return null;
  return `${prefix}-${match[2]}`;
}

export function cataloguePath(): string | null {
  return candidatePaths().find((p) => existsSync(p)) ?? null;
}

export function readRawCatalogue(): RawCatalogue | null {
  const path = cataloguePath();
  if (!path) return null;
  return JSON.parse(readFileSync(path, "utf8")) as RawCatalogue;
}

export function writeRawCatalogue(raw: RawCatalogue): void {
  const path = cataloguePath();
  if (!path) throw new Error("Catalogue file not found");
  writeFileSync(path, JSON.stringify(raw, null, 2), "utf8");
}

export function updateServiceNameInCatalogue(dbId: string, newName: string): boolean {
  const raw = readRawCatalogue();
  if (!raw || !raw.services) return false;

  let updated = false;
  const jsonId = dbIdToJsonId(dbId);

  if (jsonId) {
    const svc = raw.services.find((s) => s.id === jsonId);
    if (svc) {
      svc.name = newName;
      updated = true;
    }
  }

  if (!updated) {
    const svc = raw.services.find((s) => s.name === newName);
    if (svc) return false;
    const tier = dbId.replace(/^SF-/, "").split("-")[0];
    const prefix = TIER_TO_PREFIX[tier] ?? tier.toLowerCase();
    const num = dbId.split("-").pop() ?? "001";
    const newId = `${prefix}-${num}`;
    const existing = raw.services.find((s) => s.id === newId);
    if (existing) {
      existing.name = newName;
      updated = true;
    }
  }

  if (!updated) return false;

  writeRawCatalogue(raw);
  reloadCatalogue();
  return true;
}

export function addServiceToCatalogue(dbService: {
  id: string;
  name: string;
  categoryTier1: string;
  starterPrice?: number | null;
  starterTimelineDays?: number | null;
}): boolean {
  const raw = readRawCatalogue();
  if (!raw) return false;

  const prefix = dbIdToJsonPrefix(dbService.id);
  const num = dbService.id.split("-").pop() ?? "001";
  const jsonId = prefix ? `${prefix}-${num}` : dbService.id.toLowerCase();

  if (raw.services?.some((s) => s.id === jsonId)) return false;

  raw.services = raw.services ?? [];
  raw.services.push({
    id: jsonId,
    name: dbService.name,
    price: Math.round((dbService.starterPrice ?? 0) / 100),
    catId: dbService.categoryTier1,
    unit: "project",
    est: `${dbService.starterTimelineDays ?? 7} days`,
    lay: "",
  });

  writeRawCatalogue(raw);
  reloadCatalogue();
  return true;
}

export function removeServiceFromCatalogue(dbId: string): boolean {
  const raw = readRawCatalogue();
  if (!raw || !raw.services) return false;

  const jsonId = dbIdToJsonId(dbId);
  if (!jsonId) return false;

  const idx = raw.services.findIndex((s) => s.id === jsonId);
  if (idx === -1) return false;

  raw.services.splice(idx, 1);
  writeRawCatalogue(raw);
  reloadCatalogue();
  return true;
}

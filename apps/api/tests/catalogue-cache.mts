/**
 * The catalogue cache must not outlive a write to it.
 *
 * lib/catalogue.ts reads the shared catalogue file once and memoises it.
 * writeRawCatalogue() wrote the file and left the memo alone, so an admin who
 * created, renamed or deleted a service saw the change land on disk and then
 * not appear anywhere until the process restarted.
 *
 * Pure file + memory, no HTTP and no database.
 *   pnpm --filter @stackfox/api test:catalogue
 */
import "../src/env";
import { readFileSync, writeFileSync } from "node:fs";
import {
  catalogueSize,
  cataloguePath,
  findCatalogueItem,
  readRawCatalogue,
  reloadCatalogue,
  writeRawCatalogue,
} from "../src/lib/catalogue";

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

const path = cataloguePath();
if (!path) {
  console.log("FAIL  catalogue file not found — nothing to test");
  process.exit(1);
}

// Keep the real file byte-for-byte so this suite cannot corrupt the catalogue.
const original = readFileSync(path, "utf8");

try {
  reloadCatalogue();
  const sizeBefore = catalogueSize();
  check(`the catalogue loads (${sizeBefore} items)`, sizeBefore > 0);

  const raw = readRawCatalogue();
  check("the raw file is readable", raw !== null && Array.isArray(raw.services));
  if (!raw?.services) throw new Error("no services array");

  // Add a service through the same path the admin routes use.
  const id = `SF-CAT-TEST-${Date.now()}`;
  raw.services.push({
    id,
    name: "Cache Invalidation Probe",
    categoryL1: "Test",
    starterPrice: 123456,
  } as never);

  writeRawCatalogue(raw);

  // The whole point: no reloadCatalogue() call here. If the cache were still
  // warm this would return the pre-write size and a null lookup.
  check(
    `a write is visible without an explicit reload (${sizeBefore} -> ${catalogueSize()})`,
    catalogueSize() === sizeBefore + 1,
    "the cache outlived the write — this is the bug",
  );
  check(
    "the newly written service is findable immediately",
    findCatalogueItem(id) !== null,
    "an admin's create landed on disk and was invisible until restart",
  );

  // And a removal is visible too, not just an addition.
  const after = readRawCatalogue();
  if (!after?.services) throw new Error("catalogue unreadable after write");
  after.services = after.services.filter((svc: { id: string }) => svc.id !== id);
  writeRawCatalogue(after);

  check(
    `a delete is visible without an explicit reload (${catalogueSize()})`,
    catalogueSize() === sizeBefore,
    "removal left a phantom entry in memory",
  );
  check("the removed service is gone from lookups", findCatalogueItem(id) === null);
} finally {
  // Restore the file exactly, then drop the memo so nothing downstream sees
  // the probe's state.
  writeFileSync(path, original, "utf8");
  reloadCatalogue();
}

check(
  "the catalogue file is restored byte-for-byte",
  readFileSync(path, "utf8") === original,
  "this suite must not be able to corrupt the catalogue",
);

console.log("\n--- CATALOGUE CACHE ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL CATALOGUE CACHE CHECKS PASSED" : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);

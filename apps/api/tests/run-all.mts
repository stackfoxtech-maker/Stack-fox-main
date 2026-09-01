/**
 * Runs every regression suite and reports a combined result.
 *
 * The `test` script used to chain the suites with `&&`, so the first failure
 * aborted the run and the remaining suites (reports-handover, staff-surfaces,
 * cart) never executed — a red suite masked whatever else had regressed. This
 * runs all of them regardless and exits non-zero if any failed.
 *
 * Requires the API on :4000 (see individual suite headers).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Resolve the tsx CLI so each suite runs the same way `tsx <file>` would,
// independent of Node's loader-flag spelling across versions.
const tsxCli = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

const SUITES = [
  "tenant-isolation.mts",
  "access-control.mts",
  "reports-handover.mts",
  "staff-surfaces.mts",
  "cart.mts",
];

function run(file: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsxCli, join(here, file)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const results: Array<{ suite: string; code: number }> = [];
for (const suite of SUITES) {
  console.log(`\n─── ${suite} ───`);
  results.push({ suite, code: await run(suite) });
}

console.log("\n═══ Summary ═══");
for (const r of results) {
  console.log(`${r.code === 0 ? "PASS" : "FAIL"}  ${r.suite}`);
}

const failed = results.filter((r) => r.code !== 0);
if (failed.length) {
  console.error(`\n${failed.length}/${results.length} suite(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} suites passed`);

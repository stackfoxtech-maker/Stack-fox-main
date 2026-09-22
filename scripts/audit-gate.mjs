#!/usr/bin/env node
/**
 * Dependency audit gate.
 *
 * `pnpm audit` exits 0 even with 12 high-severity advisories outstanding, so
 * it reports rather than gates. This wraps it so CI fails on anything new,
 * while carrying the advisories that are genuinely blocked on other work.
 *
 * An entry in ACCEPTED is not a dismissal. It records why the advisory cannot
 * be fixed today and the date the exception stops being honoured — after which
 * this script fails whether or not the advisory is still open, so a stale
 * exception surfaces as a broken build rather than as silence.
 *
 *   node scripts/audit-gate.mjs            # workspace (pnpm)
 *   node scripts/audit-gate.mjs --npm      # client/ (standalone npm project)
 */
import { execFileSync } from "node:child_process";

const FAIL_AT = ["high", "critical"];

const ACCEPTED = [
  {
    module: "js-yaml",
    reason:
      "Transitive under @changesets/cli. Build tooling only — never present " +
      "in a deployed artifact.",
    until: "2026-12-31",
  },
  {
    module: "vite",
    reason:
      "client/ devDependency. Three advisories, all against the dev server: " +
      "path traversal in optimised-deps .map handling, a server.fs.deny " +
      "bypass on Windows alternate paths, and launch-editor NTLMv2 " +
      "disclosure. Production runs `vite build`, whose output is static " +
      "assets on Vercel — the dev server never runs there. No patched 5.x " +
      "exists; the fix starts at 6.4.3, a major bump for a React 18 client " +
      "on Vite 5, which is not something to land inside the PR that closes " +
      "a live authentication bypass. Tracked separately.",
    until: "2026-11-30",
  },
  {
    module: "vitest",
    reason:
      "client/ devDependency, test runner only. The critical advisory needs " +
      "the Vitest UI server listening; @vitest/ui is not installed and no " +
      "script passes --ui, so it is unreachable rather than merely " +
      "dev-only. The @vitest/mocker path-traversal advisory is fixed in " +
      "4.1.11 — two majors up from 2.1.9. Bumped with vite, since the two " +
      "share a version line.",
    until: "2026-11-30",
  },
];

// Resolved 2026-09-21 by the Fastify 4 -> 5 upgrade, and removed from the list
// above rather than left to expire:
//
//   fastify       GHSA-jx2c-rxcm-jvmq, a body-validation bypass via a tab
//                 character in Content-Type. Fixed in fastify 5.
//   find-my-way   Fixed in 9.7; fastify 4 pinned ^8.0.0, so it could not move
//                 until fastify did.
//   fast-uri      Transitive under ajv. Pinned to ^3.1.6 with a pnpm override
//                 — a patch bump inside the same major.
//
// That took the workspace from 12 high/critical advisories to 2.

const npmMode = process.argv.includes("--npm");
const cmd = npmMode ? "npm" : "pnpm";
const args = npmMode ? ["audit", "--json"] : ["audit", "--json"];

let raw = "";
try {
  raw = execFileSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
} catch (err) {
  // Both tools exit non-zero when they find anything; the JSON is still on stdout.
  raw = err.stdout ?? "";
  if (!raw) {
    console.error(`[audit] ${cmd} audit produced no output:`, err.message);
    process.exit(1);
  }
}

/** Normalise pnpm's `advisories` map and npm 7+'s `vulnerabilities` map. */
function collect(text) {
  const d = JSON.parse(text);
  const out = [];
  for (const a of Object.values(d.advisories ?? {})) {
    out.push({ module: a.module_name, severity: a.severity, title: a.title, url: a.url });
  }
  for (const [name, v] of Object.entries(d.vulnerabilities ?? {})) {
    if (!v.severity) continue;
    const via = (v.via ?? []).find((x) => typeof x === "object");
    out.push({
      module: name,
      severity: v.severity,
      title: via?.title ?? "",
      url: via?.url ?? "",
    });
  }
  return out;
}

const today = new Date().toISOString().slice(0, 10);
const found = collect(raw).filter((a) => FAIL_AT.includes(a.severity));

// An exception past its date fails the build on its own, so nobody has to
// remember to come back to it.
const expired = ACCEPTED.filter((e) => e.until < today);
for (const e of expired) {
  console.error(
    `[audit] The exception for ${e.module} expired on ${e.until}. Re-assess it.`,
  );
}

const accepted = new Set(ACCEPTED.filter((e) => e.until >= today).map((e) => e.module));
const blocking = found.filter((a) => !accepted.has(a.module));

for (const a of found.filter((x) => accepted.has(x.module))) {
  console.log(`[audit] carried  ${a.severity.padEnd(8)} ${a.module}`);
}
for (const a of blocking) {
  console.error(`[audit] BLOCKING ${a.severity.padEnd(8)} ${a.module}  ${a.title}`);
  if (a.url) console.error(`                 ${a.url}`);
}

if (blocking.length || expired.length) {
  console.error(
    `\n[audit] ${blocking.length} unaccepted high/critical advisor` +
      `${blocking.length === 1 ? "y" : "ies"}` +
      (expired.length ? ` and ${expired.length} expired exception(s)` : "") +
      ". Fix them, or add a dated entry to ACCEPTED in scripts/audit-gate.mjs.",
  );
  process.exit(1);
}

console.log(
  `[audit] ${found.length} high/critical advisor${found.length === 1 ? "y" : "ies"}, all accounted for.`,
);

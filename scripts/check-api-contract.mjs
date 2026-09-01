#!/usr/bin/env node
/**
 * Static contract check: every endpoint the client calls must exist in the API.
 *
 * This is the check that would have caught the RFP / Builder-catalogue / OTP /
 * remove-watermark 404s. It parses `api.*(...)` / `apiGet(...)` etc. call sites
 * in client/src and `app.<method>("/path")` route declarations in
 * apps/api/src/routes, normalises path params, and reports client calls with no
 * matching route.
 *
 * Exit 1 on any unmatched call. Run: `node scripts/check-api-contract.mjs`
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(m?[jt]sx?)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Known exceptions, each with a reason. Keep this list short and shrinking.
 *  - /admin/:x, /admin/:x/:x — Catalog.jsx builds the path from a fixed tab set
 *    (`/admin/${tab}` where tab ∈ services|features|dependencies|bundles); every
 *    concrete path resolves, the checker just can't see through the variable.
 */
const ALLOW = new Set([
  "/admin/:x",
  "/admin/:x/:x",
]);

const norm = (u) =>
  u
    .split("?")[0]
    .replace(/\$\{[^}]+\}/g, ":x") // client template literals
    .replace(/:[A-Za-z_]+/g, ":x") // fastify params
    .replace(/\/+$/, "") || "/";

// ---- API routes ----
const routeFiles = walk(join(ROOT, "apps/api/src/routes"));
const routes = new Set();
const ROUTE_RE = /\bapp\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]/g;
const ROUTE_RE_ML = /\bapp\.(get|post|put|patch|delete)\(\s*\n\s*[`'"]([^`'"]+)[`'"]/g;
for (const f of routeFiles) {
  const src = readFileSync(f, "utf8");
  for (const re of [ROUTE_RE, ROUTE_RE_ML]) {
    for (const m of src.matchAll(re)) routes.add(norm(m[2]));
  }
}
// Health check lives in server.ts, not a route module.
routes.add("/health");

// ---- Client calls ----
const clientFiles = walk(join(ROOT, "client/src"));
const CALL_RE =
  /\b(?:api|apiGet|apiPost|apiPut|apiDelete|apiUpload)\s*(?:\.\s*(?:get|post|put|patch|delete)\s*)?\(\s*[`'"]([^`'"]+)/g;
const missing = new Map();
for (const f of clientFiles) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(CALL_RE)) {
    const raw = m[1];
    if (!raw.startsWith("/")) continue;
    const n = norm(raw);
    if (routes.has(n) || ALLOW.has(n)) continue;
    // Tolerate a trailing dynamic verb segment (…/:x/:x) matching any route
    // that shares the first three segments — covers /projects/:id/…/:verb.
    const segs = n.split("/");
    if (
      [...routes].some(
        (r) => r.split("/").slice(0, 3).join("/") === segs.slice(0, 3).join("/") && r.startsWith(n.replace(/(:x)+$/, "")),
      )
    )
      continue;
    if (!missing.has(n)) missing.set(n, new Set());
    missing.get(n).add(f.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  }
}

if (missing.size === 0) {
  console.log(`api-contract: OK — ${routes.size} routes, all client calls matched`);
  process.exit(0);
}

console.error("api-contract: client calls with no matching API route\n");
for (const [path, files] of [...missing].sort()) {
  console.error(`  ${path}`);
  for (const file of files) console.error(`      ${file}`);
}
console.error(`\n${missing.size} unmatched. Add the route or fix the client path.`);
process.exit(1);

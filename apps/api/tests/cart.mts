/**
 * Cart round-trip against the real storefront catalogue.
 *
 * The storefront renders from shared/stackfox-data.json (ids like `web-001`,
 * prices in rupees) while the ServiceUnit table is a separate catalogue
 * (`SF-UI-017`, paise). Pricing only off the table rejected every real
 * add-to-cart, so this asserts genuine storefront ids work — and that a price
 * sent by the client is ignored in favour of the listed one.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/cart.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// This file is an ES module, so __dirname is not defined.
const here = dirname(fileURLToPath(import.meta.url));

const BASE = "http://localhost:4000";
const stamp = Date.now();

const catalogue = JSON.parse(
  readFileSync(resolve(here, "../../../shared/stackfox-data.json"), "utf8"),
);
const service = catalogue.services[0];
const pkg = catalogue.packages[0];
const bundle = catalogue.industryBundles[0];
const addon = catalogue.addons[0];

const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Cart Tester", email: `cart-${stamp}@example.com`, password: "testpass1234" }),
});
const token = ((await reg.json()) as any).data.accessToken;
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const post = async (p: string, body: unknown) => {
  const r = await fetch(`${BASE}${p}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  return { s: r.status, b: (await r.json()) as any };
};

const checks: Array<[string, boolean]> = [];

for (const [label, item, type] of [
  ["service", service, "service"],
  ["package", pkg, "package"],
  ["bundle", bundle, "bundle"],
  ["addon", addon, "addon"],
] as const) {
  const r = await post("/cart/add", { itemId: item.id, itemType: type, name: item.name, price: item.price });
  const line = r.b?.data?.cart?.items?.find((i: any) => i.itemId === item.id);
  checks.push([`add ${label} "${item.id}" -> ${r.s}`, r.s === 200]);
  checks.push([`  priced from catalogue (${line?.price} == ${item.price})`, line?.price === item.price]);
}

// A tampered price must be ignored — this is the whole point of server pricing.
const tampered = await post("/cart/add", {
  itemId: service.id, itemType: "service", name: "Hacked", price: 1, quantity: 1,
});
const line = tampered.b?.data?.cart?.items?.find((i: any) => i.itemId === service.id);
checks.push([`tampered price rejected (line is ${line?.price}, not 1)`, line?.price === service.price]);
checks.push([`tampered name rejected (line is "${line?.name}")`, line?.name === service.name]);

const unknown = await post("/cart/add", { itemId: "definitely-not-real", itemType: "service" });
checks.push([`unknown item -> ${unknown.s} (expect 404)`, unknown.s === 404]);

// Cart must survive a fresh request (it is Redis-backed, not in-process).
const fetched = await (await fetch(`${BASE}/cart`, { headers: H })).json() as any;
checks.push([`cart persists (${fetched.data?.cart?.items?.length} lines)`, fetched.data?.cart?.items?.length === 4]);
const expectedSubtotal = service.price * 2 + pkg.price + bundle.price + addon.price;
checks.push([
  `subtotal computed server-side (${fetched.data?.cart?.subtotal} == ${expectedSubtotal})`,
  fetched.data?.cart?.subtotal === expectedSubtotal,
]);
checks.push([
  `GST is 18% (${fetched.data?.cart?.gstAmount})`,
  fetched.data?.cart?.gstAmount === Math.round(expectedSubtotal * 0.18),
]);

const cleared = await post("/cart/clear", {});
checks.push([`clear -> ${cleared.s}, ${cleared.b?.data?.cart?.items?.length} lines`, cleared.b?.data?.cart?.items?.length === 0]);

console.log("\n--- CART ---");
let failed = 0;
for (const [label, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"}  ${label}`); if (!pass) failed++; }
console.log(`\n${checks.length - failed}/${checks.length} passed`);
await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);

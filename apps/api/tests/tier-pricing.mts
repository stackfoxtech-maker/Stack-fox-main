/**
 * Tier prices must rise with the tier, from one multiplier table.
 *
 * pricing.ts kept a private Premium multiplier of 1.4 while the quote path
 * used 2.2, so a Premium cart line could cost less than the same line on
 * Growth (1.5). Both paths now read TIER_MULTIPLIERS.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/tier-pricing.mts
 */
import "../src/env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@stackfox/prisma";
import { TIER_MULTIPLIERS, applyTierMultiplier } from "../src/lib/estimate";
import { catalogPrice } from "../src/lib/pricing";

const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

check(
  "the multipliers rise with the tier",
  TIER_MULTIPLIERS.STARTER < TIER_MULTIPLIERS.GROWTH &&
    TIER_MULTIPLIERS.GROWTH < TIER_MULTIPLIERS.PREMIUM,
);
check("Premium is 2.2", TIER_MULTIPLIERS.PREMIUM === 2.2);
check(
  "a subtotal is higher on each step up",
  applyTierMultiplier(100000, "STARTER") < applyTierMultiplier(100000, "GROWTH") &&
    applyTierMultiplier(100000, "GROWTH") < applyTierMultiplier(100000, "PREMIUM"),
);

const pricingSrc = readFileSync(resolve(process.cwd(), "src/lib/pricing.ts"), "utf8");
check(
  "pricing.ts reads the shared multiplier table",
  /TIER_MULTIPLIERS\[/.test(pricingSrc) && /from "\.\/estimate"/.test(pricingSrc),
);
check(
  "pricing.ts has no private tier multiplier",
  !/PREMIUM"\s*\?\s*1\.4/.test(pricingSrc),
);

const svc = await prisma.serviceUnit.findFirst({
  where: { status: "PUBLISHED", starterPrice: { gt: 0 } },
  orderBy: { id: "asc" },
});
if (svc) {
  const [s, g, p] = await Promise.all(
    ["STARTER", "GROWTH", "PREMIUM"].map((t) => catalogPrice(svc.id, "service", t)),
  );
  // A catalogue-JSON id is priced without a tier; only DB-backed ids apply one.
  if (s && g && p && s.source === "db") {
    check(
      `a database service prices Starter <= Growth <= Premium (${s.price}, ${g.price}, ${p.price})`,
      s.price <= g.price && g.price <= p.price,
    );
  }
}

await prisma.$disconnect();
let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL TIER PRICING CHECKS PASSED");

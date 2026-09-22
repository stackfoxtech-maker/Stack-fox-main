/**
 * A quote is priced by the server, not by the client.
 *
 * POST /quotes computed its subtotal as
 *
 *   items.reduce((s, i) => s + i.price * i.quantity, 0)
 *
 * using the `price` the caller sent. The cart has always discarded that field
 * and re-priced from the catalogue — cart.mts asserts exactly that — but its
 * sibling trusted it. And a quote's total becomes the `grandTotal` of a real
 * Invoice through provisionQuote, so a self-declared price became a
 * self-declared bill.
 *
 * Requires the API on :4000.
 *   pnpm --filter @stackfox/api test:quote-pricing
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

/** Only the fields these checks read. */
type ApiBody = {
  data?: {
    accessToken?: string;
    quote?: { id?: string; total?: number };
  };
} | null;

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

async function register() {
  const email = `quote-${stamp}@example.com`;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Quote Test", email, password: "testpass1234" }),
    });
    const b = (await res.json().catch(() => null)) as ApiBody;
    if (b?.data?.accessToken) return b.data.accessToken;
    if (res.status !== 429) throw new Error(`register failed: ${JSON.stringify(b)}`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("register rate-limited out");
}

const token = await register();

async function quoteFromCart(items: unknown[], tier?: string) {
  const res = await fetch(`${BASE}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items, ...(tier ? { tier } : {}) }),
  });
  return {
    status: res.status,
    body: (await res.json().catch(() => null)) as ApiBody,
  };
}

// A real, published service to quote against.
const service = await prisma.serviceUnit.findFirst({
  where: { status: "PUBLISHED", starterPrice: { not: null } },
  orderBy: { id: "asc" },
});
if (!service) {
  console.log("FAIL  no published service with a price — cannot test pricing");
  process.exit(1);
}

const createdQuoteIds: string[] = [];

try {
  // ── The honest path, to establish what the server thinks this costs ───────
  const honest = await quoteFromCart(
    [{ itemId: service.id, itemType: "service", quantity: 1 }],
    "STARTER",
  );
  check(
    `an ordinary quote is created -> ${honest.status}`,
    honest.status === 200 || honest.status === 201,
  );

  const serverTotal = honest.body?.data?.quote?.total;
  if (honest.body?.data?.quote?.id) createdQuoteIds.push(honest.body.data.quote.id);
  check(
    `the server produced a total (${serverTotal})`,
    typeof serverTotal === "number" && serverTotal > 0,
    "without this the comparison below is meaningless",
  );

  // ── The exploit: same item, a price the caller invented ───────────────────
  const tampered = await quoteFromCart(
    [{ itemId: service.id, itemType: "service", quantity: 1, name: "Hacked", price: 1 }],
    "STARTER",
  );
  const tamperedTotal = tampered.body?.data?.quote?.total;
  if (tampered.body?.data?.quote?.id) createdQuoteIds.push(tampered.body.data.quote.id);

  check(
    `a quote with price: 1 is still accepted -> ${tampered.status}`,
    tampered.status === 200 || tampered.status === 201,
    "the field is ignored, not rejected — rejecting would break the live client",
  );
  check(
    `the tampered price is IGNORED (${tamperedTotal} == ${serverTotal})`,
    typeof tamperedTotal === "number" && tamperedTotal === serverTotal,
    "this is the bug: the client's price used to become the quote total, and a " +
      "quote total becomes an invoice grandTotal via provisionQuote",
  );

  // ── An item the catalogue cannot price is refused, not guessed ────────────
  const unknown = await quoteFromCart([
    {
      itemId: `not-a-real-service-${stamp}`,
      itemType: "service",
      quantity: 1,
      price: 999,
    },
  ]);
  check(
    `an unpriceable item is refused -> ${unknown.status}`,
    unknown.status === 400,
    "falling back to the client's price is how the bug would come back",
  );

  // ── Shape ─────────────────────────────────────────────────────────────────
  const empty = await quoteFromCart([]);
  check(`an empty cart is refused -> ${empty.status}`, empty.status === 400);

  const noId = await quoteFromCart([{ itemType: "service", quantity: 1, price: 500 }]);
  check(
    `an item with no itemId is refused -> ${noId.status}`,
    noId.status === 400,
    "without an id there is nothing to price it from except the caller's number",
  );

  const huge = await quoteFromCart(
    Array.from({ length: 201 }, () => ({ itemId: service.id, quantity: 1 })),
  );
  check(`a 201-item quote is refused -> ${huge.status}`, huge.status === 400);
} finally {
  if (createdQuoteIds.length) {
    await prisma.quote.deleteMany({ where: { id: { in: createdQuoteIds } } });
  }
  await prisma.user.deleteMany({ where: { email: `quote-${stamp}@example.com` } });
  await prisma.$disconnect();
}

console.log("\n--- QUOTE PRICING ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL QUOTE PRICING CHECKS PASSED" : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);

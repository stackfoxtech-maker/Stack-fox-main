/**
 * A payment gateway that is unconfigured or rejecting our credentials must not
 * look like an expired login.
 *
 * POST /quotes/:id/pay answered 401 for that case. The web client treats any
 * 401 as an expired session, tries to refresh, fails, and signs the user out —
 * so a payment outage logged every payer out instead of saying "payments are
 * unavailable". This runs only where no gateway credentials exist (the audit
 * and CI stacks), which is exactly the case being tested.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/payment-gateway-unavailable.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

if (process.env.RAZORPAY_KEY_ID) {
  console.log("SKIP  gateway credentials are set; this suite needs none");
  await prisma.$disconnect();
  process.exit(0);
}

const api = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { s: res.status, b: (await res.json().catch(() => null)) as any };
};

const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Gateway Down",
    email: `gateway-down-${stamp}@example.com`,
    password: "GatewayPass123!ok",
  }),
});
const token = ((await reg.json()) as any).data.accessToken as string;

const service = await prisma.serviceUnit.findFirst({
  where: { status: "PUBLISHED", starterPrice: { not: null } },
  orderBy: { id: "asc" },
});
const q = await api("POST", "/quotes", token, {
  items: [{ itemId: service!.id, itemType: "service", quantity: 1 }],
});
check(`a quote is created -> ${q.s}`, q.s === 200);
const quoteId = (q.b?.data?.quote?.id ?? q.b?.data?.id) as string;

const pay = await api("POST", `/quotes/${quoteId}/pay`, token, { paymentMode: "FULL" });
check(`an unavailable gateway is not a 401 (got ${pay.s})`, pay.s !== 401);
check(`it is reported as unavailable -> ${pay.s}`, pay.s === 503);
check(
  "the customer message does not leak environment variable names",
  typeof pay.b?.message === "string" &&
    pay.b.message.length > 0 &&
    !/RAZORPAY|KEY_ID|KEY_SECRET/i.test(pay.b.message),
);

const me = await api("GET", "/auth/me", token);
check(`the session is still valid afterwards -> ${me.s}`, me.s === 200);

const row = await prisma.quote.findUnique({ where: { id: quoteId } });
check("no gateway order was recorded on the quote", !row?.razorpayOrderId);

await prisma.$disconnect();
let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL PAYMENT GATEWAY UNAVAILABLE CHECKS PASSED");

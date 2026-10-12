/**
 * Cash payment: the client opts to pay in cash, finance confirms receipt, and
 * only then is the client onboarded (engagement, projects, invoice, Payment).
 *
 * Requires the API on :4000.
 *   pnpm --filter @stackfox/api test:cash
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function call(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function register(tag: string) {
  const email = `cash-${tag}-${stamp}@example.com`;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Cash ${tag}`, email, password: "testpass1234" }),
    });
    const b = (await res.json().catch(() => null)) as any;
    if (b?.data?.accessToken) return { email, token: b.data.accessToken as string };
    if (res.status !== 429) throw new Error(`register failed: ${JSON.stringify(b)}`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("register rate-limited out");
}

const client = await register("client");
const staff = await register("finance");
await prisma.user.update({ where: { email: staff.email }, data: { role: "FINANCE" } });
const login = await fetch(`${BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: staff.email, password: "testpass1234" }),
});
const financeToken = ((await login.json()) as any)?.data?.accessToken as string;

const service = await prisma.serviceUnit.findFirst({
  where: { status: "PUBLISHED", starterPrice: { not: null } },
  orderBy: { id: "asc" },
});
if (!service) throw new Error("no published service with a price");

const created = await call("POST", "/quotes", client.token, {
  items: [{ itemId: service.id, itemType: "service", quantity: 1 }],
  tier: "GROWTH",
});
const quoteId: string = created.body?.data?.quote?.id;
const total = Number(created.body?.data?.quote?.total);

// Finance cannot confirm cash the client never asked to pay.
const early = await call("POST", `/quotes/${quoteId}/cash/confirm`, financeToken, {});
check(
  `confirm before a cash request is refused -> ${early.status}`,
  early.status === 409,
);

const req = await call("POST", `/quotes/${quoteId}/cash`, client.token, {
  paymentMode: "MILESTONE",
});
const pending = Number(req.body?.data?.checkoutDetails?.pendingOrderAmount);
check(`client requests cash -> ${req.status}`, req.status === 200);
check(`quote parks as awaiting_cash`, req.body?.data?.status === "awaiting_cash");
check(
  `pinned amount is the 30% milestone (${pending})`,
  pending === Math.round(total * 0.3),
);

const again = await call("POST", `/quotes/${quoteId}/cash`, client.token, {});
check(`a repeated cash request is idempotent -> ${again.status}`, again.status === 200);

const edit = await call("PATCH", `/quotes/${quoteId}`, client.token, {
  checkoutDetails: { step: 1 },
});
check(`awaiting_cash quote is locked from edits -> ${edit.status}`, edit.status === 409);

const before = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
check(`nothing is provisioned before confirmation`, before.invoiceId === null);

const byClient = await call("POST", `/quotes/${quoteId}/cash/confirm`, client.token, {});
check(
  `a client cannot confirm their own cash -> ${byClient.status}`,
  byClient.status === 403,
);

const ok = await call("POST", `/quotes/${quoteId}/cash/confirm`, financeToken, {
  reference: `RCPT-${stamp}`,
});
check(`finance confirms cash -> ${ok.status}`, ok.status === 200);
check(
  `quote is partially paid after the milestone`,
  ok.body?.data?.status === "partially_paid",
);

const after = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
const invoice = after.invoiceId
  ? await prisma.invoice.findUnique({ where: { id: after.invoiceId } })
  : null;
const payment = await prisma.payment.findFirst({
  where: { gateway: "CASH", gatewayPaymentId: `cash:${quoteId}:RCPT-${stamp}` },
});
const projects = invoice?.engagementId
  ? await prisma.project.count({ where: { engagementId: invoice.engagementId } })
  : 0;
check(`engagement + invoice provisioned`, Boolean(invoice?.engagementId));
check(`projects provisioned (${projects})`, projects > 0);
check(`CASH Payment row recorded for ${pending}`, Number(payment?.amount) === pending);
check(`invoice amountPaid = ${pending}`, Number(invoice?.amountPaid) === pending);

const twice = await call("POST", `/quotes/${quoteId}/cash/confirm`, financeToken, {});
check(`a second confirm is refused -> ${twice.status}`, twice.status === 409);

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
await prisma.$disconnect();
process.exit(failed ? 1 : 0);

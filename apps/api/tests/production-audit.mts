import "../src/env";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import Fastify from "fastify";
import { prisma } from "@stackfox/prisma";
import { quoteRoutes, settleQuote } from "../src/routes/quotes";
import { financeRoutes } from "../src/routes/finance";
import { catalogueRoutes } from "../src/routes/catalogue";
import { settleInvoice } from "../src/lib/billing";
import { verifyRazorpaySignature } from "../src/lib/payments";
import { shutdownQueues } from "../src/lib/queue";
import { redis } from "../src/lib/redis";
import { flushBusinessMail } from "../src/lib/businessMail";
import { quotePaymentTerms } from "../src/lib/quotePayment";

const testDatabase = new URL(process.env.DATABASE_URL ?? "");
assert.ok(
  ["localhost", "127.0.0.1"].includes(testDatabase.hostname) &&
    /^\/stackfox_(test|audit_)/.test(testDatabase.pathname),
  "Audit regression fixtures require a dedicated local test database",
);
const tag = randomUUID();
const app = Fastify();
const org = await prisma.org.create({
  data: { id: `ORG-${tag}`, name: "Audit fixture", type: "COMPANY" },
});
const user = await prisma.user.create({
  data: { name: "Audit", email: `${tag}@example.com`, role: "ORG_OWNER", orgId: org.id },
});
app.decorateRequest("user", undefined);
app.addHook("onRequest", async (req) => {
  req.user = { sub: user.id, role: "ORG_OWNER", email: user.email, orgId: org.id };
});
app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (_req, body, done) => {
    (_req as any).rawBody = body;
    try {
      done(null, JSON.parse(String(body)));
    } catch (e) {
      done(e as Error);
    }
  },
);
await app.register(quoteRoutes);
await app.register(financeRoutes);
await app.register(catalogueRoutes);
const check = (name: string) => console.log(`PASS ${name}`);
try {
  assert.deepEqual(quotePaymentTerms(1000000, 1180000, 0, "UPFRONT"), {
    amount: 1121000,
    subtotal: 950000,
    gstAmount: 171000,
    total: 1121000,
  });
  assert.equal(quotePaymentTerms(1000000, 1180000, 354000, "MILESTONE").amount, 826000);
  check(
    "N-6 upfront discount reduces invoice liability; later installments collect only the balance",
  );
  // Unique DB-only item avoids the static catalogue and pins a known paise price.
  const svc = await prisma.serviceUnit.create({
    data: {
      id: `AUD-${tag}`,
      slug: `audit-${tag}`,
      name: "Known ₹10000 service",
      categoryTier1: "AUD",
      baseWeight: 1,
      sacCode: "998314",
      starterPrice: 1000000,
      status: "PUBLISHED",
    },
  });
  const created = await app.inject({
    method: "POST",
    url: "/quotes",
    payload: { tier: "STARTER", items: [{ itemId: svc.id, quantity: 1, price: 1 }] },
  });
  assert.equal(created.statusCode, 200, created.body);
  const q = created.json().data.quote;
  assert.equal(q.subtotal, 1000000);
  assert.equal(q.total, 1180000);
  assert.equal(q.moneyUnit, "PAISE");
  check("F-1 quote persists and returns canonical paise; supplied price ignored");
  const attack = await app.inject({
    method: "PATCH",
    url: `/quotes/${q.id}`,
    payload: {
      checkoutDetails: {
        amountPaid: 1180000,
        pendingOrderAmount: 1180000,
        payments: ["fake"],
      },
    },
  });
  assert.equal(attack.statusCode, 400, attack.body);
  const tier = await app.inject({
    method: "PATCH",
    url: `/quotes/${q.id}`,
    payload: { tier: "PREMIUM" },
  });
  assert.equal(tier.statusCode, 409);
  check("N-1 rejects client payment state and unpriced tier changes");
  const missing = await app.inject({
    method: "GET",
    url: "/catalogue/services/no-such-service/features",
  });
  assert.equal(missing.statusCode, 404);
  check("F-8 unknown service returns 404");
  await prisma.quote.update({
    where: { id: q.id },
    data: {
      razorpayOrderId: `order_${tag}`,
      checkoutDetails: { pendingOrderAmount: 354000 },
    },
  });
  process.env.RAZORPAY_KEY_ID = "rzp_live_audit_disabled";
  delete process.env.LIVE_PAYMENTS_ENABLED;
  const gated = await app.inject({
    method: "POST",
    url: `/quotes/${q.id}/pay`,
    payload: { paymentMode: "FULL" },
  });
  assert.equal(gated.statusCode, 503, gated.body);
  delete process.env.RAZORPAY_KEY_ID;
  check("F-3 live gate also blocks reuse of an existing gateway order");
  await Promise.all(
    Array.from({ length: 3 }, () =>
      settleQuote(q.id, `order_${tag}`, `pay_${tag}`, 354000),
    ),
  );
  const partial = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
  let invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: partial.invoiceId! },
  });
  assert.equal(Number(invoice.amountPaid), 354000);
  assert.equal(invoice.status, "PARTIALLY_PAID");
  assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 1);
  assert.equal(await prisma.engagement.count({ where: { clientId: org.id } }), 1);
  check("N-2 concurrent partial callbacks provision once and record one capture");
  const { reconcileInvoiceRevenue } = await import("../src/lib/revenue");
  await Promise.all([0, 1, 2].map(() => reconcileInvoiceRevenue(invoice.id)));
  assert.equal(
    Number(
      (
        await prisma.revrecLedger.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { recognised: true },
        })
      )._sum.recognised,
    ),
    354000,
  );
  await prisma.quote.update({
    where: { id: q.id },
    data: {
      razorpayOrderId: `order2_${tag}`,
      checkoutDetails: {
        ...(partial.checkoutDetails as object),
        pendingOrderAmount: 826000,
      },
    },
  });
  process.env.RAZORPAY_WEBHOOK_SECRET = "audit-local-webhook-secret";
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay2_${tag}`,
          order_id: `order2_${tag}`,
          amount: 826000,
          currency: "INR",
          status: "captured",
        },
      },
    },
  });
  const sig = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  for (let i = 0; i < 2; i++) {
    const delivered = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: { "content-type": "application/json", "x-razorpay-signature": sig },
      payload,
    });
    assert.equal(delivered.statusCode, 200, delivered.body);
  }
  invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(invoice.status, "PAID");
  assert.equal(Number(invoice.amountPaid), 1180000);
  assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 2);
  check(
    "N-2 signed webhook completes quote without browser and replay does not duplicate",
  );
  await Promise.all([0, 1, 2].map(() => reconcileInvoiceRevenue(invoice.id)));
  assert.equal(
    Number(
      (
        await prisma.revrecLedger.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { recognised: true },
        })
      )._sum.recognised,
    ),
    1180000,
  );
  check("N-5 worker retries reconcile partial and final captures exactly once");
  const manual = await prisma.invoice.create({
    data: {
      id: `INV-${tag}`,
      orgId: org.id,
      sacCode: "998314",
      gstType: "IGST",
      subtotal: 10000,
      grandTotal: 11800,
      igst: 1800,
      status: "SENT",
    },
  });
  await Promise.all(
    Array.from({ length: 3 }, () =>
      settleInvoice(manual.id, {
        gateway: "BANK_TRANSFER",
        gatewayPaymentId: `utr-${tag}`,
        amount: 5000,
      }),
    ),
  );
  assert.equal(
    Number(
      (await prisma.invoice.findUniqueOrThrow({ where: { id: manual.id } })).amountPaid,
    ),
    5000,
  );
  assert.equal(await prisma.payment.count({ where: { invoiceId: manual.id } }), 1);
  check(
    "N-3 manual invoice without Order records evidence and deduplicates concurrent partial settlement",
  );
  await assert.rejects(
    prisma.invoice.update({
      where: { id: manual.id },
      data: { status: "PAID", amountPaid: 0 },
    }),
  );
  const empty = await prisma.invoice.create({
    data: {
      id: `EMPTY-${tag}`,
      orgId: org.id,
      sacCode: "998314",
      gstType: "IGST",
      subtotal: 100,
      grandTotal: 118,
      status: "SENT",
    },
  });
  await assert.rejects(
    prisma.invoice.update({
      where: { id: empty.id },
      data: { status: "PAID", amountPaid: 118 },
    }),
  );
  await assert.rejects(prisma.payment.deleteMany({ where: { invoiceId: invoice.id } }));
  check("F-2 database rejects zero-paid, evidence-free paid state and evidence deletion");
  delete process.env.RAZORPAY_KEY_SECRET;
  assert.equal(
    verifyRazorpaySignature(
      "order",
      "pay",
      createHmac("sha256", "").update("order|pay").digest("hex"),
    ),
    false,
  );
  check("N-4 missing secret fails closed");
  const sent = new Set<string>();
  await flushBusinessMail(async () => ({
    delivered: false,
    provider: "resend",
    error: "simulated outage",
  }));
  const pending = await prisma.$queryRaw<
    Array<{ n: bigint }>
  >`SELECT count(*) AS n FROM business_mail WHERE status='PENDING' AND attempts=1`;
  assert.ok(Number(pending[0].n) >= 4);
  await prisma.$executeRaw`UPDATE business_mail SET next_attempt_at=now() WHERE status='PENDING'`;
  await Promise.all(
    [0, 1].map(() =>
      flushBusinessMail(async (mail) => {
        assert.ok(mail.idempotencyKey);
        assert.ok(!sent.has(mail.idempotencyKey));
        sent.add(mail.idempotencyKey);
        assert.match(mail.text, /invoice/i);
        return { delivered: true, provider: "resend" };
      }),
    ),
  );
  assert.ok(sent.size >= 4);
  assert.equal(
    await flushBusinessMail(async () => {
      throw new Error("Duplicate email");
    }),
    0,
  );
  check(
    "F-7 committed invoice/receipt outbox survives failure, retries and concurrent delivery without duplicates",
  );
  console.log("ALL PRODUCTION AUDIT REGRESSIONS PASSED");
} finally {
  await app.close();
  await shutdownQueues();
  await redis.quit();
  await prisma.$disconnect();
}

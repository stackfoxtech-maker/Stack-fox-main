/**
 * Checkout integrity — SF-H5 and R-1.
 *
 * Proves the three properties the rewrite is for:
 *
 *   1. A concurrent double-submit provisions exactly once.
 *   2. A sequential retry returns the original result, not a second purchase.
 *   3. Losing Redis mid-checkout does not lose the session.
 *
 * Every check here fails against the pre-rewrite handler.
 * Requires the API on :4000.
 *   pnpm --filter @stackfox/api test:checkout
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { redis } from "../src/lib/redis";
import { readSession, writeSession } from "../src/lib/checkoutSession";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();

type Result = { s: number; b: any };

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<Result> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    /* empty */
  }
  return { s: res.status, b: parsed };
}

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

async function register(tag: string) {
  const email = `ci-${tag}-${stamp}@example.com`;
  for (let i = 0; i < 8; i++) {
    const r = await call("POST", "/auth/register", undefined, {
      name: `CI ${tag}`,
      email,
      password: "testpass1234",
    });
    if (r.b?.data?.accessToken) {
      return {
        token: r.b.data.accessToken as string,
        userId: r.b.data.user.id as string,
      };
    }
    if (r.s !== 429) throw new Error(`register ${tag}: ${JSON.stringify(r.b)}`);
    await new Promise((res) => setTimeout(res, 10_000));
  }
  throw new Error(`register ${tag} rate-limited out`);
}

/** Builds a workspace -> estimate -> checkout session ready to complete. */
async function newCheckout(token: string) {
  const service = await prisma.serviceUnit.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { id: "asc" },
  });
  if (!service) throw new Error("no published service to build a canvas from");

  const canvas = [{ serviceId: service.id, features: {} }];
  const ws = await call("POST", "/workspaces", token, { canvas });
  const wsId = ws.b?.id ?? ws.b?._id;
  if (!wsId) throw new Error(`workspace: ${JSON.stringify(ws.b)}`);

  const est = await call("POST", "/estimates", token, { workspaceId: wsId });
  const estId = est.b?.id ?? est.b?._id;
  if (!estId) throw new Error(`estimate: ${JSON.stringify(est.b)}`);

  const start = await call("POST", "/checkout/start", token, {
    estimateId: estId,
    tier: "GROWTH",
  });
  const sid = start.b?.sid;
  if (!sid) throw new Error(`checkout/start: ${JSON.stringify(start.b)}`);
  return { sid, estId };
}

const user = await register("checkout");

// ── 1. Concurrent double-submit ──────────────────────────────────────────────
{
  const { sid } = await newCheckout(user.token);

  // Fire both at once — this is the double-click.
  const [a, b] = await Promise.all([
    call("POST", `/checkout/${sid}/complete`, user.token, {}),
    call("POST", `/checkout/${sid}/complete`, user.token, {}),
  ]);

  const statuses = [a.s, b.s].sort();
  check(
    `concurrent completes -> ${statuses.join(" + ")}`,
    statuses.includes(200),
    "at least one must succeed",
  );

  const sess = await prisma.checkoutSession.findUnique({ where: { id: sid } });
  const orderId = sess?.resultOrderId ?? null;
  check(`session marked consumed`, Boolean(sess?.consumedAt), "expect consumedAt set");
  check(`session records its order`, Boolean(orderId), "expect resultOrderId set");

  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const engagements = await prisma.engagement.count({
      where: { id: order?.engagementId ?? "__none__" },
    });
    const orders = await prisma.order.count({ where: { estimateId: sess!.estimateId } });
    const invoices = await prisma.invoice.count({ where: { orderId } });

    check(
      `exactly 1 order for the estimate (${orders})`,
      orders === 1,
      "expect 1, not 2",
    );
    check(`exactly 1 engagement (${engagements})`, engagements === 1, "expect 1");
    check(`exactly 1 invoice (${invoices})`, invoices === 1, "expect 1, not 2");
  }
}

// ── 2. Sequential retry returns the original result ──────────────────────────
{
  const { sid } = await newCheckout(user.token);

  const first = await call("POST", `/checkout/${sid}/complete`, user.token, {});
  check(`first complete -> ${first.s}`, first.s === 200, "expect 200");

  const second = await call("POST", `/checkout/${sid}/complete`, user.token, {});
  check(`retry -> ${second.s}`, second.s === 200, "expect 200, not 404");

  const sameOrder = first.b?.order?.id && first.b.order.id === second.b?.order?.id;
  check(
    `retry returns the SAME order`,
    Boolean(sameOrder),
    `${first.b?.order?.id} vs ${second.b?.order?.id}`,
  );

  const orders = await prisma.order.count({
    where: { estimateId: first.b?.order?.estimateId },
  });
  check(`still exactly 1 order after retry (${orders})`, orders === 1, "expect 1");
}

// ── 3. Session survives losing Redis ─────────────────────────────────────────
{
  const { sid } = await newCheckout(user.token);

  const before = await call("GET", `/checkout/${sid}/status`, user.token);
  check(`status before flush -> ${before.s}`, before.s === 200, "expect 200");

  // Simulate an eviction / restart: drop the cached copy only.
  await redis.del(`checkout:${sid}`);

  const after = await call("GET", `/checkout/${sid}/status`, user.token);
  check(
    `status after cache flush -> ${after.s}`,
    after.s === 200,
    "expect 200 — the row is authoritative",
  );

  const completed = await call("POST", `/checkout/${sid}/complete`, user.token, {});
  check(
    `complete after cache flush -> ${completed.s}`,
    completed.s === 200,
    "expect 200 — purchase must not be lost",
  );
}

// A request that read the form before payment initiation must not overwrite
// the now-locked session, even if it already passed the HTTP pre-handler.
{
  const { sid } = await newCheckout(user.token);
  const stale = await readSession(sid);
  if (!stale) throw new Error("missing session fixture");
  await prisma.checkoutSession.update({
    where: { id: sid },
    data: { razorpayOrderId: `order_locked_${stamp}` },
  });
  stale.paymentTerms = { mode: "UPFRONT" };
  let rejected = false;
  try {
    await writeSession(sid, stale);
  } catch (error: any) {
    rejected = error.statusCode === 409;
  }
  check("late form write rejected after gateway order creation", rejected);
  const row = await prisma.checkoutSession.findUniqueOrThrow({ where: { id: sid } });
  check(
    "late form write preserves gateway order and payment terms",
    row.razorpayOrderId === `order_locked_${stamp}` && !(row.data as any).paymentTerms,
  );
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n--- CHECKOUT INTEGRITY ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL CHECKOUT INTEGRITY CHECKS PASSED" : `${failed} FAILED`);

await redis.quit().catch(() => {});
await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);

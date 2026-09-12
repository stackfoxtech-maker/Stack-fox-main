import { prisma } from "@stackfox/prisma";
import { emitEvent } from "./events";
import { recordInvoicePayment } from "./billing";
import { queues } from "./queue";
import * as ids from "./id";
import { redis, cache } from "./redis";
import { resolveGstType, splitGst } from "./gst";
import { ensurePersonalOrg } from "./scope";
import { getMilestoneTemplates, getContractTypes } from "./tierTemplates";

interface PendingExpressCheckout {
  userId: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  addOns: { id: string; name: string; price: number }[];
  subtotal: number;
  gst: number;
  total: number;
  name: string;
  email: string;
  phone: string;
}

/**
 * Provisions the Engagement/Order/Project/Milestones/Contracts/Invoice for a
 * captured express-checkout payment, keyed by the Razorpay order id used to
 * stash the pending session in Redis (see POST /checkout/express).
 *
 * Callable from two places that both need the exact same idempotent,
 * transactional provisioning: the client's own /checkout/express/verify call
 * (the fast path, right after the Razorpay checkout modal succeeds) and the
 * Razorpay webhook (the durable path — the only one that still completes the
 * order if the customer's browser dies before the client-side call fires).
 * Whichever gets there first provisions the order; the other finds it via
 * the razorpayOrderId lookup and returns the same id.
 *
 * Returns null only when there is truly nothing to do: no pending session in
 * Redis and no Order already provisioned for this razorpayOrderId — i.e. this
 * was never a real express-checkout order.
 */
export async function provisionExpressCheckoutOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<{ orderId: string } | null> {
  const key = `express:${razorpayOrderId}`;

  const locked = await cache.lock(key, 30000);
  if (!locked) {
    // Someone else (the other caller of this same function) is provisioning
    // this order right now. Don't wait — report what's there; the caller
    // that lost the race can retry (the client polls, the webhook redelivers).
    const existing = await prisma.order.findFirst({ where: { razorpayOrderId } });
    return existing ? { orderId: existing.id } : null;
  }

  try {
    const raw = await redis.get(key);
    if (!raw) {
      const existing = await prisma.order.findFirst({ where: { razorpayOrderId } });
      return existing ? { orderId: existing.id } : null;
    }

    const pending = JSON.parse(raw) as PendingExpressCheckout;

    const user = await prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user) return null;
    const orgId = await ensurePersonalOrg(user.id);

    // pending.* are rupees (the catalogue's unit); Order/Invoice/Payment are paise.
    const subtotalPaise = pending.subtotal * 100;
    const gstPaise = pending.gst * 100;
    const totalPaise = pending.total * 100;

    const billTo = await prisma.org.findUnique({ where: { id: orgId } });
    const gstType = resolveGstType(billTo);
    const { cgst, sgst, igst } = splitGst(gstPaise, gstType);

    // All writes below commit together or not at all — a partial failure
    // (e.g. the invoice create throwing after the order was created) must
    // never leave an orphaned engagement/order behind with nothing to show
    // for the customer's payment, nor duplicate rows on the next retry.
    const { engId, order, project, invoice } = await prisma.$transaction(async (tx) => {
      const engId = ids.engagementId();
      await tx.engagement.create({
        data: {
          id: engId,
          clientId: orgId,
          model: "FPM",
          commercial: { subtotal: pending.subtotal, gst: pending.gst, total: pending.total },
          methodology: "MILESTONE",
          status: "ACTIVE",
          executedAt: new Date(),
        },
      });

      const order = await tx.order.create({
        data: {
          id: ids.orderId(),
          orgId,
          engagementId: engId,
          services: [pending.packageId, ...pending.addOns.map((a) => a.id)],
          subtotal: subtotalPaise,
          gst: gstPaise,
          grandTotal: totalPaise,
          razorpayOrderId,
          tier: "STARTER",
          paymentMode: "FULL",
          primaryContact: { name: pending.name, email: pending.email, phone: pending.phone },
          status: "PAID",
          paidAt: new Date(),
        },
      });

      // Project.serviceId is a required FK to ServiceUnit, but express-checkout
      // packages live in the JSON catalogue, not that table — ensure a
      // placeholder row exists, same as the quotes flow does for the same reason.
      let service = await tx.serviceUnit.findUnique({ where: { id: pending.packageId } });
      if (!service) {
        service = await tx.serviceUnit.create({
          data: {
            id: pending.packageId,
            name: pending.packageName,
            categoryTier1: "SF-EXP",
            slug: pending.packageId.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            baseWeight: 1,
            sacCode: "998314",
            status: "PUBLISHED",
          },
        });
      }

      const prefix = (pending.packageId.split("-").slice(0, 2).join("-") || "SF-EXP").toUpperCase();
      const project = await tx.project.create({
        data: {
          id: ids.projectId(prefix),
          engagementId: engId,
          orderId: order.id,
          serviceId: service.id,
          name: pending.packageName,
          status: "ACTIVE",
          configSnapshot: { packageId: pending.packageId, addOns: pending.addOns },
        },
      });
      for (const m of getMilestoneTemplates("STARTER")) {
        await tx.milestone.create({
          data: { projectId: project.id, number: 1, name: m.name, paymentPct: m.pct, deliverables: m.deliverables },
        });
      }

      for (const type of getContractTypes("STARTER")) {
        await tx.contract.create({
          data: { orderId: order.id, engagementId: engId, type, status: "DRAFT" },
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          id: ids.invoiceId(),
          orderId: order.id,
          engagementId: engId,
          orgId,
          milestoneRef: "M1",
          sacCode: "998314",
          gstType,
          subtotal: subtotalPaise,
          cgst,
          sgst,
          igst,
          grandTotal: totalPaise,
          status: "PAID",
          paidAt: new Date(),
          dueDate: new Date(),
        },
      });

      return { engId, order, project, invoice };
    });

    // Everything committed — safe to release the session and fire the side
    // effects (queues, payment ledger, events) that don't need to be atomic
    // with the DB rows themselves.
    await redis.del(key);

    const contracts = await prisma.contract.findMany({ where: { orderId: order.id }, select: { id: true, type: true } });
    for (const contract of contracts) {
      await queues.docGen.add("contract-pdf", { type: "contract", contractId: contract.id, contractType: contract.type });
    }
    await queues.docGen.add("invoice-pdf", { type: "invoice", invoiceId: invoice.id }).catch(() => {});

    await recordInvoicePayment(invoice, {
      gateway: "RAZORPAY",
      gatewayPaymentId: razorpayPaymentId,
      gatewayOrderId: razorpayOrderId,
      amount: totalPaise,
    });

    await emitEvent({ code: "ORDER_PLACED", payload: { orderId: order.id, tier: "STARTER" }, actor: user.id });
    await emitEvent({ code: "ENGAGEMENT_CREATED", payload: { engagementId: engId }, actor: user.id, engagementId: engId });
    await emitEvent({ code: "PROJECT_CREATED", payload: { projectId: project.id }, actor: user.id, projectId: project.id, engagementId: engId });
    await emitEvent({
      code: "INVOICE_PAID",
      payload: { invoiceId: invoice.id, gateway: "razorpay", razorpayPaymentId },
      actor: user.id,
      engagementId: engId,
    });

    return { orderId: order.id };
  } finally {
    await cache.unlock(key);
  }
}

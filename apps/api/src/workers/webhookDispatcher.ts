import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { hmacSign } from "../lib/hash";
import { toJson } from "../lib/json";
import { assertPublicHttpUrl } from "../lib/safeUrl";
import { TIMEOUT } from "../lib/timeouts";
import { log } from "../lib/logger";

/**
 * The organisation an event belongs to, found from whatever the event carries.
 * Webhooks are per organisation; without this every endpoint subscribed to a code
 * received every other organisation's events (invoice ids, amounts, emails).
 */
async function owningOrgId(job: {
  engagementId?: string;
  projectId?: string;
  payload?: Record<string, unknown>;
}): Promise<string | null> {
  const { engagementId, projectId, payload } = job;
  if (engagementId) {
    const e = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { clientId: true },
    });
    if (e) return e.clientId;
  }
  if (projectId) {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: { engagement: { select: { clientId: true } } },
    });
    if (p) return p.engagement.clientId;
  }
  const invoiceId = typeof payload?.invoiceId === "string" ? payload.invoiceId : null;
  if (invoiceId) {
    const i = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { orgId: true },
    });
    if (i) return i.orgId;
  }
  const quoteId = typeof payload?.quoteId === "string" ? payload.quoteId : null;
  if (quoteId) {
    const q = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { userId: true },
    });
    if (q) {
      const u = await prisma.user.findUnique({
        where: { id: q.userId },
        select: { orgId: true },
      });
      if (u?.orgId) return u.orgId;
    }
  }
  return null;
}

createWorker(QUEUE.webhookDispatcher, async (job) => {
  const { code, payload, engagementId, projectId } = job.data;

  // No owner, no delivery: an event we cannot attribute must not go to anyone's endpoint.
  const orgId = await owningOrgId({ engagementId, projectId, payload });
  if (!orgId) return;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { active: true, orgId, events: { has: code } },
  });

  for (const endpoint of endpoints) {
    const body = JSON.stringify({
      event: code,
      payload,
      timestamp: new Date().toISOString(),
    });
    const signature = hmacSign(body, endpoint.secret);

    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventCode: code,
        payload: toJson(JSON.parse(body)),
        status: "PENDING",
      },
    });

    // The destination is attacker-controlled in the general case — it is
    // whatever was supplied at registration. Without this check the dispatcher
    // is a blind SSRF primitive inside the deployment network, and any http://
    // endpoint ships business events in clear text.
    const check = await assertPublicHttpUrl(endpoint.url);
    if (!check.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", error: `Blocked destination: ${check.reason}` },
      });
      // Stop retrying a destination that can never be valid, and make it
      // visible rather than failing quietly every time the event fires.
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { active: false },
      });
      log().error(
        { endpointId: endpoint.id, reason: check.reason },
        "webhook endpoint disabled",
      );
      continue;
    }

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StackFox-Signature": signature,
          "X-StackFox-Event": code,
        },
        body,
        // A 3xx to an internal host would otherwise walk straight past the
        // check above, so redirects are never followed.
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT.webhook),
      });

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: res.ok ? "DELIVERED" : "FAILED",
          httpStatus: res.status,
          respondedAt: new Date(),
        },
      });
    } catch (err: any) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", error: err.message },
      });
    }
  }
});

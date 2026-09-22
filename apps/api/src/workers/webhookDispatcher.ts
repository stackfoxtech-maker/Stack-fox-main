import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { hmacSign } from "../lib/hash";
import { toJson } from "../lib/json";
import { assertPublicHttpUrl } from "../lib/safeUrl";
import { TIMEOUT } from "../lib/timeouts";
import { log } from "../lib/logger";

createWorker(QUEUE.webhookDispatcher, async (job) => {
  const { code, payload, engagementId } = job.data;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { active: true, events: { has: code } },
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

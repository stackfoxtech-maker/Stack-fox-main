import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { hmacSign } from "../lib/hash";
import { toJson } from "../lib/json";

createWorker(QUEUE.webhookDispatcher, async (job) => {
  const { code, payload, engagementId } = job.data;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { active: true, events: { has: code } },
  });

  for (const endpoint of endpoints) {
    const body = JSON.stringify({ event: code, payload, timestamp: new Date().toISOString() });
    const signature = hmacSign(body, endpoint.secret);

    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventCode: code,
        payload: toJson(JSON.parse(body)),
        status: "PENDING",
      },
    });

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StackFox-Signature": signature,
          "X-StackFox-Event": code,
        },
        body,
        signal: AbortSignal.timeout(10000),
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

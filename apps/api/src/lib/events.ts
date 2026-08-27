import { prisma } from "@stackfox/prisma";
import { queues } from "./queue";
import { toJson } from "./json";

export interface EmitOptions {
  code: string;
  payload?: Record<string, unknown>;
  actor: string;
  projectId?: string;
  engagementId?: string;
  programId?: string;
}

export async function emitEvent(opts: EmitOptions) {
  const event = await prisma.event.create({
    data: {
      code: opts.code,
      payload: toJson(opts.payload ?? {}),
      actor: opts.actor,
      projectId: opts.projectId,
      engagementId: opts.engagementId,
      programId: opts.programId,
    },
  });

  // Fan-out to workers is best-effort: a stalled/unreachable Redis must never
  // block the caller, since the event of record is already persisted above.
  const dispatch = Promise.all([
    queues.notifications.add("notify", {
      eventSeq: Number(event.seq),
      code: opts.code,
      payload: opts.payload,
      actor: opts.actor,
      projectId: opts.projectId,
      engagementId: opts.engagementId,
    }),
    queues.webhookDispatcher.add("dispatch", {
      eventSeq: Number(event.seq),
      code: opts.code,
      payload: opts.payload,
      projectId: opts.projectId,
      engagementId: opts.engagementId,
    }),
  ]).catch((err) => {
    console.warn(`[emitEvent] queue dispatch failed for ${opts.code} (event persisted, will not retry):`, err.message);
  });
  void dispatch;

  return event;
}

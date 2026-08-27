import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { queues } from "../lib/queue";
import { emitEvent } from "../lib/events";

createWorker(QUEUE.referralProcessor, async (job) => {
  const { referralId } = job.data;

  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: { referrer: true },
  });
  if (!referral) return;

  // Check if referred email already exists
  const existing = await prisma.user.findFirst({
    where: { email: referral.referredEmail },
  });

  if (existing) {
    await prisma.referral.update({
      where: { id: referralId },
      data: { status: "DUPLICATE" },
    });
    return;
  }

  // Send referral invitation notification
  await queues.notifications.add("referral-invite", {
    code: "REFERRAL_SENT",
    payload: {
      referralId,
      referrerName: referral.referrer?.name ?? "A StackFox user",
      referredEmail: referral.referredEmail,
      referredName: referral.referredName,
    },
  });

  await prisma.referral.update({
    where: { id: referralId },
    data: { status: "SENT", sentAt: new Date() },
  });

  await emitEvent({
    code: "REFERRAL_SENT",
    payload: { referralId, referredEmail: referral.referredEmail },
    actor: referral.referrerId,
  });
});

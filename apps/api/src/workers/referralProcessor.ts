import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import { isMailConfigured, referralInviteEmail, sendMail } from "../lib/mailer";
import { log } from "../lib/logger";

interface ProcessJob {
  referralId: string;
}

interface ConvertJob {
  referralCode: string;
  orderId: string;
  /** The paid order/quote total in paise — commission is a percentage of this. */
  amount: number;
}

/**
 * One queue, two job names dispatched to it (see routes/referrals.ts "process"
 * and routes/checkout.ts + routes/quotes.ts "convert"), but this worker used
 * to run every job through the "process" branch regardless of name — reading
 * `job.data.referralId`, which a "convert" job never carries. Every conversion
 * silently did nothing: no status change, no commission, no payout. Referrals
 * could be sent but never actually convert.
 */
// job.data is `any` here (createWorker's default generic) — it needs no
// assertion to reach a function expecting ProcessJob/ConvertJob; adding one
// is what tripped @typescript-eslint/no-unnecessary-type-assertion.
createWorker(QUEUE.referralProcessor, async (job) => {
  if (job.name === "convert") return handleConvert(job.data);
  return handleProcess(job.data);
});

async function handleProcess({ referralId }: ProcessJob) {
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

  const referrerName = referral.referrer?.name ?? "A StackFox user";

  // The actual invite: without this landing in the invitee's inbox, the
  // referral code never reaches anyone and can never be redeemed. Best-effort
  // — a bounce or missing mail provider shouldn't fail the job, since the
  // referral itself was still recorded and can be re-sent.
  if (isMailConfigured()) {
    const result = await sendMail(
      referralInviteEmail(
        referral.referredEmail,
        referral.code,
        referrerName,
        referral.referredName,
      ),
    );
    if (!result.delivered) {
      log().warn(
        { referralId, err: result.error },
        "referral invite email failed to send",
      );
    }
  } else {
    log().warn({ referralId }, "referral invite not sent — no mail provider configured");
  }

  await prisma.referral.update({
    where: { id: referralId },
    data: { status: "SENT", sentAt: new Date() },
  });

  await emitEvent({
    code: "REFERRAL_SENT",
    payload: { referralId, referredEmail: referral.referredEmail },
    actor: referral.referrerId,
  });
}

async function handleConvert({ referralCode, orderId, amount }: ConvertJob) {
  const referral = await prisma.referral.findUnique({ where: { code: referralCode } });
  if (!referral) {
    log().warn({ referralCode, orderId }, "referral conversion: unknown code");
    return;
  }

  // Idempotent: a retried job, or the same order re-triggering settlement
  // (e.g. a milestone payment following the upfront one), must not re-credit
  // an already-converted or already-paid-out referral.
  if (referral.status === "CONVERTED" || referral.status === "PAID") return;
  // A referral that resolved to an existing/duplicate account never earns a
  // commission — there was no genuine new signup to attribute the order to.
  if (referral.status === "DUPLICATE" || referral.status === "EXPIRED") return;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    log().warn({ referralCode, orderId, amount }, "referral conversion: invalid amount");
    return;
  }

  const commissionPct =
    referral.commissionPct ?? Number(process.env.REFERRAL_COMMISSION_PCT ?? 10);
  const commissionAmount = Math.round((amount * commissionPct) / 100);

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: "CONVERTED",
      referredOrderId: orderId,
      commissionPct,
      commissionAmount,
    },
  });

  await emitEvent({
    code: "REFERRAL_CONVERTED",
    payload: { referralId: referral.id, orderId, commissionAmount },
    actor: referral.referrerId,
  });
}

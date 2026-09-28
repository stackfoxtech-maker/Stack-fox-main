import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { emitEvent } from "../lib/events";
import { isMailConfigured, referralInviteEmail, sendMail } from "../lib/mailer";
import { log } from "../lib/logger";
import { resolveCommissionPct } from "../lib/referralCommission";

interface ProcessJob {
  referralId: string;
}

interface ConvertJob {
  referralCode: string;
  orderId: string;
  /** The paid order/quote total in paise — commission is a percentage of this. */
  amount: number;
  /** Whoever completed the paid order — used to block a self-referral. */
  purchaserId?: string;
  purchaserEmail?: string;
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

async function handleConvert({ referralCode, orderId, amount, purchaserId }: ConvertJob) {
  // Codes are minted uppercase (see lib/id.ts referralCode), but this is the
  // one place every conversion path funnels through regardless of how the
  // code reached us — typed by hand, restored from a saved draft, or pasted
  // — so normalise here rather than trust every caller to have done it.
  const code = referralCode.trim().toUpperCase();
  const referral = await prisma.referral.findUnique({ where: { code } });
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

  // A referrer cannot earn a commission on their own purchase: invite a
  // throwaway email, apply the returned code to your own order. The email on
  // the referral row is deliberately not enforced as a hard match — a code is
  // meant to be shareable (the invited person may check out with a different
  // address than the one the invite was sent to), so only self-referral by
  // account id is blocked.
  if (purchaserId && referral.referrerId === purchaserId) {
    log().warn(
      { referralCode: code, orderId, purchaserId },
      "referral conversion: blocked self-referral",
    );
    return;
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    log().warn(
      { referralCode: code, orderId, amount },
      "referral conversion: invalid amount",
    );
    return;
  }

  const commissionPct = resolveCommissionPct(referral.commissionPct);
  const commissionAmount = Math.round((amount * commissionPct) / 100);

  // Conditional on status so two concurrent "convert" jobs for the same code
  // (e.g. a duplicate enqueue, or a retry racing the original) cannot both
  // pass the status checks above and then both write — only one update can
  // match a row still in PENDING/SENT, so only one can ever flip it.
  const result = await prisma.referral.updateMany({
    where: { id: referral.id, status: { in: ["PENDING", "SENT"] } },
    data: {
      status: "CONVERTED",
      referredOrderId: orderId,
      commissionPct,
      commissionAmount,
    },
  });
  if (result.count !== 1) return;

  await emitEvent({
    code: "REFERRAL_CONVERTED",
    payload: { referralId: referral.id, orderId, commissionAmount },
    actor: referral.referrerId,
  });
}

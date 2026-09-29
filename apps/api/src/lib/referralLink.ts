/**
 * The shareable referral link.
 *
 * Every user has one permanent personal code, minted the first time they ask for it. The link
 * is `<site>/?ref=CODE`; a visitor who opens it has the code remembered by the browser and
 * pre-filled at checkout. When that visitor's first order is paid, the code is claimed: a
 * Referral row is created for them under the code's owner and converted like any invited
 * referral, so the commission, payout and events all follow the existing path.
 *
 * The older flow (an emailed invite whose code belongs to one Referral row) is untouched;
 * `claimPersonalCode` is only tried when the code is not a Referral row's.
 */
import { prisma } from "@stackfox/prisma";
import * as ids from "./id";
import { log } from "./logger";
import { resolveCommissionPct } from "./referralCommission";
import { webAppUrl } from "./urls";

/** Codes are `SF` + 8 unambiguous characters; anything else is not one of ours. */
export const CODE_RE = /^[A-Z0-9]{4,32}$/;

/** The user's permanent code, minted on first use. Safe to call concurrently. */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!existing) return null;
  if (existing.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = ids.referralCode();
    // A code must also be free among invite-row codes, which share the lookup.
    if (await prisma.referral.findUnique({ where: { code }, select: { id: true } }))
      continue;
    try {
      // Only the first writer wins; a racing call reads the winner's code below.
      const won = await prisma.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: code },
      });
      if (won.count === 1) return code;
      break;
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // code collision: try another
    }
  }
  const now = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  return now?.referralCode ?? null;
}

export function referralLink(code: string, base = webAppUrl()) {
  const url = `${base}/?ref=${encodeURIComponent(code)}`;
  const message = `Check out StackFox: software services with a real price on every piece, and a live total as you build your plan. ${url}`;
  return {
    code,
    url,
    message,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
    mailtoUrl: `mailto:?subject=${encodeURIComponent("Have a look at StackFox")}&body=${encodeURIComponent(message)}`,
  };
}

/**
 * Turns a personal code plus a paid order into a Referral row for the purchaser, or returns
 * null when the code cannot be claimed:
 *   - not a user's code, or the purchaser is the code's owner (no self-referral);
 *   - the purchaser has already been referred (the first referrer keeps it);
 *   - the purchaser had an earlier paid order, so is not a new client.
 */
export async function claimPersonalCode(
  rawCode: string,
  purchaserId: string | undefined,
  orderId: string,
) {
  const code = rawCode.trim().toUpperCase();
  if (!purchaserId || !CODE_RE.test(code)) return null;

  const owner = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!owner || owner.id === purchaserId) return null;

  const purchaser = await prisma.user.findUnique({
    where: { id: purchaserId },
    select: { id: true, name: true, email: true, orgId: true },
  });
  if (!purchaser) return null;

  const email = purchaser.email.toLowerCase();
  if (await prisma.referral.findFirst({ where: { referredEmail: email } })) return null;

  if (purchaser.orgId) {
    const earlier = await prisma.order.count({
      where: { orgId: purchaser.orgId, status: "PAID", NOT: { id: orderId } },
    });
    if (earlier > 0) return null;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.referral.create({
        data: {
          referrerType: "CLIENT",
          referrerId: owner.id,
          code: ids.referralCode(),
          referredEmail: email,
          referredName: purchaser.name,
          status: "PENDING",
          commissionPct: resolveCommissionPct(),
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
    }
  }
  log().warn({ orderId, code }, "personal referral code: could not allocate a row code");
  return null;
}

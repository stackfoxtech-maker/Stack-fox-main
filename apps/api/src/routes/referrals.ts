import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { isInternalRole } from "@stackfox/core";
import { ok, withIds } from "../lib/http";
import * as ids from "../lib/id";
import { queues } from "../lib/queue";

/**
 * Referral programme.
 *
 * Both routes here previously ran with no `where` clause at all, so every
 * signed-in user saw the whole company's referral list — including other
 * clients' invitee emails — and the "your earnings" figure was actually the
 * platform-wide total.
 */
export async function referralRoutes(app: FastifyInstance) {
  app.get("/referrals", async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    const where = isInternalRole(req.user!.role) ? {} : { referrerId: req.user!.sub };

    const items = await prisma.referral.findMany({
      where,
      include: { referrer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(withIds(items));
  });

  app.get("/referrals/stats", async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    const where = isInternalRole(req.user!.role) ? {} : { referrerId: req.user!.sub };

    const [total, converted, pending, earnings, paid] = await Promise.all([
      prisma.referral.count({ where }),
      prisma.referral.count({ where: { ...where, status: "CONVERTED" } }),
      prisma.referral.count({ where: { ...where, status: { in: ["PENDING", "SENT"] } } }),
      prisma.referral.aggregate({
        where: { ...where, status: { in: ["CONVERTED", "PAID"] } },
        _sum: { commissionAmount: true },
      }),
      prisma.referral.aggregate({
        where: { ...where, status: "PAID" },
        _sum: { commissionAmount: true },
      }),
    ]);

    const totalEarnings = earnings._sum.commissionAmount ?? 0;
    const paidOut = paid._sum.commissionAmount ?? 0;

    return ok({
      total,
      converted,
      pending,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      // Amounts are stored in paise; the portal formats rupees.
      totalEarnings: totalEarnings / 100,
      paidOut: paidOut / 100,
      pendingPayout: (totalEarnings - paidOut) / 100,
    });
  });

  /**
   * Invite someone. The caller's own referral code is stable per referral row
   * so it can be shared and attributed back on checkout.
   */
  app.post("/referrals", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { referredEmail, referredName } = req.body as {
      referredEmail?: string;
      referredName?: string;
    };

    const email = referredEmail?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return reply.code(400).send({ message: "A valid referredEmail is required" });
    }

    const self = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (self?.email.toLowerCase() === email) {
      return reply.code(400).send({ message: "You cannot refer yourself" });
    }

    // Someone who already has an account cannot be claimed as a new referral.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const duplicate = await prisma.referral.findFirst({
      where: { referredEmail: email },
    });
    if (existingUser || duplicate) {
      const referral = await prisma.referral.create({
        data: {
          referrerType: "CLIENT",
          referrerId: req.user!.sub,
          code: await uniqueCode(),
          referredEmail: email,
          referredName: referredName ?? null,
          status: "DUPLICATE",
        },
      });
      return reply.code(409).send({
        message: "That person is already registered or has already been referred.",
        data: { ...referral, _id: referral.id },
      });
    }

    const referral = await prisma.referral.create({
      data: {
        referrerType: "CLIENT",
        referrerId: req.user!.sub,
        code: await uniqueCode(),
        referredEmail: email,
        referredName: referredName ?? null,
        status: "PENDING",
        commissionPct: Number(process.env.REFERRAL_COMMISSION_PCT ?? 10),
      },
    });

    await queues.referralProcessor.add("process", { referralId: referral.id }).catch((err) => {
      req.log.warn({ err }, "Referral queued for processing but dispatch failed");
    });

    return ok({ ...referral, _id: referral.id });
  });
}

/** Codes are user-visible and unique-indexed, so retry on the rare collision. */
async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = ids.referralCode();
    if (!(await prisma.referral.findUnique({ where: { code } }))) return code;
  }
  throw new Error("Could not allocate a unique referral code");
}

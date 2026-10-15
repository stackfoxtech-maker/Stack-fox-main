import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { isInternalRole } from "@stackfox/core";
import { requireAuth } from "../plugins/auth";
import { ok } from "../lib/http";

/**
 * "What needs me?" for staff, in one call.
 *
 * A PM used to have to open every project to find a milestone waiting for
 * approval, a change request nobody had priced, a contract waiting for a
 * countersignature or a finished project ready to hand over. This gathers them,
 * scoped to the caller: admins and senior PMs see everything, a PM sees their own
 * projects, finance sees money, everyone else gets an empty list.
 */

interface Item {
  id: string;
  label: string;
  sub?: string;
  link: string;
}
interface Section {
  key: string;
  title: string;
  hint: string;
  count: number;
  items: Item[];
}

const SEE_ALL = ["ADMIN", "SENIOR_PM"];
const PM = ["ADMIN", "SENIOR_PM", "PM"];
const MONEY = ["ADMIN", "FINANCE"];
const TOP = 5;

const rupees = (paise: unknown) =>
  `₹${Math.round(Number(paise ?? 0) / 100).toLocaleString("en-IN")}`;

export async function opsQueueRoutes(app: FastifyInstance) {
  app.get("/ops/queue", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const role = String(req.user!.role).toUpperCase();
    if (!isInternalRole(role)) return reply.code(403).send({ error: "Staff only." });
    const me = req.user!.sub;

    const isAdmin = role === "ADMIN";
    const project = (id: string) =>
      isAdmin ? `/app/admin/projects/${id}` : `/app/team/projects/${id}`;
    const money = (page: "orders" | "finance") =>
      isAdmin ? `/app/admin/${page}` : `/app/team/${page}`;
    // Admins and senior PMs see every project; a PM sees the ones they run.
    const mine = SEE_ALL.includes(role) ? {} : { pmUserId: me };
    const sections: Section[] = [];
    const add = (s: Section) => {
      if (s.count > 0) sections.push(s);
    };

    if (SEE_ALL.includes(role)) {
      const where = { status: "ACTIVE", pmUserId: null };
      const [count, rows] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({ where, orderBy: { createdAt: "asc" }, take: TOP }),
      ]);
      add({
        key: "unassigned",
        title: "Projects without a PM",
        hint: "Pick a project manager so messages and reviews have an owner.",
        count,
        items: rows.map((p) => ({
          id: p.id,
          label: p.name ?? p.id,
          sub: p.id,
          link: project(p.id),
        })),
      });
    }

    if (PM.includes(role)) {
      const inReview = { status: "IN_REVIEW", project: mine };
      const crOpen = { status: "SUBMITTED", project: mine };
      const toSign = {
        status: "CLIENT_SIGNED",
        ...(SEE_ALL.includes(role)
          ? {}
          : { engagement: { projects: { some: { pmUserId: me } } } }),
      };
      const disputed = { status: "DISPUTED", project: mine };

      const [
        reviewCount,
        reviewRows,
        crCount,
        crRows,
        signCount,
        signRows,
        disputeCount,
        disputeRows,
        active,
      ] = await Promise.all([
        prisma.milestone.count({ where: inReview }),
        prisma.milestone.findMany({
          where: inReview,
          include: { project: { select: { id: true, name: true } } },
          orderBy: { id: "asc" },
          take: TOP,
        }),
        prisma.changeRequest.count({ where: crOpen }),
        prisma.changeRequest.findMany({
          where: crOpen,
          orderBy: { createdAt: "asc" },
          take: TOP,
        }),
        prisma.contract.count({ where: toSign }),
        prisma.contract.findMany({
          where: toSign,
          orderBy: { createdAt: "asc" },
          take: TOP,
        }),
        prisma.handover.count({ where: disputed }),
        prisma.handover.findMany({
          where: disputed,
          include: { project: { select: { id: true, name: true } } },
          take: TOP,
        }),
        prisma.project.findMany({
          where: { status: "ACTIVE", ...mine },
          select: {
            id: true,
            name: true,
            milestones: { select: { status: true } },
            handover: { select: { status: true } },
          },
          take: 200,
        }),
      ]);

      add({
        key: "review",
        title: "Milestones waiting for your approval",
        hint: "Approve the work, or send it back with feedback.",
        count: reviewCount,
        items: reviewRows.map((m) => ({
          id: m.id,
          label: `${m.project.name ?? m.project.id} · ${m.name}`,
          sub: `Milestone ${m.number}`,
          link: project(m.projectId),
        })),
      });
      add({
        key: "change-requests",
        title: "Change requests to price",
        hint: "Add the cost and time impact so the client can decide.",
        count: crCount,
        items: crRows.map((c) => ({
          id: c.id,
          label: c.title,
          link: c.projectId ? project(c.projectId) : "/app/team/projects",
        })),
      });
      add({
        key: "countersign",
        title: "Contracts to countersign",
        hint: "The client has signed; StackFox signs last.",
        count: signCount,
        items: signRows.map((c) => ({
          id: c.id,
          label: c.contractNo ?? c.id,
          sub: c.type,
          link: money("orders"),
        })),
      });
      add({
        key: "disputed",
        title: "Handovers the client disputed",
        hint: "Read what is outstanding and put it right.",
        count: disputeCount,
        items: disputeRows.map((h) => ({
          id: h.id,
          label: h.project.name ?? h.project.id,
          sub: h.notes ?? undefined,
          link: project(h.projectId),
        })),
      });

      // Everything approved, nothing accepted yet: this is the "deliver it" list.
      const ready = active.filter(
        (p) =>
          p.milestones.length > 0 &&
          p.milestones.every((m) => m.status === "APPROVED") &&
          p.handover?.status !== "ACCEPTED" &&
          p.handover?.status !== "DISPUTED",
      );
      add({
        key: "handover",
        title: "Ready to hand over",
        hint: "All milestones are approved. Upload files and credentials, then ask the client to accept.",
        count: ready.length,
        items: ready.slice(0, TOP).map((p) => ({
          id: p.id,
          label: p.name ?? p.id,
          sub: p.id,
          link: project(p.id),
        })),
      });
    }

    if (MONEY.includes(role)) {
      const cash = { status: "awaiting_cash" };
      const late = { status: "OVERDUE" };
      const [cashCount, cashRows, lateCount, lateRows] = await Promise.all([
        prisma.quote.count({ where: cash }),
        prisma.quote.findMany({ where: cash, orderBy: { createdAt: "asc" }, take: TOP }),
        prisma.invoice.count({ where: late }),
        prisma.invoice.findMany({ where: late, orderBy: { dueDate: "asc" }, take: TOP }),
      ]);
      add({
        key: "cash",
        title: "Cash payments to confirm",
        hint: "Confirm once the money is in. This starts the project.",
        count: cashCount,
        items: cashRows.map((q) => ({
          id: q.id,
          label: q.quoteNumber,
          sub: rupees(
            (q.checkoutDetails as { pendingOrderAmount?: number } | null)
              ?.pendingOrderAmount,
          ),
          link: money("orders"),
        })),
      });
      add({
        key: "overdue",
        title: "Overdue invoices",
        hint: "Chase these, or record the payment if it has arrived.",
        count: lateCount,
        items: lateRows.map((i) => ({
          id: i.id,
          label: i.invoiceNo ?? i.id,
          sub: `${rupees(Number(i.grandTotal) - Number(i.amountPaid ?? 0))} due`,
          link: money("finance"),
        })),
      });
    }

    return ok({
      total: sections.reduce((n, s) => n + s.count, 0),
      sections,
    });
  });
}

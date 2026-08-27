import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { clientScope, clientWriteScope, assertProjectInScope } from "../lib/scope";
import { ok, withIds } from "../lib/http";
import { getPresignedDownload, isStorageConfigured } from "../lib/storage";
import { decryptSecret } from "../lib/crypto";
import { toJson } from "../lib/json";
import { emitEvent } from "../lib/events";
import { createHash } from "crypto";

/**
 * Post-delivery handover.
 *
 * The portal had no backend for this at all: the Handover panel listed files,
 * labelled every one of them "Ready" regardless of state, and printed a
 * hard-coded 30-day warranty line that was not tied to any delivery date.
 *
 * A handover here is a real record — what was delivered, whether the client has
 * accepted it, when the warranty actually expires, and access to the credential
 * vault holding the systems being handed over.
 */

const DEFAULT_CHECKLIST = [
  { key: "deliverables", label: "All deliverable files uploaded" },
  { key: "milestones", label: "All milestones approved" },
  { key: "credentials", label: "Credentials and access handed over" },
  { key: "documentation", label: "Documentation provided" },
  { key: "invoices", label: "All invoices settled" },
];

/** Computes the checklist from live data rather than trusting a stored copy. */
async function buildChecklist(projectId: string, orgId: string | null) {
  const [files, milestones, credentials, project] = await Promise.all([
    prisma.file.count({ where: { projectId, archived: false } }),
    prisma.milestone.findMany({ where: { projectId }, select: { status: true } }),
    prisma.credentialVault.count({ where: { projectId } }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { engagementId: true },
    }),
  ]);

  const unpaidInvoices = project
    ? await prisma.invoice.count({
        where: {
          engagementId: project.engagementId,
          status: { notIn: ["PAID", "CANCELLED"] },
          ...(orgId ? { orgId } : {}),
        },
      })
    : 0;

  const approved = milestones.filter((m) => m.status === "APPROVED").length;

  return [
    { ...DEFAULT_CHECKLIST[0], done: files > 0, detail: `${files} file(s)` },
    {
      ...DEFAULT_CHECKLIST[1],
      done: milestones.length > 0 && approved === milestones.length,
      detail: `${approved}/${milestones.length} approved`,
    },
    { ...DEFAULT_CHECKLIST[2], done: credentials > 0, detail: `${credentials} system(s)` },
    { ...DEFAULT_CHECKLIST[3], done: files > 0, detail: null },
    {
      ...DEFAULT_CHECKLIST[4],
      done: unpaidInvoices === 0,
      detail: unpaidInvoices > 0 ? `${unpaidInvoices} outstanding` : "settled",
    },
  ];
}

function warrantyOf(handover: { deliveredAt: Date | null; warrantyDays: number } | null) {
  if (!handover?.deliveredAt) {
    return { active: false, expiresAt: null, daysRemaining: null, startedAt: null };
  }
  const expiresAt = new Date(
    handover.deliveredAt.getTime() + handover.warrantyDays * 86400000,
  );
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
  return {
    active: daysRemaining > 0,
    startedAt: handover.deliveredAt,
    expiresAt,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

export async function handoverRoutes(app: FastifyInstance) {
  /** Projects that have a handover kit, or are far enough along to have one. */
  app.get("/handover/projects", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const projects = await prisma.project.findMany({
      where: {
        ...(scope !== null ? { engagement: { clientId: scope } } : {}),
        OR: [{ status: { in: ["COMPLETED", "ACTIVE"] } }, { handover: { isNot: null } }],
      },
      include: {
        handover: true,
        milestones: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(
      withIds(
        projects.map((p) => {
          const approved = p.milestones.filter((m) => m.status === "APPROVED").length;
          return {
            id: p.id,
            name: p.name || p.id,
            status: p.status,
            handoverStatus: p.handover?.status ?? "PREPARING",
            milestonesApproved: approved,
            milestonesTotal: p.milestones.length,
            warranty: warrantyOf(p.handover),
          };
        }),
      ),
    );
  });

  /** The full kit for one project. */
  app.get("/handover/:projectId", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { projectId } = req.params as { projectId: string };
    if (!(await assertProjectInScope(projectId, scope, reply))) return;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        handover: true,
        milestones: { orderBy: { number: "asc" } },
        service: { select: { id: true, name: true } },
      },
    });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const [files, credentials] = await Promise.all([
      prisma.file.findMany({
        where: { projectId, archived: false },
        orderBy: { createdAt: "desc" },
      }),
      // Never select encryptedBlob here — the list is metadata only; revealing a
      // secret is a separate, audited call.
      prisma.credentialVault.findMany({
        where: { projectId },
        select: { id: true, systemName: true, recoveryMethod: true, accessedAt: true },
      }),
    ]);

    const checklist = await buildChecklist(projectId, scope);

    return ok({
      project: {
        id: project.id,
        _id: project.id,
        name: project.name || project.id,
        status: project.status,
        service: project.service,
      },
      handover: project.handover
        ? { ...project.handover, _id: project.handover.id }
        : { status: "PREPARING", deliveredAt: null, acceptedAt: null, warrantyDays: 30 },
      warranty: warrantyOf(project.handover),
      checklist,
      readyToAccept: checklist.every((c) => c.done),
      deliverables: withIds(
        files.map((f) => ({
          id: f.id,
          name: f.name,
          sizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
          version: f.version,
          createdAt: f.createdAt,
          // Status reflects reality: a file is only "ready" once it is stored.
          status: f.storageKey ? "ready" : "pending",
        })),
      ),
      milestones: withIds(project.milestones),
      credentials: withIds(credentials),
    });
  });

  /** Signed download for a single deliverable. */
  app.get("/handover/:projectId/deliverables/:fileId/download", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { projectId, fileId } = req.params as { projectId: string; fileId: string };
    if (!(await assertProjectInScope(projectId, scope, reply))) return;
    if (!isStorageConfigured()) {
      return reply.code(503).send({ error: "File storage is not configured on this environment." });
    }

    const file = await prisma.file.findFirst({ where: { id: fileId, projectId } });
    if (!file) return reply.code(404).send({ error: "Deliverable not found" });

    return ok({ url: await getPresignedDownload(file.storageKey, 900), name: file.name });
  });

  /**
   * Reveals one credential. Every reveal is appended to the vault entry's
   * access log — handing over production access is exactly the kind of event
   * that needs an audit trail.
   */
  app.post("/handover/:projectId/credentials/:credentialId/reveal", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;

    const { projectId, credentialId } = req.params as {
      projectId: string;
      credentialId: string;
    };
    if (!(await assertProjectInScope(projectId, scope, reply))) return;

    const entry = await prisma.credentialVault.findFirst({
      where: { id: credentialId, projectId },
    });
    if (!entry) return reply.code(404).send({ error: "Credential not found" });

    let secret: unknown;
    try {
      secret = JSON.parse(decryptSecret(entry.encryptedBlob));
    } catch (err) {
      req.log.error({ err, credentialId }, "Credential could not be decrypted");
      return reply.code(500).send({
        error: "This credential could not be decrypted. Please contact your project manager.",
      });
    }

    const log = Array.isArray(entry.accessLog) ? [...entry.accessLog] : [];
    log.push({
      by: req.user!.sub,
      at: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });

    await prisma.credentialVault.update({
      where: { id: credentialId },
      data: { accessedAt: new Date(), accessLog: toJson(log) },
    });

    await emitEvent({
      code: "CREDENTIAL_ACCESSED",
      payload: { credentialId, systemName: entry.systemName },
      actor: req.user!.sub,
      projectId,
    });

    return ok({ id: entry.id, systemName: entry.systemName, credentials: secret });
  });

  /**
   * Client sign-off. This is the moment the warranty clock starts, so the
   * acceptance is recorded with the same evidence a click-wrap signature gets.
   */
  app.post("/handover/:projectId/accept", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;

    const { projectId } = req.params as { projectId: string };
    if (!(await assertProjectInScope(projectId, scope, reply))) return;

    const { notes } = (req.body ?? {}) as { notes?: string };

    const checklist = await buildChecklist(projectId, scope);
    const blocking = checklist.filter((c) => !c.done);
    if (blocking.length > 0) {
      return reply.code(409).send({
        message: "This handover is not ready to accept yet.",
        outstanding: blocking.map((c) => c.label),
      });
    }

    const existing = await prisma.handover.findUnique({ where: { projectId } });
    if (existing?.acceptedAt) {
      return reply.code(409).send({ message: "This handover has already been accepted." });
    }

    const now = new Date();
    const evidence = {
      method: "click",
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
      acceptedAt: now.toISOString(),
      // Binds the acceptance to exactly what was on screen at the time.
      checklistHash: createHash("sha256").update(JSON.stringify(checklist)).digest("hex"),
    };

    const handover = await prisma.handover.upsert({
      where: { projectId },
      create: {
        projectId,
        status: "ACCEPTED",
        deliveredAt: existing?.deliveredAt ?? now,
        acceptedAt: now,
        acceptedBy: req.user!.sub,
        acceptanceEvidence: toJson(evidence),
        notes: notes ?? null,
        checklist: toJson(checklist),
      },
      update: {
        status: "ACCEPTED",
        deliveredAt: existing?.deliveredAt ?? now,
        acceptedAt: now,
        acceptedBy: req.user!.sub,
        acceptanceEvidence: toJson(evidence),
        notes: notes ?? null,
        checklist: toJson(checklist),
      },
    });

    await emitEvent({
      code: "HANDOVER_ACCEPTED",
      payload: { projectId, warrantyDays: handover.warrantyDays },
      actor: req.user!.sub,
      projectId,
    });

    return ok({ ...handover, _id: handover.id, warranty: warrantyOf(handover) });
  });

  /**
   * Raise a dispute instead of accepting. Keeps the project out of an
   * "accepted" state so the warranty clock does not start on work the client
   * does not consider delivered.
   */
  app.post("/handover/:projectId/dispute", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;

    const { projectId } = req.params as { projectId: string };
    if (!(await assertProjectInScope(projectId, scope, reply))) return;

    const { reason } = (req.body ?? {}) as { reason?: string };
    if (!reason?.trim()) {
      return reply.code(400).send({ message: "Please describe what is outstanding." });
    }

    const handover = await prisma.handover.upsert({
      where: { projectId },
      create: { projectId, status: "DISPUTED", notes: reason.trim() },
      update: { status: "DISPUTED", notes: reason.trim() },
    });

    await emitEvent({
      code: "HANDOVER_DISPUTED",
      payload: { projectId, reason: reason.trim() },
      actor: req.user!.sub,
      projectId,
    });

    return ok({ ...handover, _id: handover.id });
  });
}

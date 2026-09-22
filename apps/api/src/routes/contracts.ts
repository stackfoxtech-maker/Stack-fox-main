import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { isStorageConfigured } from "../lib/storage";
import { buildContractPdf } from "../lib/documents";
import { clientScope } from "../lib/scope";
import { LIST_CAP, ok, withId, withIds } from "../lib/http";
import { DELIVERY_ROLES } from "@stackfox/core";
import { issueDownload } from "../lib/documentIntegrity";

export async function contractRoutes(app: FastifyInstance) {
  // GET /contracts
  app.get("/contracts", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { orderId, engId } = req.query as { orderId?: string; engId?: string };
    const where: any = {};
    if (scope !== null) where.engagement = { clientId: scope };
    if (orderId) where.orderId = orderId;
    if (engId) where.engagementId = engId;

    const contracts = await prisma.contract.findMany({
      take: LIST_CAP,
      where,
      include: { signatures: true, engagement: { select: { id: true, model: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(withIds(contracts));
  });

  // GET /contracts/:id
  app.get("/contracts/:id", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    const contract = await prisma.contract.findFirst({
      where: {
        id,
        ...(scope !== null ? { engagement: { clientId: scope } } : {}),
      },
      include: { signatures: true, order: true, engagement: true },
    });
    if (!contract) return reply.code(404).send({ error: "Contract not found" });
    return ok(withId(contract));
  });

  // GET /contracts/:id/pdf
  app.get("/contracts/:id/pdf", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    const contract = await prisma.contract.findFirst({
      where: { id, ...(scope !== null ? { engagement: { clientId: scope } } : {}) },
    });
    if (!contract) return reply.code(404).send({ error: "Contract not found" });

    if (!isStorageConfigured()) {
      return reply.code(503).send({ error: "Document storage is not configured." });
    }

    // Build it now when the queue job never landed, rather than telling the
    // client the PDF does not exist. The contract row is the source of truth;
    // the file is derived from it.
    try {
      const key = contract.fileKey ?? (await buildContractPdf(contract.id));
      if (!key) return reply.code(404).send({ error: "Contract not found" });
      return {
        url: await issueDownload(req, {
          documentType: "CONTRACT",
          documentId: contract.id,
          storageKey: key,
        }),
      };
    } catch (err) {
      req.log.error({ err, contractId: id }, "contract pdf download failed");
      return reply.code(500).send({ error: "Could not prepare the contract PDF." });
    }
  });

  /** Signals a lost race inside the countersign transaction, so it rolls back. */
  class AlreadyCountersigned extends Error {}

  // POST /contracts/:id/countersign — StackFox side
  app.post("/contracts/:id/countersign", async (req, reply) => {
    if (!requireRole(req, reply, DELIVERY_ROLES)) return;
    const { id } = req.params as { id: string };

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) return reply.code(404).send({ error: "Contract not found" });
    if (contract.status !== "CLIENT_SIGNED") {
      return reply.code(409).send({ error: "Contract must be client-signed first" });
    }

    // The signature and the status change are one fact. Written separately, a
    // failure between them left a StackFox signature attached to a contract
    // that was never executed — a signed record of an unsigned agreement.
    const updated = await prisma
      .$transaction(async (tx) => {
        // The status is re-checked inside the write rather than trusted from the
        // read above. Two countersigns arriving together both passed that read
        // and both wrote a signature; updateMany with the expected status in the
        // WHERE makes the second one match zero rows.
        const { count } = await tx.contract.updateMany({
          where: { id, status: "CLIENT_SIGNED" },
          data: { status: "EXECUTED", executedAt: new Date() },
        });
        if (count === 0) {
          // Someone else countersigned between the read and here.
          throw new AlreadyCountersigned();
        }

        await tx.signature.create({
          data: {
            contractId: id,
            signerUserId: req.user!.sub,
            side: "STACKFOX",
            rail: "CLICK",
            evidence: { method: "internal", timestamp: new Date().toISOString() },
          },
        });

        return tx.contract.findUniqueOrThrow({ where: { id } });
      })
      .catch((err: unknown) => {
        if (err instanceof AlreadyCountersigned) return null;
        throw err;
      });

    if (!updated) {
      return reply.code(409).send({ error: "Contract has already been countersigned" });
    }

    await emitEvent({
      code: "CONTRACT_EXECUTED",
      payload: { contractId: id },
      actor: req.user!.sub,
      engagementId: contract.engagementId ?? undefined,
    });

    return updated;
  });
}

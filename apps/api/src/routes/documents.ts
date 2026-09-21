import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { ADMIN_ROLES, CATALOGUE_ROLES } from "@stackfox/core";
import { ok, paginated, pageParams } from "../lib/http";
import {
  verifyDocument,
  issueDownload,
  type DocumentType,
} from "../lib/documentIntegrity";

/**
 * Document integrity surface.
 *
 * These are the endpoints the ledger and access trail exist for: answering
 * "who obtained this contract?" and "are the bytes still the ones we issued?".
 * Both are questions a client, an auditor or a dispute will eventually ask, and
 * until now neither had an answer.
 *
 * Staff only. The access trail is itself sensitive — it says who read what and
 * from where.
 */
export async function documentRoutes(app: FastifyInstance) {
  // GET /documents/:type/:id/access — who obtained this document, and when
  app.get("/documents/:type/:id/access", async (req, reply) => {
    if (!requireRole(req, reply, CATALOGUE_ROLES)) return;
    const { type, id } = req.params as { type: string; id: string };
    const { page, limit, skip } = pageParams(
      req.query as Record<string, string>,
      50,
      200,
    );

    const where = { documentType: type.toUpperCase(), documentId: id };
    const [rows, total] = await Promise.all([
      prisma.documentAccess.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.documentAccess.count({ where }),
    ]);

    // Resolve the actor names in one query rather than one per row.
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return paginated(
      rows.map((r) => ({ ...r, user: r.userId ? (byId.get(r.userId) ?? null) : null })),
      total,
      page,
      limit,
    );
  });

  // GET /documents/:type/:id/verify — do the stored bytes still match the ledger
  app.get("/documents/:type/:id/verify", async (req, reply) => {
    if (!requireRole(req, reply, CATALOGUE_ROLES)) return;
    const { type, id } = req.params as { type: string; id: string };

    const result = await verifyDocument(type.toUpperCase() as DocumentType, id);

    // A mismatch is not a server error — it is a finding, and the caller needs
    // the detail to act on it. Only an unreadable object is a failure.
    if (result.status === "UNREADABLE")
      return reply.code(502).send({ error: result.reason });
    if (result.status === "NO_LEDGER_ENTRY") {
      return reply.code(404).send({
        error:
          "No ledger entry for this document. It predates the ledger, or was never generated.",
      });
    }
    return ok(result);
  });

  // GET /documents/:type/:id/ledger — every version this document has had
  app.get("/documents/:type/:id/ledger", async (req, reply) => {
    if (!requireRole(req, reply, CATALOGUE_ROLES)) return;
    const { type, id } = req.params as { type: string; id: string };

    const entries = await prisma.documentLedger.findMany({
      where: { documentType: type.toUpperCase(), documentId: id },
      orderBy: { generatedAt: "desc" },
      take: 100,
    });

    // More than one row means the document was regenerated. That is legitimate
    // (a paid invoice is re-rendered to show nil balance), but a reader
    // comparing hashes needs to know it happened.
    return ok({ entries, regenerated: entries.length > 1 });
  });

  // GET /documents/contract/:id/archive — the write-once copy of record
  //
  // The archive bucket was effectively write-only: getPresignedDownload always
  // read the primary bucket, so nothing could retrieve the copy the contract
  // text calls the contract of record. This is the dispute path, so it is
  // administrator-only and its own retrieval is audited.
  app.get("/documents/contract/:id/archive", async (req, reply) => {
    if (!requireRole(req, reply, ADMIN_ROLES)) return;
    const { id } = req.params as { id: string };

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract?.wormKey) {
      return reply.code(404).send({ error: "No archive copy exists for this contract." });
    }

    // copyToWorm prefixes the object path with `worm/`, while Contract.wormKey
    // stores the un-prefixed form — so the stored value alone does not resolve.
    const url = await issueDownload(req, {
      documentType: "CONTRACT",
      documentId: `${id}#archive`,
      storageKey: `worm/${contract.wormKey}`,
      archive: true,
      expiresIn: 120,
    });
    return ok({ url, docHash: contract.docHash });
  });
}

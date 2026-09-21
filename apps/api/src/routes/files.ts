import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";
import { getPresignedUpload } from "../lib/storage";
import {
  clientScope,
  clientWriteScope,
  projectIdsInScope,
  assertProjectInScope,
} from "../lib/scope";
import { LIST_CAP, ok, withId, withIds } from "../lib/http";
import { toJson } from "../lib/json";
import { isStorageConfigured, deleteFile } from "../lib/storage";
import { encryptSecret, isCredentialEncryptionConfigured } from "../lib/crypto";
import { VAULT_ROLES } from "@stackfox/core";
import { issueDownload } from "../lib/documentIntegrity";

/**
 * Resolves a file only if it sits inside the caller's tenant. Files hang off a
 * project, and a project off an engagement, so scoping walks that chain; files
 * with no project (general uploads) are visible only to internal staff.
 */
async function findFileInScope(id: string, scope: string | null) {
  return prisma.file.findFirst({
    where: {
      id,
      ...(scope !== null ? { project: { engagement: { clientId: scope } } } : {}),
    },
  });
}

// Types we actively serve inline or expect as attachments. Anything not on
// this list is still storable (the bucket is private, behind auth, and
// downloads now force Content-Disposition: attachment — see
// lib/storage.ts#getPresignedDownload) but we don't want to hand out a signed
// upload slot for a payload whose only purpose is to execute in a browser.
const DANGEROUS_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
]);

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

/** Strips path separators, traversal segments, and control characters from a client-supplied filename. */
function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, ""); // drop any directory component
  const cleaned = base
    .replace(/[\x00-\x1f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return (cleaned || "file").slice(0, 200);
}

export async function fileRoutes(app: FastifyInstance) {
  app.post("/files/upload", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;
    if (!isStorageConfigured()) {
      return reply
        .code(503)
        .send({ error: "File storage is not configured on this environment." });
    }

    const body = req.body as any;
    if (!body?.filename) return reply.code(400).send({ error: "filename is required" });
    if (body.projectId && !(await assertProjectInScope(body.projectId, scope, reply)))
      return;

    const contentType: string = body.contentType ?? "application/octet-stream";
    if (DANGEROUS_CONTENT_TYPES.has(contentType.toLowerCase())) {
      return reply
        .code(400)
        .send({ error: `Files of type ${contentType} cannot be uploaded.` });
    }
    const size = Number(body.size ?? 0);
    if (size > MAX_UPLOAD_BYTES) {
      return reply
        .code(400)
        .send({ error: `Files must be under ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` });
    }

    const safeFilename = sanitizeFilename(body.filename);
    const storageKey = `files/${body.projectId ?? "general"}/${Date.now()}-${safeFilename}`;
    const presigned = await getPresignedUpload(storageKey, contentType);

    const file = await prisma.file.create({
      data: {
        name: safeFilename,
        storageKey,
        sizeBytes: size,
        mimeType: contentType,
        uploadedBy: req.user!.sub,
        projectId: body.projectId,
      },
    });

    return { data: withId(file), meta: { upload: presigned } };
  });

  app.get("/files", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { projectId } = req.query as { projectId?: string };
    const where: any = { archived: false };

    if (scope !== null) {
      const allowed = await projectIdsInScope(scope);
      if (projectId && !allowed!.includes(projectId)) return ok([]);
      where.projectId = { in: projectId ? [projectId] : allowed! };
    } else if (projectId) {
      where.projectId = projectId;
    }

    const files = await prisma.file.findMany({
      take: LIST_CAP,
      where,
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
    });
    return ok(withIds(files));
  });

  app.get("/files/:id/download", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const file = await findFileInScope((req.params as { id: string }).id, scope);
    if (!file) return reply.code(404).send({ error: "File not found" });

    const url = await issueDownload(req, {
      documentType: "FILE",
      documentId: file.id,
      storageKey: file.storageKey,
    });
    return ok({ url });
  });

  app.delete("/files/:id", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    const file = await findFileInScope(id, scope);
    if (!file) return reply.code(404).send({ error: "File not found" });
    if (scope !== null && file.uploadedBy !== req.user!.sub) {
      return reply.code(403).send({ error: "You can only delete files you uploaded" });
    }

    // Remove the object first: a DB row with no blob is recoverable noise, an
    // orphaned blob with no row is unreachable and bills forever.
    try {
      await deleteFile(file.storageKey);
    } catch (err) {
      req.log.warn(
        { err, key: file.storageKey },
        "Storage delete failed; removing record anyway",
      );
    }
    await prisma.file.delete({ where: { id } });
    return ok({ success: true });
  });

  app.post("/files/:id/comment", async (req, reply) => {
    const scope = await clientWriteScope(req, reply);
    if (scope === undefined) return;

    const { id } = req.params as { id: string };
    const { comment } = req.body as { comment: string };
    if (!comment?.trim()) return reply.code(400).send({ error: "comment is required" });

    const file = await findFileInScope(id, scope);
    if (!file) return reply.code(404).send({ error: "File not found" });

    const author = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { name: true },
    });

    const comments = Array.isArray(file.comments) ? [...file.comments] : [];
    comments.push({
      author: req.user!.sub,
      authorName: author?.name ?? "Unknown",
      text: comment.trim(),
      at: new Date().toISOString(),
    });

    const updated = await prisma.file.update({
      where: { id },
      data: { comments: toJson(comments) },
    });
    return ok(withId(updated));
  });

  // Credential vault
  // ── Credential vault ──────────────────────────────────────────────────────
  // Entries hold live production access (hosting, DNS, payment gateways), so
  // the blob is encrypted at rest and only StackFox staff may write one.
  // Reading a secret back is a separate audited call: POST /handover/:projectId/
  // credentials/:credentialId/reveal.

  app.post("/vault", async (req, reply) => {
    if (!requireRole(req, reply, VAULT_ROLES)) return;
    const body = req.body as any;

    if (!body?.projectId) return reply.code(400).send({ error: "projectId is required" });
    if (!isCredentialEncryptionConfigured()) {
      return reply.code(503).send({
        error: "Credential encryption is not configured; refusing to store secrets.",
      });
    }

    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const entry = await prisma.credentialVault.create({
      data: {
        projectId: body.projectId,
        systemName: body.systemName ?? body.label ?? "Unnamed system",
        recoveryMethod: body.recoveryMethod ?? null,
        encryptedBlob: encryptSecret(JSON.stringify(body.credentials ?? {})),
      },
      select: { id: true, systemName: true, recoveryMethod: true, projectId: true },
    });

    return ok(withId(entry));
  });

  app.get("/vault", async (req, reply) => {
    const scope = await clientScope(req, reply);
    if (scope === undefined) return;

    const { projectId } = req.query as { projectId?: string };
    if (!projectId) return reply.code(400).send({ error: "projectId is required" });
    if (!(await assertProjectInScope(projectId, scope, reply))) return;

    // Metadata only — the encrypted blob never leaves the server here.
    const entries = await prisma.credentialVault.findMany({
      take: LIST_CAP,
      where: { projectId },
      select: { id: true, systemName: true, recoveryMethod: true, accessedAt: true },
    });
    return ok(withIds(entries));
  });

  app.delete("/vault/:id", async (req, reply) => {
    if (!requireRole(req, reply, VAULT_ROLES)) return;
    const { id } = req.params as { id: string };
    const entry = await prisma.credentialVault.findUnique({ where: { id } });
    if (!entry) return reply.code(404).send({ error: "Credential not found" });

    await prisma.credentialVault.delete({ where: { id } });
    return ok({ success: true });
  });
}

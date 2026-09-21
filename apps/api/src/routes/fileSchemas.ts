import { z } from "zod";
import { businessId, strictObject } from "../lib/validate";

/**
 * Schemas for the file and credential-vault routes.
 *
 * These were `req.body as any`. The interesting ones are not the obvious
 * fields but the unbounded ones: a comment appended to a JSON array with no
 * cap, and a credential blob JSON-stringified straight into an encrypted
 * column.
 */

/**
 * The declared size of an upload.
 *
 * Advisory only — the actual bytes go to a presigned URL, and this value is
 * what gets written to `File.sizeBytes`. Bounding it stops an absurd number
 * being recorded; it does **not** stop an oversized upload, which is the
 * storage provider's job via the presigned policy.
 */
const declaredSize = z.number().int().nonnegative().max(5_000_000_000);

export const CreateUploadSchema = strictObject({
  filename: z.string().trim().min(1, "filename is required").max(255),
  // Checked against DANGEROUS_CONTENT_TYPES and used in the presigned URL.
  contentType: z.string().trim().max(255).optional(),
  size: declaredSize.optional(),
  // Scope-checked in the handler, and it becomes part of the storage key.
  projectId: businessId.optional(),
});

/**
 * A comment on a file.
 *
 * These append to a JSON array on the File row with no cap, so both the
 * individual comment and — separately, in the handler — the array need a
 * bound. A row that grows without limit is a slow outage: every read of that
 * file drags the whole array with it.
 */
export const FileCommentSchema = strictObject({
  comment: z.string().trim().min(1, "comment is required").max(4000),
});

/** How many comments a single file keeps. Oldest are dropped beyond this. */
export const MAX_FILE_COMMENTS = 500;

/**
 * A credential vault entry.
 *
 * `credentials` is JSON-stringified and encrypted, so nothing downstream
 * inspects its shape — which is exactly why it needs an explicit ceiling here.
 * A record of arbitrary size lands in an encrypted column that is expensive to
 * read and impossible to inspect afterwards.
 */
export const CreateVaultEntrySchema = strictObject({
  projectId: businessId,
  systemName: z.string().trim().min(1).max(200).optional(),
  /** Legacy alias the handler falls back to. */
  label: z.string().trim().min(1).max(200).optional(),
  recoveryMethod: z.string().trim().max(500).optional(),
  credentials: z.record(z.string().max(200), z.string().max(4000)).optional(),
});

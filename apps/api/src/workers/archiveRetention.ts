import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { deleteFile } from "../lib/storage";
import { isRetainedDocument } from "../lib/documentIntegrity";
import { log } from "../lib/logger";

registerCron("archive-retention", async () => {
  const retentionDays = parseInt(process.env.FILE_RETENTION_DAYS ?? "365");
  const cutoff = new Date(Date.now() - retentionDays * 86400000);

  const expiredFiles = await prisma.file.findMany({
    where: { createdAt: { lt: cutoff }, archived: false },
    take: 100,
  });

  let archived = 0;
  let protectedCount = 0;
  for (const file of expiredFiles) {
    // This worker HARD-DELETES the object. Today it only reads prisma.file, and
    // invoice/contract PDFs hang off Invoice.fileKey and Contract.fileKey, so it
    // does not reach them -- but that is luck, not design. One refactor moving
    // PDFs into the File table would turn a cleanup job into a compliance
    // incident. Refuse anything the document ledger knows about.
    if (await isRetainedDocument(file.storageKey)) {
      protectedCount++;
      continue;
    }
    try {
      await deleteFile(file.storageKey);
      await prisma.file.update({
        where: { id: file.id },
        data: { archived: true, archivedAt: new Date() },
      });
      archived++;
    } catch (err) {
      log().error({ err, fileId: file.id }, "archive failed");
    }
  }

  log().info(
    { archived, total: expiredFiles.length, skippedRecords: protectedCount },
    "archive retention sweep complete",
  );
});

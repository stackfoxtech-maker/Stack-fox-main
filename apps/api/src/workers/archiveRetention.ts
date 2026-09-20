import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { deleteFile } from "../lib/storage";
import { isRetainedDocument } from "../lib/documentIntegrity";

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
      console.error(`[archiveRetention] Failed to archive ${file.id}:`, err);
    }
  }

  console.log(
    `[archiveRetention] Archived ${archived}/${expiredFiles.length} files` +
      (protectedCount ? `, skipped ${protectedCount} document(s) of record` : ""),
  );
});

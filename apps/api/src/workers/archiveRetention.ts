import { registerCron } from "./cron/registry";
import { prisma } from "@stackfox/prisma";
import { deleteFile } from "../lib/storage";
import { isRetainedDocument } from "../lib/documentIntegrity";
import { log } from "../lib/logger";

registerCron("archive-retention", async () => {
  const retentionDays = parseInt(process.env.FILE_RETENTION_DAYS ?? "365");
  const cutoff = new Date(Date.now() - retentionDays * 86400000);

  // Only files of finished work (or with no project). This job HARD-DELETES the
  // stored object, and it used to include the live deliverables of an engagement
  // that is still running just because they were over a year old.
  const where = {
    createdAt: { lt: cutoff },
    archived: false,
    OR: [
      { projectId: null },
      { project: { status: { in: ["COMPLETED", "CANCELLED"] } } },
    ],
  };

  let archived = 0;
  let protectedCount = 0;
  let total = 0;
  // Page through everything with a cursor. A fixed "first 100" starved the sweep: rows
  // that were skipped (retained documents, failed deletes) were re-read every run and
  // blocked all the files behind them.
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const files = await prisma.file.findMany({
      where,
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (files.length === 0) break;
    cursor = files[files.length - 1].id;
    total += files.length;

    for (const file of files) {
      // Refuse anything the document ledger knows about (invoice/contract PDFs).
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
  }

  log().info(
    { archived, total, skippedRecords: protectedCount },
    "archive retention sweep complete",
  );
});

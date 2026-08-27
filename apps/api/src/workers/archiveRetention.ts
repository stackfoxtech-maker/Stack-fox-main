import { createWorker, QUEUE } from "../lib/queue";
import { prisma } from "@stackfox/prisma";
import { deleteFile } from "../lib/storage";

createWorker(QUEUE.archiveRetention, async () => {
  const retentionDays = parseInt(process.env.FILE_RETENTION_DAYS ?? "365");
  const cutoff = new Date(Date.now() - retentionDays * 86400000);

  const expiredFiles = await prisma.file.findMany({
    where: { createdAt: { lt: cutoff }, archived: false },
    take: 100,
  });

  let archived = 0;
  for (const file of expiredFiles) {
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

  console.log(`[archiveRetention] Archived ${archived}/${expiredFiles.length} files`);
});

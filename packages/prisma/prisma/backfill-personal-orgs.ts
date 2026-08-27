/**
 * One-off backfill: every client-side user must belong to an Org, because the
 * whole client portal is scoped through `User.orgId -> Engagement.clientId`.
 * Users created before that rule existed have `orgId = null` and would see an
 * empty dashboard (or, before scoping landed, everyone's data).
 *
 * Safe to re-run — it only touches users that still have no org.
 *
 *   pnpm --filter @stackfox/prisma exec tsx prisma/backfill-personal-orgs.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const INTERNAL = new Set([
  "ADMIN", "SUPER_ADMIN", "SE", "SENIOR_PM", "PM", "DEVELOPER",
  "QA", "DESIGNER", "DEVOPS", "FINANCE", "SALES", "TEAM",
]);

function orgId(): string {
  const seq = String(parseInt(randomBytes(2).toString("hex"), 16) % 10000).padStart(4, "0");
  return `ORG-${new Date().getFullYear()}-${seq}`;
}

async function uniqueOrgId(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const id = orgId();
    if (!(await prisma.org.findUnique({ where: { id } }))) return id;
  }
  throw new Error("Could not allocate a free org id after 20 attempts");
}

async function main() {
  const users = await prisma.user.findMany({ where: { orgId: null } });
  console.log(`Found ${users.length} users without an org.`);

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const user of users) {
    if (INTERNAL.has(user.role.trim().toUpperCase())) {
      skipped++;
      continue;
    }

    // Reuse an org already registered against this email rather than creating a
    // duplicate tenant for the same person.
    const existing = await prisma.org.findFirst({ where: { contactEmail: user.email } });
    if (existing) {
      await prisma.user.update({ where: { id: user.id }, data: { orgId: existing.id } });
      linked++;
      console.log(`  linked ${user.email} -> ${existing.id} (existing)`);
      continue;
    }

    const id = await uniqueOrgId();
    await prisma.org.create({
      data: {
        id,
        name: user.name || user.email.split("@")[0],
        type: "INDIVIDUAL",
        contactEmail: user.email,
        contactPhone: user.phone,
        status: "ACTIVE",
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { orgId: id } });
    created++;
    console.log(`  created ${id} for ${user.email}`);
  }

  console.log(`\nDone. created=${created} linked=${linked} skipped-internal=${skipped}`);

  const remaining = await prisma.user.count({ where: { orgId: null } });
  console.log(`Users still without an org: ${remaining} (internal staff do not need one).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";
import { requireSeedPassword, upsertStaffUser } from "./seed-helpers";

config({ path: resolve(__dirname, "../../..", ".env") });

const prisma = new PrismaClient();

/**
 * Creates the local demo logins. Development convenience only.
 *
 * This used to default every password and print the credentials on success,
 * and it replaced `authData` wholesale on re-run — resetting live passwords and
 * wiping the session-revocation epoch. It now refuses to run without explicit
 * passwords, never touches an existing credential unless told to, and refuses
 * to run at all against a production environment.
 */
async function quickSeed() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "\n  quick-seed creates shared demo accounts and will not run with NODE_ENV=production.\n" +
        "  Use `pnpm --filter @stackfox/api seed:master-admin` instead.\n",
    );
    process.exit(1);
  }

  console.log("🦊 Quick seeding demo users...");

  const adminPassword = requireSeedPassword("ADMIN_PASSWORD");
  const salesPassword = requireSeedPassword("SALES_PASSWORD");
  const resetPassword = process.env.SEED_RESET_PASSWORDS === "true";

  const users = [
    { name: "StackFox Admin", email: "admin@stackfox.tech", role: "ADMIN", password: adminPassword },
    { name: "Sales Executive", email: "sales@stackfox.tech", role: "SE", password: salesPassword },
    { name: "Senior Sales Manager", email: "sales.lead@stackfox.tech", role: "SENIOR_PM", password: salesPassword },
    { name: "Sales Manager", email: "sales.manager@stackfox.tech", role: "SALES", password: salesPassword },
  ];

  for (const u of users) {
    const result = await upsertStaffUser(
      prisma,
      { name: u.name, email: u.email, role: u.role },
      u.password,
      { resetPassword },
    );
    console.log(`  ✓ ${u.email} (${u.role}) — ${result}`);
  }

  console.log("✅ Demo users ready.");
  console.log("   Passwords are the ADMIN_PASSWORD / SALES_PASSWORD values you supplied.");
  console.log("   An existing account keeps its current password unless SEED_RESET_PASSWORDS=true.");
}

quickSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";
import { createHash } from "crypto";

config({ path: resolve(__dirname, "../../..", ".env") });

const prisma = new PrismaClient();

async function quickSeed() {
  console.log("🦊 Quick seeding demo users...");

  const salesPassword = process.env.SALES_PASSWORD || "Sales@Stackfox2025";
  const salesPasswordHash = createHash("sha256").update(salesPassword).digest("hex");
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@Stackfox2025";
  const adminPasswordHash = createHash("sha256").update(adminPassword).digest("hex");

  const users = [
    { name: "StackFox Admin", email: "admin@stackfox.tech", role: "ADMIN", passwordHash: adminPasswordHash },
    { name: "Sales Executive", email: "sales@stackfox.tech", role: "SE", passwordHash: salesPasswordHash },
    { name: "Senior Sales Manager", email: "sales.lead@stackfox.tech", role: "SENIOR_PM", passwordHash: salesPasswordHash },
    { name: "Sales Manager", email: "sales.manager@stackfox.tech", role: "SALES", passwordHash: salesPasswordHash },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        role: u.role,
        isActive: true,
        authData: {
          provider: "email",
          verified: true,
          passwordHash: u.passwordHash,
        },
      },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: true,
        authData: { provider: "email", verified: true, passwordHash: u.passwordHash },
      },
    });
    console.log(`  ✓ ${u.email} (${u.role})`);
  }

  console.log("✅ Demo users ready!");
  console.log("   Admin:    admin@stackfox.tech / Admin@Stackfox2025");
  console.log("   Sales:    sales@stackfox.tech / Sales@Stackfox2025");
}

quickSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

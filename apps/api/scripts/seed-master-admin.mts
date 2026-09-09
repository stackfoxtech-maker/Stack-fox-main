/**
 * Seeds (or repairs) the master admin account.
 *
 * SUPER_ADMIN already exists as one of the eleven internal roles, so this does
 * not invent a new tier of access — it just guarantees there is a real, usable
 * login holding that role. A fresh database has no users at all, which means
 * nobody can reach the admin panel to create the first one; this is the way in.
 *
 * Credentials come from the environment and are never defaulted. A seed script
 * that ships a fallback password is a backdoor: it gets copied to production,
 * nobody changes it, and the account is public knowledge. Refusing to run is
 * the safer failure.
 *
 * Idempotent. Run it again to reset the password or re-elevate the role after
 * an accidental downgrade; it will not create a duplicate.
 *
 *   MASTER_ADMIN_EMAIL=you@example.com \
 *   MASTER_ADMIN_PASSWORD='<strong password>' \
 *   pnpm --filter @stackfox/api seed:master-admin
 */
import { prisma } from "@stackfox/prisma";
import { hashPassword } from "../src/lib/password";
import { toJson } from "../src/lib/json";

const EMAIL = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
const PASSWORD = process.env.MASTER_ADMIN_PASSWORD;
const NAME = process.env.MASTER_ADMIN_NAME?.trim() || "Master Admin";

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!EMAIL) fail("MASTER_ADMIN_EMAIL is not set.");
if (!PASSWORD) fail("MASTER_ADMIN_PASSWORD is not set.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(EMAIL)) fail(`"${EMAIL}" is not a valid email address.`);
if (PASSWORD.length < 12) {
  fail("MASTER_ADMIN_PASSWORD must be at least 12 characters. This account can see every tenant.");
}

const passwordHash = await hashPassword(PASSWORD);

const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

if (existing) {
  const previousRole = existing.role;
  const authData = (existing.authData as Record<string, unknown> | null) ?? {};

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      role: "SUPER_ADMIN",
      isActive: true,
      // Preserve anything else already on authData (OAuth links, flags) and
      // replace only the password.
      authData: toJson({ ...authData, provider: "email", passwordHash, verified: true }),
    },
  });

  console.log(`\n  Updated existing user ${EMAIL}`);
  console.log(`    role      ${previousRole} -> SUPER_ADMIN`);
  console.log(`    password  reset`);
  console.log(`    status    active, verified\n`);
} else {
  const user = await prisma.user.create({
    data: {
      name: NAME,
      email: EMAIL,
      role: "SUPER_ADMIN",
      isActive: true,
      authData: toJson({ provider: "email", passwordHash, verified: true }),
    },
  });

  console.log(`\n  Created master admin`);
  console.log(`    id     ${user.id}`);
  console.log(`    email  ${EMAIL}`);
  console.log(`    name   ${NAME}`);
  console.log(`    role   SUPER_ADMIN\n`);
}

// Internal staff are not scoped to an Org — clientScope() returns null for
// them — so deliberately no org is attached here.
await prisma.$disconnect();

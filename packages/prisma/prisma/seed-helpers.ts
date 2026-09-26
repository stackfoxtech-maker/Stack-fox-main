import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";
import type { Prisma, PrismaClient } from "@prisma/client";

export function requireLocalSeedDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(
      "Seed scripts require a local database; use a reviewed production data migration for remote databases",
    );
  }
}

/**
 * Safe primitives for the seed scripts.
 *
 * Two bugs motivated this file.
 *
 * 1. Both seeds defaulted their passwords — `ADMIN_PASSWORD || "Admin@Stackfox2025"` —
 *    and that literal is printed in `.env.example`. Four privileged accounts
 *    therefore shipped with credentials that are public knowledge to anyone who
 *    can read the repository. `scripts/seed-master-admin.mts` already gets this
 *    right and refuses to run without an explicit password; these helpers apply
 *    the same rule.
 *
 * 2. The `update` branch of each upsert REPLACED the whole `authData` object,
 *    directly under a comment claiming it preserved an existing password. So
 *    re-running the seed reset passwords to the default, dropped any linked
 *    Google identity, and wiped `sessionEpoch` — silently un-revoking every
 *    token that had previously been invalidated for those accounts.
 */

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

/**
 * Produces the same `scrypt$<salt>$<hash>` form that
 * `apps/api/src/lib/password.ts` writes and verifies. The seeds previously
 * wrote a bare unsalted SHA-256 digest, which `verifyPassword` still accepts
 * for legacy rows — so seeded accounts were the only ones in the system
 * deliberately created under the weak scheme.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Reads a required password from the environment, or exits.
 *
 * A seed that ships a fallback password is a backdoor: it gets copied into a
 * deployed environment, nobody changes it, and the credential is public.
 * Refusing to run is the safer failure.
 */
export function requireSeedPassword(varName: string, minLength = 12): string {
  const value = process.env[varName];
  if (!value) {
    console.error(
      `\n  ${varName} is not set.\n\n` +
        `  This seed creates a privileged account and will not invent a password for it.\n` +
        `  Generate one and pass it in, for example:\n\n` +
        `    ${varName}="$(openssl rand -base64 24)" pnpm db:seed\n`,
    );
    process.exit(1);
  }
  if (value.length < minLength) {
    console.error(
      `\n  ${varName} must be at least ${minLength} characters. ` +
        `This account can see every tenant.\n`,
    );
    process.exit(1);
  }
  return value;
}

export interface StaffUserSpec {
  name: string;
  email: string;
  role: string;
}

/**
 * Creates a staff account, or brings an existing one up to the expected role
 * WITHOUT touching its credentials.
 *
 * The password is written on creation only. An existing row keeps whatever it
 * has — its password, its Google link, and critically its `sessionEpoch`, which
 * session revocation depends on. Pass `resetPassword: true` to deliberately
 * rotate, which is the only path that should ever overwrite a live credential.
 */
export async function upsertStaffUser(
  prisma: PrismaClient,
  spec: StaffUserSpec,
  password: string,
  opts: { resetPassword?: boolean } = {},
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    select: { id: true, role: true, isActive: true, authData: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        name: spec.name,
        email: spec.email,
        role: spec.role,
        isActive: true,
        authData: {
          provider: "email",
          verified: true,
          passwordHash: await hashPassword(password),
          sessionEpoch: 0,
        },
      },
    });
    return "created";
  }

  const authData = (existing.authData as Record<string, unknown> | null) ?? {};
  const needsRoleFix = existing.role !== spec.role || !existing.isActive;

  if (!needsRoleFix && !opts.resetPassword) return "unchanged";

  // Merge, never replace. Anything already on authData that this seed does not
  // own — googleId, verifiedAt, sessionEpoch — survives.
  const nextAuthData: Record<string, unknown> = { ...authData };
  if (opts.resetPassword) {
    nextAuthData.provider = "email";
    nextAuthData.verified = true;
    nextAuthData.passwordHash = await hashPassword(password);
    // Rotating a password must invalidate every token minted before it.
    const epoch = Number(authData.sessionEpoch);
    nextAuthData.sessionEpoch = (Number.isFinite(epoch) ? Math.floor(epoch) : 0) + 1;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      role: spec.role,
      isActive: true,
      authData: nextAuthData as Prisma.InputJsonObject,
    },
  });
  return "updated";
}

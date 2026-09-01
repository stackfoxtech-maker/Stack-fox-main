import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth, requireRole } from "../plugins/auth";
import { emitEvent } from "../lib/events";
import { hashPassword, verifyPassword } from "../lib/password";
import { toJson } from "../lib/json";
import { ok, withId, paginated, pageParams } from "../lib/http";
import { INTERNAL_ROLES, CLIENT_ROLES, isInternalRole } from "@stackfox/core";
import { ensurePersonalOrg } from "../lib/scope";
import { bumpSessionEpoch } from "../lib/session";


const ALL_ROLES = [...INTERNAL_ROLES, ...CLIENT_ROLES] as readonly string[];

/** Fields safe to return for any user record. */
const PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  orgId: true,
  isActive: true,
  designation: true,
  skills: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export async function userRoutes(app: FastifyInstance) {
  app.get("/users", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN"])) return;
    const q = req.query as Record<string, string>;
    const { page, limit, skip } = pageParams(q);

    const where: any = {};
    if (q.role && q.role !== "all") where.role = { equals: q.role, mode: "insensitive" };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: PUBLIC_SELECT,
      }),
      prisma.user.count({ where }),
    ]);
    return paginated(users, total, page, limit);
  });

  app.post("/users", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN"])) return;
    const { name, email, password, role, designation } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      designation?: string;
    };
    if (!name || !email || !password) {
      return reply.code(400).send({ message: "name, email and password are required" });
    }
    if (password.length < 8) {
      return reply.code(400).send({ message: "Password must be at least 8 characters" });
    }
    if (role && !ALL_ROLES.includes(role)) {
      return reply.code(400).send({ message: `Unknown role. Valid roles: ${ALL_ROLES.join(", ")}` });
    }

    const normalisedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });
    if (existing) return reply.code(409).send({ message: "Email already registered" });

    const user = await prisma.user.create({
      data: {
        name,
        email: normalisedEmail,
        role: role ?? "INDIVIDUAL_CLIENT",
        designation: designation ?? null,
        // Uses the same salted scrypt KDF as registration — an admin-created
        // account must not land on the legacy unsalted digest.
        authData: toJson({
          provider: "email",
          passwordHash: await hashPassword(password),
          verified: false,
        }),
      },
      select: PUBLIC_SELECT,
    });

    // Client-side accounts are scoped by an Org, so provision one immediately.
    if ((CLIENT_ROLES as readonly string[]).includes(user.role)) {
      await ensurePersonalOrg(user.id);
    }

    await emitEvent({
      code: "USER_CREATED",
      payload: { userId: user.id, role: user.role },
      actor: req.user!.sub,
    });

    return ok(withId(user));
  });

  // ── Self-service ───────────────────────────────────────────────────────────

  app.get("/users/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: PUBLIC_SELECT,
    });
    if (!user) return reply.code(404).send({ message: "User not found" });
    return ok({ user: withId(user) });
  });

  app.put("/users/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Allowlisted: a user may edit their own presentation, never their role,
    // org membership, email or active flag.
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.phone === "string") data.phone = body.phone.trim() || null;
    if (typeof body.designation === "string") data.designation = body.designation.trim() || null;
    if (typeof body.avatarUrl === "string") data.avatarUrl = body.avatarUrl.trim() || null;
    if (Array.isArray(body.skills)) {
      data.skills = body.skills
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40);
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ message: "No updatable fields were supplied." });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data,
      select: PUBLIC_SELECT,
    });

    return ok({ user: withId(user) });
  });

  app.put("/users/me/password", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ message: "Current and new password are required" });
    }
    if (newPassword.length < 8) {
      return reply.code(400).send({ message: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    const authData = ((user?.authData ?? {}) as Record<string, unknown>);
    const storedHash = (authData.passwordHash as string) ?? "";

    // verifyPassword also accepts the legacy unsalted digest, so a user whose
    // password predates the KDF change can still authenticate here — and the
    // new password is written under scrypt, upgrading them.
    if (!storedHash || !(await verifyPassword(currentPassword, storedHash))) {
      return reply.code(400).send({ message: "Current password is incorrect" });
    }

    await prisma.user.update({
      where: { id: req.user!.sub },
      data: {
        authData: toJson({ ...authData, passwordHash: await hashPassword(newPassword) }),
      },
    });

    // Changing a password must end every other session. The epoch bump is the
    // durable part (invalidates outstanding access tokens even with Redis down).
    await bumpSessionEpoch(req.user!.sub).catch(() => {
      req.log.warn("Could not bump session epoch after a password change");
    });

    return ok({ success: true });
  });

  /**
   * Staff directory. Internal roles need to see colleagues for capacity
   * planning, task assignment and peer reviews — without exposing the full
   * admin user list (which includes every client account and their email).
   */
  app.get("/users/directory", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!isInternalRole(req.user!.role)) {
      return reply.code(403).send({ message: "Staff only." });
    }

    const staff = await prisma.user.findMany({
      where: { isActive: true, role: { in: [...INTERNAL_ROLES] } },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, role: true,
        designation: true, skills: true, avatarUrl: true,
      },
    });
    return ok(staff.map((u) => ({ ...u, _id: u.id })));
  });

  // ── Admin ──────────────────────────────────────────────────────────────────

  app.put("/users/:id", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN", "SUPER_ADMIN"])) return;
    const { id } = req.params as { id: string };
    const { role, isActive } = req.body as { role?: string; isActive?: boolean };

    const data: any = {};
    if (role !== undefined) {
      if (!ALL_ROLES.includes(role)) {
        return reply.code(400).send({ message: `Unknown role. Valid roles: ${ALL_ROLES.join(", ")}` });
      }
      // Locking yourself out, or quietly demoting yourself, is never intended.
      if (id === req.user!.sub && role !== req.user!.role) {
        return reply.code(409).send({ message: "You cannot change your own role." });
      }
      data.role = role;
    }
    if (isActive !== undefined) {
      if (id === req.user!.sub && isActive === false) {
        return reply.code(409).send({ message: "You cannot deactivate your own account." });
      }
      data.isActive = isActive;
    }
    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ message: "Nothing to update" });
    }

    const user = await prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT });

    // A deactivated or demoted user must not keep an active session. The epoch
    // bump invalidates their outstanding access tokens even if Redis is down;
    // it also clears the refresh token.
    await bumpSessionEpoch(id).catch(() => {
      /* DB write is best-effort here — role/status change already persisted */
    });

    await emitEvent({
      code: role !== undefined ? "USER_ROLE_CHANGED" : "USER_STATUS_CHANGED",
      payload: { userId: id, role, isActive },
      actor: req.user!.sub,
    });

    return ok(withId(user));
  });
}

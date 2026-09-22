import { z } from "zod";
import { email, httpUrl, password, strictObject } from "../lib/validate";
import { phone } from "./authSchemas";

/**
 * Schemas for the user routes — the privilege surface.
 *
 * `PUT /users/:id` writes `role` and `isActive`, so this is where an
 * escalation would happen. The authority checks (which roles a caller may
 * assign, no self-demotion, no self-deactivation) stay in the handler because
 * they depend on who is asking; these schemas bound the input, which is a
 * different job.
 *
 * `PUT /users/me` was already carefully allowlisted by hand, field by field —
 * that part was right. What it did not have was any length limit, so a name,
 * designation or avatar URL could be arbitrarily large on its way into the
 * row. The allowlist survives as the schema's shape; the bounds are new.
 */

/** Presentation fields a user may set on themselves. */
const displayName = z.string().trim().min(1).max(200);

export const CreateUserSchema = strictObject({
  name: displayName,
  email,
  password,
  // Checked against ALL_ROLES in the handler, which also decides whether the
  // caller is allowed to assign it.
  role: z.string().trim().min(1).max(50).optional(),
  designation: z.string().trim().max(200).optional(),
});

export const UpdateMeSchema = strictObject({
  name: displayName.optional(),
  // Empty string is meaningful here: it clears the field to null.
  phone: z.union([phone, z.literal("")]).optional(),
  designation: z.string().trim().max(200).optional(),
  avatarUrl: z.union([httpUrl, z.literal("")]).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "No updatable fields were supplied.",
});

/**
 * The current password is checked against the stored hash, so it gets only a
 * length ceiling — an account created before the policy must still be able to
 * change its password, and the policy applies to what it is changing *to*.
 */
export const ChangePasswordSchema = strictObject({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
}).refine((b) => b.currentPassword !== b.newPassword, {
  message: "The new password must differ from the current one",
  path: ["newPassword"],
});

export const UpdateUserSchema = strictObject({
  role: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "Provide at least one field to update",
});

/**
 * List filters. `pageParams` already clamps page and limit; what it does not
 * bound is `search`, which goes straight into a Prisma `contains` — an
 * unbounded term is a scan the database pays for on an endpoint anyone
 * authenticated can call.
 */
// Deliberately not .strict(): query strings collect stray parameters (utm_*,
// cache busters) that are nobody's bug, and rejecting a GET over one is
// hostile. Zod's default strips them instead.
export const ListUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  role: z.string().trim().max(50).optional(),
  search: z.string().trim().max(120).optional(),
});

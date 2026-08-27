/**
 * The 18 roles split into two worlds: *internal* staff, who work across every
 * client, and *external* client-side users, whose visibility is confined to
 * their own Org. Every client-facing query is scoped on this distinction, so
 * adding a role here without classifying it is a data-leak waiting to happen.
 */
export const INTERNAL_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "SE",
  "SENIOR_PM",
  "PM",
  "DEVELOPER",
  "QA",
  "DESIGNER",
  "DEVOPS",
  "FINANCE",
  "SALES",
] as const;

export const CLIENT_ROLES = [
  "INDIVIDUAL_CLIENT",
  "ORG_OWNER",
  "CLIENT_ADMIN",
  "CLIENT_PM",
  "CLIENT_VIEWER",
  "CLIENT",
  "REFERRER",
] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type ClientRole = (typeof CLIENT_ROLES)[number];
export type Role = InternalRole | ClientRole;

/** Legacy lowercase roles still present in the database ('team', 'admin', 'client'). */
function normalise(role: string): string {
  return role.trim().toUpperCase();
}

export function isInternalRole(role: string | undefined | null): boolean {
  if (!role) return false;
  const r = normalise(role);
  return (INTERNAL_ROLES as readonly string[]).includes(r) || r === "TEAM";
}

export function isClientRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return (CLIENT_ROLES as readonly string[]).includes(normalise(role));
}

/** Client-side roles permitted to spend money or accept legal terms. */
export function canTransact(role: string | undefined | null): boolean {
  if (!role) return false;
  const r = normalise(role);
  return ["INDIVIDUAL_CLIENT", "ORG_OWNER", "CLIENT_ADMIN", "CLIENT"].includes(r);
}

/** CLIENT_VIEWER is deliberately read-only across the whole client portal. */
export function isReadOnlyClient(role: string | undefined | null): boolean {
  return normalise(role ?? "") === "CLIENT_VIEWER";
}

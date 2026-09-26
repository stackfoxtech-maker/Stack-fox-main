/**
 * The 17 roles split into two worlds: *internal* staff, who work across every
 * client, and *external* client-side users, whose visibility is confined to
 * their own Org. Every client-facing query is scoped on this distinction, so
 * adding a role here without classifying it is a data-leak waiting to happen.
 */
export const INTERNAL_ROLES = [
  "ADMIN",
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

// ═══════════════════════════════════════════════════════════════════════════
// Authorisation policy
//
// These exist because the role lists were previously written out as literal
// arrays at ~40 call sites across the API, the Zustand store and the router —
// four independent copies that drifted. SALES and FINANCE appeared in no client
// guard at all, and getDashboardPath() sent them to a route that also rejected
// them — a redirect loop.
//
// SUPER_ADMIN was retired on 2026-09-22. It appeared in all seven sets below
// and in none of them alone, so it granted exactly what ADMIN granted — a name
// implying a privilege ladder that did not exist. The risk was not the code but
// the reading of it: an operator handed ADMIN, believing it the lesser grant,
// received the catalogue, every user, finance and the credential vault. The one
// production account holding it was migrated to ADMIN before this landed.
//
// Guards take a policy set from here. Never an inline literal.
// ═══════════════════════════════════════════════════════════════════════════

/** Full platform administration: user roles, settings, destructive operations. */
export const ADMIN_ROLES = ["ADMIN"] as const;

/** Service catalogue, feature units, bundles, rate cards, governance. */
export const CATALOGUE_ROLES = ["ADMIN", "SE", "SENIOR_PM"] as const;

/** Delivery management: engagements, projects, programmes, contracts, tasks. */
export const DELIVERY_ROLES = ["ADMIN", "SENIOR_PM", "PM", "SE"] as const;

/** Money movement: credit notes, write-offs, manual settlement. */
export const FINANCE_ROLES = ["ADMIN", "FINANCE"] as const;

/** Reading financial reports — wider than acting on them. */
export const FINANCE_VIEW_ROLES = ["ADMIN", "FINANCE", "SENIOR_PM", "PM"] as const;

/** Staff who deliver the work: may start a milestone and submit it for review. */
export const MILESTONE_WORK_ROLES = [
  "ADMIN",
  "SENIOR_PM",
  "PM",
  "SE",
  "DEVELOPER",
  "DESIGNER",
  "QA",
  "DEVOPS",
] as const;

/** May approve a submitted milestone, which raises its invoice. */
export const MILESTONE_APPROVE_ROLES = ["ADMIN", "SENIOR_PM", "PM"] as const;

/** Leads, proposals, follow-ups, the sales workspace. */
export const SALES_ROLES = ["ADMIN", "SALES", "SENIOR_PM", "SE", "PM"] as const;

/** Production credential vault: who may store or destroy client secrets. */
export const VAULT_ROLES = ["ADMIN", "PM", "SENIOR_PM", "DEVOPS"] as const;

/** Every internal role. Use when the only question is staff vs client. */
export const STAFF_ROLES = INTERNAL_ROLES;

/** True for the role that may change another user's role or access. */
export function isAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(normalise(role));
}

/**
 * Which dashboard a role owns. Single source of truth for both the API and the
 * client router — a role that resolves to a dashboard its guard rejects is a
 * redirect loop, so these must agree.
 */
export function dashboardForRole(
  role: string | undefined | null,
): "admin" | "sales" | "team" | "client" {
  const r = normalise(role ?? "");
  if (isAdminRole(r)) return "admin";
  if (r === "SALES") return "sales";
  if (isInternalRole(r)) return "team";
  return "client";
}

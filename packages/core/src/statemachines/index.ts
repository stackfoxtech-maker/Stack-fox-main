export type ProjectStatus =
  | "DRAFT"
  | "SCOPING"
  | "ESTIMATION"
  | "CONTRACTING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type MilestoneStatus =
  "UPCOMING" | "IN_PROGRESS" | "IN_REVIEW" | "REVISION" | "APPROVED";

export type OrderStatus =
  "PENDING" | "ACCEPTED" | "CONTRACTING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "DISPUTED";

export interface Transition<S extends string> {
  from: S;
  to: S;
  guard?: string;
}

export const PROJECT_TRANSITIONS: Transition<ProjectStatus>[] = [
  { from: "DRAFT", to: "SCOPING" },
  { from: "SCOPING", to: "ESTIMATION" },
  { from: "ESTIMATION", to: "CONTRACTING" },
  { from: "CONTRACTING", to: "ACTIVE", guard: "G-039" },
  { from: "ACTIVE", to: "ON_HOLD" },
  { from: "ON_HOLD", to: "ACTIVE" },
  { from: "ACTIVE", to: "COMPLETED" },
  { from: "ACTIVE", to: "CANCELLED" },
];

/**
 * Delivery work moves forward by the team, and back only through review.
 * APPROVED is terminal: it raises the milestone invoice.
 */
export const MILESTONE_TRANSITIONS: Transition<MilestoneStatus>[] = [
  { from: "UPCOMING", to: "IN_PROGRESS" },
  { from: "IN_PROGRESS", to: "IN_REVIEW" },
  { from: "REVISION", to: "IN_REVIEW" },
  { from: "IN_REVIEW", to: "APPROVED" },
  { from: "IN_REVIEW", to: "REVISION" },
];

export function canTransition<S extends string>(
  current: S,
  target: S,
  transitions: Transition<S>[],
): boolean {
  return transitions.some((t) => t.from === current && t.to === target);
}

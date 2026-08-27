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
  | "UPCOMING"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "REVISION"
  | "APPROVED";

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "CONTRACTING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

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

export function canTransition<S extends string>(
  current: S,
  target: S,
  transitions: Transition<S>[],
): boolean {
  return transitions.some((t) => t.from === current && t.to === target);
}

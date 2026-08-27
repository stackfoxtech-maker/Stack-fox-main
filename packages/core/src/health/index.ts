export type HealthState = "ACTIVE" | "COOLING" | "DORMANT" | "LOST";

export interface HealthFactors {
  daysSinceLastOrder: number;
  outstandingInvoices: number;
  openTickets: number;
  npsScore?: number;
}

export function computeHealthState(factors: HealthFactors): HealthState {
  if (factors.daysSinceLastOrder > 365) return "LOST";
  if (factors.daysSinceLastOrder > 180) return "DORMANT";
  if (factors.outstandingInvoices > 2 || factors.openTickets > 5) return "COOLING";
  return "ACTIVE";
}

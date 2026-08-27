export type EngagementModel = "FPM" | "TNM" | "RET" | "DED" | "DSC";

export interface BillingConfig {
  model: EngagementModel;
  milestonePayments?: Array<{ milestone: number; pct: number }>;
  hourlyRates?: Record<string, number>;
  retainerAmount?: number;
  dedicatedDayRate?: number;
}

export function calculateMilestonePayment(
  grandTotal: number,
  pct: number,
): { subtotal: number; gst: number; total: number } {
  const subtotal = Math.round(grandTotal * (pct / 100));
  const gst = Math.round(subtotal * 0.18);
  return { subtotal, gst, total: subtotal + gst };
}

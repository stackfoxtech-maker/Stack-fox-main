export type EngagementModel = "FPM" | "TNM" | "RET" | "DED" | "DSC";

/**
 * Checkout payment-terms split, as a fraction of the order/quote total.
 * The single source of truth for the 30%/95% figures — these used to be
 * copy-pasted as magic numbers across checkout.ts, quotes.ts and the client,
 * which is how they drifted out of sync in the first place.
 */
export const PAYMENT_TERMS = {
  UPFRONT: 0.95, // 5% discount for paying in full upfront
  MILESTONE: 0.3,
  FULL: 1,
} as const;

export type PaymentMode = keyof typeof PAYMENT_TERMS;

export function paymentModeAmount(total: number, mode: string | undefined): number {
  const pct = (PAYMENT_TERMS as Record<string, number>)[mode ?? ""] ?? PAYMENT_TERMS.FULL;
  return Math.round(total * pct);
}

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

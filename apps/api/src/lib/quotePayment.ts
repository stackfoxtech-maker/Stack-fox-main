import { paymentModeAmount } from "@stackfox/core";

export function quotePaymentTerms(
  subtotal: number,
  total: number,
  amountPaid: number,
  mode: string,
) {
  if (amountPaid > 0)
    return { amount: total - amountPaid, subtotal, gstAmount: total - subtotal, total };
  const amount = paymentModeAmount(total, mode);
  if (mode !== "UPFRONT") return { amount, subtotal, gstAmount: total - subtotal, total };
  // The upfront reduction is a discount, not an unpaid final installment.
  const discountedSubtotal = Math.round(subtotal * 0.95);
  return {
    amount,
    subtotal: discountedSubtotal,
    gstAmount: amount - discountedSubtotal,
    total: amount,
  };
}

/**
 * Why an invoice row cannot be true, or null when it is consistent.
 *
 * Shared by the GSTR-1 export (which must refuse to file such a row) and the
 * invoice serializer (so the admin panel can flag it instead of presenting
 * it as an ordinary bill).
 *
 * Production carries invoices written before money was unified on paise:
 * quotes were stored in rupees and their total was copied straight into the
 * paise `grand_total` column, so a ₹44,500 order became an "invoice" for
 * ₹445. When the client actually paid, the captured Payment is in real paise
 * and is therefore ~100× the invoice — the overpayment check below is what
 * surfaces those rows.
 *
 * `captured` is the sum of CAPTURED payments in paise, or null when the caller
 * did not load payments (the evidence checks are then skipped, never guessed).
 */
export function invoiceIntegrityIssue(
  inv: {
    status: string;
    subtotal: number | bigint | null;
    cgst: number | bigint | null;
    sgst: number | bigint | null;
    igst: number | bigint | null;
    grandTotal: number | bigint | null;
    amountPaid?: number | bigint | null;
  },
  captured: number | null,
): string | null {
  const status = String(inv.status ?? "").toUpperCase();
  if (status === "DRAFT" || status === "CANCELLED") return null;

  const subtotal = Number(inv.subtotal ?? 0);
  const grand = Number(inv.grandTotal ?? 0);
  const tax = Number(inv.cgst ?? 0) + Number(inv.sgst ?? 0) + Number(inv.igst ?? 0);

  if (grand <= 0) return "grandTotal is zero or negative";

  // Money is integer paise, so a real invoice cannot total under ₹1.
  if (grand < 100) return `grandTotal ${grand} is under ₹1 — not a real amount`;

  // The components must add up, or the return misstates taxable value.
  if (subtotal + tax !== grand) {
    return `subtotal ${subtotal} + tax ${tax} ≠ grandTotal ${grand}`;
  }

  if (captured === null) return null;

  // More money captured than the invoice is for: the signature of a legacy
  // invoice whose total was written in rupees into a paise column.
  if (captured > grand) {
    return `captured ${captured} paise exceeds grandTotal ${grand} — likely a legacy rupee amount stored as paise`;
  }

  // PAID with nothing collected is the signature of the non-transactional
  // settlement bug.
  if (status === "PAID" && (Number(inv.amountPaid ?? 0) < grand || captured < grand)) {
    return "marked PAID without matching captured-payment evidence";
  }

  return null;
}

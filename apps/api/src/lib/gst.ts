import { GST_STATES } from "./gstInvoice";

/**
 * Place-of-supply resolution for StackFox-issued invoices.
 *
 * `checkout.ts` and the `milestone-invoice` docGen path both used to hardcode
 * `gstType: "IGST"` — so an intra-State client (same State as StackFox) was
 * billed inter-State IGST instead of CGST+SGST. The tax *total* is the same
 * either way, but the split and the GSTR-1 section are wrong.
 */

/** StackFox's home State. CGST+SGST applies only to supplies within it. */
const SUPPLIER_STATE_CODE = (process.env.SUPPLIER_STATE_CODE ?? "08").trim(); // 08 = Rajasthan

/** name (lowercased) -> GST State code, derived from the canonical code->name map. */
const CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(GST_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

type OrgLike = { billingAddress?: unknown; gstin?: string | null } | null | undefined;

/**
 * The recipient's GST State code, or null when it can't be determined.
 *
 * A GSTIN is authoritative — its first two digits *are* the State code. Falls
 * back to `billingAddress.stateCode` (two digits) or `billingAddress.state`
 * (a State name).
 */
export function recipientStateCode(org: OrgLike): string | null {
  const gstin = String(org?.gstin ?? "").trim();
  if (/^\d{2}/.test(gstin)) return gstin.slice(0, 2);

  const addr = (org?.billingAddress ?? {}) as Record<string, unknown>;
  const code = String(addr.stateCode ?? addr.state_code ?? "").trim();
  if (/^\d{2}$/.test(code)) return code;

  const name = String(addr.state ?? "").trim().toLowerCase();
  if (name) {
    if (CODE_BY_NAME[name]) return CODE_BY_NAME[name];
    const hit = Object.keys(CODE_BY_NAME).find((n) => name.startsWith(n) || n.startsWith(name));
    if (hit) return CODE_BY_NAME[hit];
  }
  return null;
}

/**
 * `CGST_SGST` when the recipient is in StackFox's State, `IGST` otherwise.
 *
 * Unknown recipient State -> IGST: an inter-State label on an intra-State supply
 * is a filing nuisance, whereas claiming an intra-State supply we can't prove is
 * the worse error.
 */
export function resolveGstType(org: OrgLike): "CGST_SGST" | "IGST" {
  const state = recipientStateCode(org);
  return state && state === SUPPLIER_STATE_CODE ? "CGST_SGST" : "IGST";
}

/** Splits a tax total (paise) into the three components for a given `gstType`. */
export function splitGst(taxTotal: number, gstType: "CGST_SGST" | "IGST") {
  const t = Math.max(0, Math.round(taxTotal));
  if (gstType === "CGST_SGST") {
    const cgst = Math.round(t / 2);
    return { cgst, sgst: t - cgst, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: t };
}

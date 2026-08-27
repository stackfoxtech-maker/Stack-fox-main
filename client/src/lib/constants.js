/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL CONSTANTS
   ───────────────────────────────────────────────────────────────────────────── */

export const CURRENCIES = [
  { code: "INR", symbol: "₹", rate: 1, locale: "en-IN", tax: 18, taxName: "GST" },
  { code: "USD", symbol: "$", rate: 0.012, locale: "en-US", tax: 0, taxName: "Tax" },
  { code: "EUR", symbol: "€", rate: 0.011, locale: "de-DE", tax: 0, taxName: "Tax" },
  { code: "GBP", symbol: "£", rate: 0.0095, locale: "en-GB", tax: 20, taxName: "VAT" },
  { code: "AED", symbol: "AED", rate: 0.044, locale: "ar-AE", tax: 5, taxName: "VAT" },
];

export const FBT_PAIRS = {
  "e1": ["ad2", "u1", "o1"], "e4": ["ad2", "u1"], "w1": ["o1", "ad3", "co5"], "w6": ["ad2", "u3"],
  "m1": ["b1", "b3", "ad2"], "b1": ["b3", "b4"], "b3": ["b4", "u7"],
  "a1": ["a3", "u1"], "a3": ["u1", "u3"], "u1": ["u3", "ad3"],
  "co5": ["w1", "ad3"], "co9": ["ad2", "e4"], "co44": ["w1", "m1"], "co41": ["b1", "b3"],
  "s1": ["s3", "co21"], "s3": ["s1", "u7"],
};

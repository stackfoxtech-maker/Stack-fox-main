/**
 * GST tax-invoice model for the checkout flow.
 *
 * Tax logic (place-of-supply → CGST+SGST vs IGST, per-line discount, round-off,
 * SAC-wise breakup, Indian amount-in-words) mirrors the server engine in
 * apps/api/src/lib/gstInvoice.ts so the on-screen preview, the client PDF and
 * an eventual server-rendered PDF all agree.
 */

// ── Supplier (Artwall Labs Pvt Ltd — StackFox is its technology arm) ─────────
export const SUPPLIER = {
  legalName: 'ARTWALL LABS PRIVATE LIMITED',
  tradeName: 'StackFox — by Artwall Labs',
  type: 'PRIVATE LIMITED',
  cin: 'U62099RJ2026PTC112452',
  gstin: '08ABFCA1595D1ZR',
  pan: 'ABFCA1595D',
  stateName: 'Rajasthan',
  stateCode: '08',
  addressLines: ['A-57, Chhatrasal Nagar, Malviya Nagar', 'Jaipur, Rajasthan — 302017'],
  phone: '+91 82093 95894',
  email: 'artwalllabs@gmail.com',
  website: 'www.artwalllabs.com',
  signatory: { name: 'Kailashpati Choudhary', title: 'CEO & Authorised Signatory' },
  place: 'Jaipur',
};

export const BANK = {
  beneficiary: 'ARTWALL LABS PRIVATE LIMITED',
  bank: 'State Bank of India',
  branch: 'Malviya Nagar, Jaipur',
  pan: 'ABFCA1595D',
};

export const DEFAULT_SAC = { code: '998314', desc: 'IT Software Dev' };

// ── Money ──────────────────────────────────────────────────────────────────
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "₹2,50,000.00" — Indian grouping, always 2 decimals (invoice convention). */
export const inr2 = (n) =>
  '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// ── Amount in words (Indian: lakh / crore) ─────────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function words(x) {
  if (x < 20) return ONES[x];
  if (x < 100) return TENS[Math.floor(x / 10)] + (x % 10 ? ' ' + ONES[x % 10] : '');
  if (x < 1000) return ONES[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + words(x % 100) : '');
  if (x < 100000) return words(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + words(x % 1000) : '');
  if (x < 10000000) return words(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + words(x % 100000) : '');
  return words(Math.floor(x / 10000000)) + ' Crore' + (x % 10000000 ? ' ' + words(x % 10000000) : '');
}

export function amountInWords(n) {
  if (!n || n <= 0) return 'Zero Rupees Only';
  const whole = Math.floor(n);
  const paise = Math.round((n - whole) * 100);
  let r = words(whole) + ' Rupees';
  if (paise > 0) r += ' and ' + words(paise) + ' Paise';
  return r + ' Only';
}

// ── Invoice numbering ─────────────────────────────────────────────────────
function fyLabel(d = new Date()) {
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1; // Indian FY starts in April
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function nextInvoiceNumber(seed) {
  const n = String((seed ?? Date.now()) % 1000).padStart(3, '0');
  return `AWL/INV/${fyLabel()}/${n}`;
}

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Build a fully computed invoice from cart/quote items + the buyer's details.
 *
 *   items:  [{ name, price, quantity, sacCode?, sacDesc?, unit? }]
 *   client: { name, email, phone, orgName, gstin, stateCode?, address? }
 *   opts:   { invoiceNo?, date?, dueDate?, gstRate?, discountPct?, notes? }
 */
export function buildInvoice(items = [], client = {}, opts = {}) {
  const gstRate = opts.gstRate ?? 18;
  const discountPct = Math.max(0, Math.min(100, opts.discountPct ?? 0));

  // Place of supply: explicit state code → GSTIN prefix → supplier's (intra).
  const gstinState = /^\d{2}/.test(client.gstin || '') ? client.gstin.slice(0, 2) : '';
  const buyerState = (client.stateCode || '').trim() || gstinState || SUPPLIER.stateCode;
  const isInterState = buyerState !== SUPPLIER.stateCode;

  const lines = items
    .filter((it) => (it.name || '').trim() && (it.price ?? 0) >= 0)
    .map((it) => {
      const qty = Number(it.quantity ?? 1) || 1;
      const rate = round2(Number(it.price) || 0);
      const gross = round2(qty * rate);
      const disc = round2((gross * discountPct) / 100);
      return {
        name: it.name.trim(),
        sacCode: it.sacCode || DEFAULT_SAC.code,
        sacDesc: it.sacDesc || DEFAULT_SAC.desc,
        qty,
        unit: it.unit || 'Nos',
        rate,
        discount: disc,
        amount: round2(gross - disc),
      };
    });

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const cgst = isInterState ? 0 : round2((subtotal * gstRate) / 200);
  const sgst = isInterState ? 0 : round2((subtotal * gstRate) / 200);
  const igst = isInterState ? round2((subtotal * gstRate) / 100) : 0;
  const taxTotal = round2(cgst + sgst + igst);
  const grandTotal = round2(subtotal + taxTotal);
  const payable = Math.round(grandTotal);
  const roundOff = round2(payable - grandTotal);

  // SAC-wise breakup
  const bySac = new Map();
  for (const l of lines) {
    const g = bySac.get(l.sacCode) || { sacCode: l.sacCode, sacDesc: l.sacDesc, taxable: 0 };
    g.taxable = round2(g.taxable + l.amount);
    bySac.set(l.sacCode, g);
  }
  const sacBreakup = [...bySac.values()].map((g) => {
    const c = isInterState ? 0 : round2((g.taxable * gstRate) / 200);
    const s = isInterState ? 0 : round2((g.taxable * gstRate) / 200);
    const i = isInterState ? round2((g.taxable * gstRate) / 100) : 0;
    return { ...g, cgst: c, sgst: s, igst: i, tax: round2(c + s + i) };
  });

  const date = opts.date ? new Date(opts.date) : new Date();
  const dueDate = opts.dueDate
    ? new Date(opts.dueDate)
    : new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    supplier: SUPPLIER,
    bank: BANK,
    invoiceNo: opts.invoiceNo || nextInvoiceNumber(),
    date: fmtDate(date),
    dueDate: fmtDate(dueDate),
    place: SUPPLIER.place,
    supplyLabel: isInterState ? 'IGST' : 'CGST+SGST',
    isInterState,
    gstRate,
    halfRate: gstRate / 2,
    recipient: {
      name: client.orgName || client.name || '[Client]',
      contact: client.name && client.orgName ? client.name : '',
      email: client.email || '',
      phone: client.phone || '',
      gstin: client.gstin || '',
      address: client.address || '',
      stateName: isInterState ? (client.stateName || '') : SUPPLIER.stateName,
      stateCode: buyerState,
    },
    lines,
    subtotal,
    cgst,
    sgst,
    igst,
    taxTotal,
    grandTotal,
    roundOff,
    payable,
    amountInWords: amountInWords(payable),
    sacBreakup,
    notes: opts.notes || 'Thank you for your business.',
  };
}

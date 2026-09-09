import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/**
 * The real StackFox tax invoice — the Artwall Labs letterhead document.
 *
 * This is deliberately separate from `lib/gstInvoice.ts`. That engine backs the
 * free public Invoice Generator at /tools/invoice, whose PDF is headed
 * "StackFox — Invoice Generator" and is issued on behalf of whoever fills the
 * form. This one is issued BY Artwall Labs Private Limited and carries its CIN,
 * GSTIN, bank details and authorised signatory, so the two must not share a
 * renderer: a change made for the public tool must never restyle a statutory
 * document we issue.
 *
 * The layout mirrors `client/src/lib/invoice.js` + the checkout PDF export,
 * which is what the client already sees at checkout. Until now that document
 * existed only in the browser — it was rendered, shown, and lost. Everything
 * below reproduces it server-side so the same invoice can be stored and served
 * from the client panel.
 */

// ── Supplier of record ──────────────────────────────────────────────────────
// Mirrors SUPPLIER/BANK in client/src/lib/invoice.js. Kept as literals rather
// than env vars: these are statutory identifiers printed on a tax invoice, and
// a missing env var must not silently produce an invoice with a blank GSTIN.
export const SUPPLIER = {
  legalName: "ARTWALL LABS PRIVATE LIMITED",
  tradeName: "StackFox - by Artwall Labs",
  cin: "U62099RJ2026PTC112452",
  gstin: "08ABFCA1595D1ZR",
  pan: "ABFCA1595D",
  stateName: "Rajasthan",
  stateCode: "08",
  addressLines: ["A-57, Chhatrasal Nagar, Malviya Nagar", "Jaipur, Rajasthan  302017"],
  phone: "+91 82093 95894",
  email: "artwalllabs@gmail.com",
  website: "www.artwalllabs.com",
  signatory: { name: "Kailashpati Choudhary", title: "CEO & Authorised Signatory" },
  place: "Jaipur",
} as const;

export const BANK = {
  beneficiary: "ARTWALL LABS PRIVATE LIMITED",
  bank: "State Bank of India",
  branch: "Malviya Nagar, Jaipur",
  pan: "ABFCA1595D",
} as const;

const TERMS = [
  "1. Payment due within 30 days. Interest @ 18% p.a. (MSMED Act, Sec. 16). 2. GST per CGST/SGST Act 2017. SAC/HSN per GST Tariff.",
  "3. Rule 46 CGST Rules 2017; valid for ITC u/s 16(2)(a). 4. Reverse Charge: N/A. 5. TDS u/s 194J/194C where applicable.",
  "6. Form 16A within 15 days of quarter-end. 7. Retained-amount payment on IP transfer. 8. Disputes: Jaipur jurisdiction. 9. E&OE.",
];

// ── Money and words ─────────────────────────────────────────────────────────
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Indian digit grouping, always two decimals. No rupee glyph: Helvetica is WinAnsi. */
export function inr2(n: number): string {
  const [whole, frac] = Math.abs(n).toFixed(2).split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${n < 0 ? "-" : ""}${grouped}.${frac}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function words(x: number): string {
  if (x < 20) return ONES[x];
  if (x < 100) return TENS[Math.floor(x / 10)] + (x % 10 ? " " + ONES[x % 10] : "");
  if (x < 1000) return ONES[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + words(x % 100) : "");
  if (x < 100000) return words(Math.floor(x / 1000)) + " Thousand" + (x % 1000 ? " " + words(x % 1000) : "");
  if (x < 10000000) return words(Math.floor(x / 100000)) + " Lakh" + (x % 100000 ? " " + words(x % 100000) : "");
  return words(Math.floor(x / 10000000)) + " Crore" + (x % 10000000 ? " " + words(x % 10000000) : "");
}

export function amountInWords(n: number): string {
  if (!n || n <= 0) return "Zero Rupees Only";
  const whole = Math.floor(n);
  const paise = Math.round((n - whole) * 100);
  let r = `${words(whole)} Rupees`;
  if (paise > 0) r += ` and ${words(paise)} Paise`;
  return `${r} Only`;
}

/** Indian financial year label for a date — FY starts in April. */
export function fyLabel(d = new Date()): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/**
 * `AWL/INV/2026-27/914` — the number printed on the document, distinct from the
 * `INV-YYYY-MM-NNNN` primary key. Statutory numbering must be FY-scoped and
 * gapless-looking; the primary key is an internal handle and is not.
 */
export function awlInvoiceNumber(seq: number, date = new Date()): string {
  const n = Math.abs(Math.trunc(seq)) % 1000;
  return `AWL/INV/${fyLabel(date)}/${String(n).padStart(3, "0")}`;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// ── Model ───────────────────────────────────────────────────────────────────
export interface CompanyInvoiceLine {
  name: string;
  sacCode: string;
  sacDesc: string;
  qty: number;
  unit: string;
  rate: number;      // rupees
  discount: number;  // rupees
  amount: number;    // rupees, after discount
}

export interface CompanyInvoiceModel {
  invoiceNo: string;
  date: Date;
  dueDate: Date | null;
  isInterState: boolean;
  gstRate: number;
  recipient: {
    name: string;
    contact?: string;
    email?: string;
    phone?: string;
    gstin?: string;
    address?: string;
    stateName?: string;
    stateCode?: string;
  };
  lines: CompanyInvoiceLine[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  payable: number;
  /** Set once any payment is received; drives the PAID stamp and the balance row. */
  amountPaid?: number;
  status?: string;
  notes?: string;
}

// ── Rendering ───────────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.45, 0.45, 0.5);
const RULE = rgb(0.8, 0.8, 0.84);
const BRAND = rgb(1, 0.3, 0);
const PAID = rgb(0.06, 0.5, 0.3);

/** Helvetica is WinAnsi-only; map what real data throws at us and drop the rest. */
function ansi(s: string): string {
  return String(s ?? "")
    .replace(/₹/g, "Rs.")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e¡-ÿ]/g, "?");
}

export async function renderCompanyInvoicePdf(inv: CompanyInvoiceModel): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Tax Invoice ${inv.invoiceNo}`);
  doc.setProducer("StackFox");
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const RIGHT = PAGE_W - MARGIN;

  const text = (
    s: string,
    x: number,
    size = 8.5,
    o: { bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center" } = {},
  ) => {
    const f: PDFFont = o.bold ? bold : font;
    const t = ansi(s);
    let dx = x;
    if (o.align === "right") dx = x - f.widthOfTextAtSize(t, size);
    else if (o.align === "center") dx = x - f.widthOfTextAtSize(t, size) / 2;
    page.drawText(t, { x: dx, y, size, font: f, color: o.color ?? INK });
  };
  const rule = (color = RULE, thickness = 0.7) =>
    page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness, color });
  const gap = (h: number) => { y -= h; };
  const ensure = (space: number) => {
    if (y - space < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // ── Letterhead ────────────────────────────────────────────────────────────
  text(SUPPLIER.legalName, MARGIN, 13, { bold: true });
  text("ORIGINAL FOR RECIPIENT", RIGHT, 7.5, { align: "right", color: MUTED });
  gap(12);
  text(SUPPLIER.tradeName, MARGIN, 8.5, { color: BRAND });
  text("TAX INVOICE", RIGHT, 13, { align: "right", bold: true });
  gap(11);
  text(`CIN: ${SUPPLIER.cin}`, MARGIN, 7.5, { color: MUTED });
  text("Reverse Charge: N/A", RIGHT, 7.5, { align: "right", color: MUTED });
  gap(9);
  text(`GSTIN: ${SUPPLIER.gstin}   PAN: ${SUPPLIER.pan}`, MARGIN, 7.5, { color: MUTED });
  text("Sec. 31 CGST  |  Rule 46", RIGHT, 7.5, { align: "right", color: MUTED });
  gap(9);
  text(`State: ${SUPPLIER.stateName} (${SUPPLIER.stateCode})`, MARGIN, 7.5, { color: MUTED });
  gap(10);
  rule(INK, 1.1);
  gap(14);

  // ── Supplier / Recipient / Particulars ────────────────────────────────────
  const colW = (RIGHT - MARGIN) / 3;
  const colX = [MARGIN, MARGIN + colW, MARGIN + colW * 2];
  const top = y;
  let colBottom = y;

  const column = (i: number, heading: string, rows: string[]) => {
    y = top;
    const x = colX[i];
    page.drawText(ansi(heading), { x, y, size: 7, font: bold, color: MUTED });
    y -= 11;
    for (const r of rows) {
      if (!r) continue;
      page.drawText(ansi(r), { x, y, size: 8, font, color: INK });
      y -= 9.5;
    }
    colBottom = Math.min(colBottom, y);
  };

  column(0, "SUPPLIER", [
    SUPPLIER.legalName,
    SUPPLIER.tradeName,
    ...SUPPLIER.addressLines,
    `Ph: ${SUPPLIER.phone}`,
    SUPPLIER.email,
    SUPPLIER.website,
  ]);

  const r = inv.recipient;
  column(1, "RECIPIENT", [
    r.name,
    r.contact ?? "",
    r.email ?? "",
    r.phone ?? "",
    r.address ?? "",
    r.gstin ? `GSTIN: ${r.gstin}` : "",
    r.stateName ? `State: ${r.stateName}${r.stateCode ? ` (${r.stateCode})` : ""}` : "",
  ]);

  column(2, "PARTICULARS", [
    `Invoice No.   ${inv.invoiceNo}`,
    `Date          ${fmtDate(inv.date)}`,
    inv.dueDate ? `Due           ${fmtDate(inv.dueDate)}` : "",
    `Place         ${SUPPLIER.place} (${SUPPLIER.stateCode})`,
    `Supply        ${inv.isInterState ? "IGST" : "CGST+SGST"}`,
    inv.status ? `Status        ${inv.status}` : "",
  ]);

  y = colBottom - 6;
  rule();
  gap(14);

  // ── Line items ────────────────────────────────────────────────────────────
  // Column right-edges, so amounts right-align into a clean money column.
  const cx = {
    sno: MARGIN,
    desc: MARGIN + 22,
    sac: MARGIN + 250,
    qty: MARGIN + 310,
    unit: MARGIN + 350,
    rate: MARGIN + 440,
    disc: MARGIN + 480,
    amount: RIGHT,
  };

  text("S.NO", cx.sno, 7, { bold: true, color: MUTED });
  text("DESCRIPTION", cx.desc, 7, { bold: true, color: MUTED });
  text("SAC", cx.sac, 7, { bold: true, color: MUTED });
  text("QTY", cx.qty, 7, { bold: true, color: MUTED, align: "right" });
  text("UNIT", cx.unit, 7, { bold: true, color: MUTED, align: "right" });
  text("RATE", cx.rate, 7, { bold: true, color: MUTED, align: "right" });
  text("DISC", cx.disc, 7, { bold: true, color: MUTED, align: "right" });
  text("AMOUNT", cx.amount, 7, { bold: true, color: MUTED, align: "right" });
  gap(5);
  rule();
  gap(12);

  inv.lines.forEach((l, i) => {
    ensure(30);
    text(String(i + 1), cx.sno, 8);
    text(l.name.slice(0, 44), cx.desc, 8);
    text(l.sacCode, cx.sac, 8);
    text(String(l.qty), cx.qty, 8, { align: "right" });
    text(l.unit, cx.unit, 8, { align: "right" });
    text(inr2(l.rate), cx.rate, 8, { align: "right" });
    text(l.discount ? inr2(l.discount) : "", cx.disc, 8, { align: "right" });
    text(inr2(l.amount), cx.amount, 8, { align: "right" });
    gap(9.5);
    text(l.sacDesc, cx.desc, 7, { color: MUTED });
    gap(12);
  });

  rule();
  gap(13);

  // ── Totals ────────────────────────────────────────────────────────────────
  const half = inv.gstRate / 2;
  const totalRow = (label: string, value: string, o: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    ensure(16);
    text(label, cx.rate, o.size ?? 8.5, { align: "right", bold: o.bold, color: o.color });
    text(value, cx.amount, o.size ?? 8.5, { align: "right", bold: o.bold, color: o.color });
    gap(o.bold ? 14 : 12);
  };

  totalRow("Subtotal", `Rs. ${inr2(inv.subtotal)}`);
  if (inv.isInterState) {
    totalRow(`IGST @ ${inv.gstRate}%`, `Rs. ${inr2(inv.igst)}`);
  } else {
    totalRow(`CGST @ ${half}%`, `Rs. ${inr2(inv.cgst)}`);
    totalRow(`SGST @ ${half}%`, `Rs. ${inr2(inv.sgst)}`);
  }
  gap(2);
  totalRow("TOTAL PAYABLE", `Rs. ${inr2(inv.payable)}`, { bold: true, size: 10 });

  const paid = Math.max(0, inv.amountPaid ?? 0);
  if (paid > 0) {
    totalRow("Amount received", `Rs. ${inr2(paid)}`, { color: PAID });
    totalRow("Balance due", `Rs. ${inr2(Math.max(0, round2(inv.payable - paid)))}`, { bold: true });
  }

  gap(4);
  text("Amount in Words:", MARGIN, 8, { bold: true });
  gap(10);
  text(amountInWords(inv.payable), MARGIN, 8, { color: MUTED });
  gap(16);

  // ── SAC-wise tax breakup ──────────────────────────────────────────────────
  ensure(70);
  text("TAX BREAKUP BY SAC", MARGIN, 7, { bold: true, color: MUTED });
  gap(11);
  const bx = { sac: MARGIN, desc: MARGIN + 60, taxable: MARGIN + 300, t1: MARGIN + 390, t2: MARGIN + 470, tax: RIGHT };
  text("SAC", bx.sac, 7, { color: MUTED });
  text("Desc", bx.desc, 7, { color: MUTED });
  text("Taxable", bx.taxable, 7, { color: MUTED, align: "right" });
  text(inv.isInterState ? `IGST@${inv.gstRate}%` : `CGST@${half}%`, bx.t1, 7, { color: MUTED, align: "right" });
  if (!inv.isInterState) text(`SGST@${half}%`, bx.t2, 7, { color: MUTED, align: "right" });
  text("Tax", bx.tax, 7, { color: MUTED, align: "right" });
  gap(4);
  rule();
  gap(11);

  const bySac = new Map<string, { desc: string; taxable: number }>();
  for (const l of inv.lines) {
    const g = bySac.get(l.sacCode) ?? { desc: l.sacDesc, taxable: 0 };
    g.taxable = round2(g.taxable + l.amount);
    bySac.set(l.sacCode, g);
  }
  for (const [sac, g] of bySac) {
    ensure(20);
    const c = inv.isInterState ? 0 : round2((g.taxable * inv.gstRate) / 200);
    const i = inv.isInterState ? round2((g.taxable * inv.gstRate) / 100) : 0;
    text(sac, bx.sac, 8);
    text(g.desc.slice(0, 38), bx.desc, 8);
    text(inr2(g.taxable), bx.taxable, 8, { align: "right" });
    text(inr2(inv.isInterState ? i : c), bx.t1, 8, { align: "right" });
    if (!inv.isInterState) text(inr2(c), bx.t2, 8, { align: "right" });
    text(inr2(inv.isInterState ? i : round2(c * 2)), bx.tax, 8, { align: "right" });
    gap(12);
  }

  gap(6);
  rule();
  gap(14);

  // ── Bank, signature ───────────────────────────────────────────────────────
  ensure(90);
  const blockTop = y;
  text("BANK DETAILS", MARGIN, 7, { bold: true, color: MUTED });
  gap(11);
  for (const line of [
    `Beneficiary: ${BANK.beneficiary}`,
    `Bank: ${BANK.bank}`,
    `Branch: ${BANK.branch}`,
    `PAN: ${BANK.pan}`,
  ]) {
    text(line, MARGIN, 8);
    gap(9.5);
  }
  const bankBottom = y;

  y = blockTop;
  text(`FOR ${SUPPLIER.legalName}`, RIGHT, 7, { bold: true, color: MUTED, align: "right" });
  gap(13);
  text("DIGITALLY SIGNED", RIGHT, 8, { align: "right", color: BRAND, bold: true });
  gap(12);
  text(SUPPLIER.signatory.name, RIGHT, 8.5, { align: "right", bold: true });
  gap(10);
  text(SUPPLIER.signatory.title, RIGHT, 7.5, { align: "right", color: MUTED });
  gap(10);
  text(`Date: ${fmtDate(inv.date)}   Place: ${SUPPLIER.place}`, RIGHT, 7.5, { align: "right", color: MUTED });
  gap(9);
  text("Digitally signed - IT Act 2000, Sec. 5", RIGHT, 7, { align: "right", color: MUTED });

  y = Math.min(bankBottom, y) - 12;

  // ── Notes and terms ───────────────────────────────────────────────────────
  ensure(60);
  text(`Notes: ${inv.notes ?? "Thank you for your business."}`, MARGIN, 7.5, { color: MUTED });
  gap(14);
  text("TERMS & CONDITIONS", MARGIN, 7, { bold: true, color: MUTED });
  gap(10);
  for (const t of TERMS) {
    text(t, MARGIN, 6.5, { color: MUTED });
    gap(8);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  y = MARGIN + 18;
  rule();
  gap(10);
  text(
    `${SUPPLIER.legalName}  |  ${SUPPLIER.tradeName}  |  CIN: ${SUPPLIER.cin}  |  GSTIN: ${SUPPLIER.gstin}  |  PAN: ${SUPPLIER.pan}`,
    MARGIN,
    6.5,
    { color: MUTED },
  );
  gap(8);
  text(
    `${SUPPLIER.addressLines.join(", ")}  -  ${SUPPLIER.phone}  -  ${SUPPLIER.email}  -  ${SUPPLIER.website}`,
    MARGIN,
    6.5,
    { color: MUTED },
  );

  return Buffer.from(await doc.save());
}

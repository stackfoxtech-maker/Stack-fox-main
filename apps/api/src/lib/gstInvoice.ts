import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/**
 * GST invoice engine for the free Invoice Generator tool.
 *
 * Ports the tax logic from the Artwall Labs invoice platform: four document
 * types (tax / proforma / credit note / debit note), six supply-type modes
 * (intra-state CGST+SGST, inter-state IGST, export & SEZ with/without IGST),
 * per-line discounts, round-off, SAC-wise tax breakup, and Indian-format
 * amount-in-words. `renderGstInvoicePdf` draws a single-page A4 GST layout with
 * pdf-lib (no headless browser).
 */

export type InvoiceType = "tax" | "proforma" | "credit" | "debit";
export type SupplyType =
  | "intra"
  | "inter"
  | "export_with"
  | "export_without"
  | "sez_with"
  | "sez_without";

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  tax: "TAX INVOICE",
  proforma: "PROFORMA INVOICE",
  credit: "CREDIT NOTE",
  debit: "DEBIT NOTE",
};

const INVOICE_TYPE_PREFIX: Record<InvoiceType, string> = {
  tax: "INV",
  proforma: "PI",
  credit: "CN",
  debit: "DN",
};

/** Subset of the GST state codes — enough for place-of-supply display. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
  "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh",
  "23": "Madhya Pradesh", "24": "Gujarat", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh",
};

export const SAC_CODES: { code: string; desc: string }[] = [
  { code: "998314", desc: "IT Software Development" },
  { code: "998313", desc: "IT Infrastructure & Network" },
  { code: "998315", desc: "Hosting & IT Services" },
  { code: "998316", desc: "IT Consulting" },
  { code: "998319", desc: "Other IT Services" },
  { code: "998361", desc: "Web Design & Development" },
  { code: "998362", desc: "UI/UX Design" },
  { code: "998364", desc: "AI/ML Platform Services" },
  { code: "998365", desc: "Data Analytics" },
  { code: "998399", desc: "Professional Technical Services" },
  { code: "999210", desc: "Digital Marketing" },
];

const VALID_GST_RATES = [0, 5, 12, 18, 28];

export interface GstLineInput {
  description?: string;
  desc?: string;
  sacCode?: string;
  qty?: number;
  unit?: string;
  rate?: number;
  amount?: number; // legacy tool payload: line total when no explicit rate
  discount?: number;
  discountType?: "%" | "flat";
}

export interface GstParty {
  name?: string;
  gstin?: string;
  pan?: string;
  stateCode?: string;
  address?: string;
  city?: string;
  email?: string;
  phone?: string;
}

export interface GstInvoiceInput {
  invoiceType?: InvoiceType;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  gstRate?: number;
  supplyType?: SupplyType;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  poRef?: string;
  ewayBill?: string;
  lutRef?: string;
  origInvoiceNo?: string;
  origInvoiceDate?: string;
  reason?: string;
  from?: GstParty;
  to?: GstParty;
  lineItems?: GstLineInput[];
  bank?: {
    name?: string;
    branch?: string;
    account?: string;
    ifsc?: string;
    upi?: string;
    swift?: string;
  };
  notes?: string;
}

export interface ComputedLine {
  description: string;
  sacCode: string;
  sacDesc: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number;
  discountType: "%" | "flat";
  amount: number; // rupees, after discount
}

export interface SacBreakupRow {
  sacCode: string;
  sacDesc: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
}

export interface ComputedInvoice {
  invoiceType: InvoiceType;
  invoiceTypeLabel: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  gstRate: number;
  effectiveGstRate: number;
  supplyType: SupplyType;
  supplyLabel: string;
  placeOfSupply: string;
  placeOfSupplyName: string;
  reverseCharge: boolean;
  poRef: string | null;
  ewayBill: string | null;
  lutRef: string | null;
  origInvoiceNo: string | null;
  origInvoiceDate: string | null;
  reason: string | null;
  from: GstParty;
  to: GstParty;
  lines: ComputedLine[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  grandTotal: number;
  roundOff: number;
  payable: number;
  amountInWords: string;
  sacBreakup: SacBreakupRow[];
  bank: GstInvoiceInput["bank"];
  notes: string | null;
  isInterState: boolean;
  isZeroRated: boolean;
  warnings: string[];
  generatedAt: string;
}

const SUPPLY_LABEL: Record<SupplyType, string> = {
  intra: "Intra-State (CGST + SGST)",
  inter: "Inter-State (IGST)",
  export_with: "Export with payment of IGST",
  export_without: "Export under Bond/LUT (zero-rated)",
  sez_with: "SEZ supply with payment of IGST",
  sez_without: "SEZ supply under Bond/LUT (zero-rated)",
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function cv(x: number): string {
  const o = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const t = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (x < 20) return o[x];
  if (x < 100) return t[Math.floor(x / 10)] + (x % 10 ? " " + o[x % 10] : "");
  if (x < 1000) return o[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " and " + cv(x % 100) : "");
  if (x < 100000) return cv(Math.floor(x / 1000)) + " Thousand" + (x % 1000 ? " " + cv(x % 1000) : "");
  if (x < 10000000) return cv(Math.floor(x / 100000)) + " Lakh" + (x % 100000 ? " " + cv(x % 100000) : "");
  return cv(Math.floor(x / 10000000)) + " Crore" + (x % 10000000 ? " " + cv(x % 10000000) : "");
}

/** 1234.5 -> "One Thousand Two Hundred and Thirty Four Rupees and Fifty Paise Only" */
export function amountInWords(n: number): string {
  if (!n || n <= 0) return "Zero Rupees Only";
  const whole = Math.floor(n);
  const paise = Math.round((n - whole) * 100);
  let r = cv(whole) + " Rupees";
  if (paise > 0) r += " and " + cv(paise) + " Paise";
  return r + " Only";
}

function lineTotal(l: GstLineInput): number {
  const qty = Number(l.qty ?? 1) || 0;
  const rate = l.rate != null ? Number(l.rate) || 0 : null;
  const gross = rate != null ? qty * rate : Number(l.amount ?? 0) || 0;
  const disc = Number(l.discount ?? 0) || 0;
  const off = l.discountType === "%" ? (gross * disc) / 100 : disc;
  return Math.max(0, round2(gross - off));
}

/** Auto-detect the supply type from the two state codes when not supplied. */
function inferSupplyType(input: GstInvoiceInput): SupplyType {
  if (input.supplyType) return input.supplyType;
  const from = input.from?.stateCode;
  const to = input.to?.stateCode || input.placeOfSupply;
  if (from && to && from !== to) return "inter";
  return "intra";
}

export function computeInvoice(input: GstInvoiceInput): ComputedInvoice {
  const warnings: string[] = [];

  const invoiceType: InvoiceType = ["tax", "proforma", "credit", "debit"].includes(
    input.invoiceType as string,
  )
    ? (input.invoiceType as InvoiceType)
    : "tax";

  let gstRate = Number(input.gstRate ?? 18);
  if (!VALID_GST_RATES.includes(gstRate)) {
    warnings.push(`Unusual GST rate ${gstRate}% — expected one of ${VALID_GST_RATES.join(", ")}.`);
  }

  const supplyType = inferSupplyType(input);
  const isIntra = supplyType === "intra";
  const isZeroRated = supplyType.endsWith("without");
  const isIGST = ["inter", "export_with", "sez_with"].includes(supplyType);
  const effectiveGstRate = isZeroRated ? 0 : gstRate;

  const rawLines = Array.isArray(input.lineItems) ? input.lineItems : [];
  const lines: ComputedLine[] = rawLines
    .map((l): ComputedLine => {
      const sacCode = (l.sacCode || "998314").trim();
      const sacDesc = SAC_CODES.find((s) => s.code === sacCode)?.desc || "Professional Services";
      const qty = Number(l.qty ?? 1) || 0;
      const rate =
        l.rate != null ? Number(l.rate) || 0 : qty ? round2((Number(l.amount ?? 0) || 0) / qty) : 0;
      return {
        description: (l.description ?? l.desc ?? "").trim(),
        sacCode,
        sacDesc,
        qty,
        unit: l.unit || "Nos",
        rate,
        discount: Number(l.discount ?? 0) || 0,
        discountType: l.discountType === "%" ? "%" : "flat",
        amount: lineTotal(l),
      };
    })
    .filter((l) => l.description || l.amount > 0);

  if (lines.length === 0) warnings.push("Invoice has no line items.");

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const cgst = isIntra ? round2((subtotal * effectiveGstRate) / 200) : 0;
  const sgst = isIntra ? round2((subtotal * effectiveGstRate) / 200) : 0;
  const igst = isIGST ? round2((subtotal * effectiveGstRate) / 100) : 0;
  const taxTotal = round2(cgst + sgst + igst);
  const grandTotal = round2(subtotal + taxTotal);
  const payable = Math.round(grandTotal);
  const roundOff = round2(payable - grandTotal);

  const placeOfSupply =
    input.placeOfSupply || input.to?.stateCode || input.from?.stateCode || "";

  // SAC-wise breakup
  const bySac = new Map<string, ComputedLine[]>();
  for (const l of lines) {
    const arr = bySac.get(l.sacCode) ?? [];
    arr.push(l);
    bySac.set(l.sacCode, arr);
  }
  const sacBreakup: SacBreakupRow[] = [...bySac.entries()].map(([sacCode, group]) => {
    const taxable = round2(group.reduce((s, l) => s + l.amount, 0));
    const c = isIntra ? round2((taxable * effectiveGstRate) / 200) : 0;
    const s = isIntra ? round2((taxable * effectiveGstRate) / 200) : 0;
    const i = isIGST ? round2((taxable * effectiveGstRate) / 100) : 0;
    return {
      sacCode,
      sacDesc: group[0].sacDesc,
      taxable,
      cgst: c,
      sgst: s,
      igst: i,
      tax: round2(c + s + i),
    };
  });

  // Validations that mirror common real-world invoice mistakes
  if (invoiceType === "tax" && input.from && !input.from.gstin) {
    warnings.push("Supplier GSTIN is missing — a tax invoice is not valid for ITC without it.");
  }
  if (isIGST && !isZeroRated && input.from?.stateCode && placeOfSupply &&
      input.from.stateCode === placeOfSupply) {
    warnings.push("Inter-State supply but place of supply equals supplier state — check supply type.");
  }
  if (isIntra && input.to?.stateCode && input.from?.stateCode &&
      input.to.stateCode !== input.from.stateCode) {
    warnings.push("Intra-State tax applied but recipient state differs from supplier — likely should be IGST.");
  }
  if ((invoiceType === "credit" || invoiceType === "debit") && !input.origInvoiceNo) {
    warnings.push("Credit/Debit note is missing the original invoice reference (Sec. 34 CGST).");
  }
  if (isZeroRated && !input.lutRef) {
    warnings.push("Zero-rated supply under Bond/LUT but no LUT/Bond reference provided.");
  }
  for (const l of lines) {
    if (l.qty <= 0) warnings.push(`Line "${l.description || l.sacCode}" has non-positive quantity.`);
    if (l.rate < 0) warnings.push(`Line "${l.description || l.sacCode}" has a negative rate.`);
  }

  const now = new Date();
  const fy = fyLabel(input.invoiceDate ? new Date(input.invoiceDate) : now);
  const invoiceNumber =
    input.invoiceNumber?.trim() ||
    `SF/${INVOICE_TYPE_PREFIX[invoiceType]}/${fy}/${String(
      Math.floor(parseInt(now.getTime().toString().slice(-6)) % 999) + 1,
    ).padStart(3, "0")}`;

  return {
    invoiceType,
    invoiceTypeLabel: INVOICE_TYPE_LABEL[invoiceType],
    invoiceNumber,
    invoiceDate: input.invoiceDate || now.toISOString().slice(0, 10),
    dueDate: input.dueDate || null,
    gstRate,
    effectiveGstRate,
    supplyType,
    supplyLabel: SUPPLY_LABEL[supplyType],
    placeOfSupply,
    placeOfSupplyName: GST_STATES[placeOfSupply] || "",
    reverseCharge: Boolean(input.reverseCharge),
    poRef: input.poRef || null,
    ewayBill: input.ewayBill || null,
    lutRef: input.lutRef || null,
    origInvoiceNo: input.origInvoiceNo || null,
    origInvoiceDate: input.origInvoiceDate || null,
    reason: input.reason || null,
    from: input.from ?? {},
    to: input.to ?? {},
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
    bank: input.bank ?? {},
    notes: input.notes || null,
    isInterState: isIGST,
    isZeroRated,
    warnings,
    generatedAt: now.toISOString(),
  };
}

function fyLabel(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// ───────────────────────────── PDF ─────────────────────────────

const MARGIN = 42;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const INK = rgb(0.07, 0.08, 0.1);
const MUTED = rgb(0.42, 0.42, 0.46);
const BRAND = rgb(0.145, 0.388, 0.921);
const RULE = rgb(0.8, 0.8, 0.84);

function ansi(s: string): string {
  return (s ?? "")
    .replace(/₹/g, "Rs ")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?");
}

function inr(n: number): string {
  const [w, f] = Math.abs(n).toFixed(2).split(".");
  const last3 = w.slice(-3);
  const rest = w.slice(0, -3);
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3
    : last3;
  return `${n < 0 ? "-" : ""}Rs ${grouped}.${f}`;
}

export async function renderGstInvoicePdf(inv: ComputedInvoice): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${inv.invoiceTypeLabel} ${inv.invoiceNumber}`);
  doc.setProducer("StackFox");
  doc.setCreationDate(new Date());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const W = PAGE_W - MARGIN * 2;

  const draw = (
    s: string,
    x: number,
    size = 9,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center"; width?: number } = {},
  ) => {
    const f = opts.bold ? bold : font;
    const text = ansi(s);
    let dx = x;
    if (opts.align === "right") dx = x - f.widthOfTextAtSize(text, size);
    else if (opts.align === "center") dx = x - f.widthOfTextAtSize(text, size) / 2;
    page.drawText(text, { x: dx, y, size, font: f, color: opts.color ?? INK });
  };
  const hr = (thickness = 0.75, color = RULE) => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness,
      color,
    });
  };
  const ensure = (space: number) => {
    if (y - space < MARGIN + 40) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Header
  draw("StackFox", MARGIN, 16, { bold: true, color: BRAND });
  draw(inv.invoiceTypeLabel, PAGE_W - MARGIN, 16, { bold: true, align: "right" });
  y -= 16;
  draw("Invoice Generator — computer-generated document", MARGIN, 8, { color: MUTED });
  draw(
    inv.invoiceType === "credit" || inv.invoiceType === "debit"
      ? "Sec. 34 CGST Act | Rule 53"
      : inv.invoiceType === "proforma"
        ? "Not a tax invoice — not a demand for payment"
        : "Sec. 31 CGST Act | Rule 46",
    PAGE_W - MARGIN,
    8,
    { align: "right", color: MUTED },
  );
  y -= 12;
  hr(1.5, BRAND);
  y -= 14;

  // Supplier / recipient
  const colW = W / 2 - 8;
  const startY = y;
  const block = (x: number, title: string, p: GstParty) => {
    y = startY;
    draw(title, x, 8, { bold: true, color: BRAND });
    y -= 12;
    draw(p.name || "—", x, 10, { bold: true });
    y -= 12;
    const lines = [
      p.address,
      [p.city, GST_STATES[p.stateCode ?? ""] ? `${GST_STATES[p.stateCode ?? ""]} (${p.stateCode})` : p.stateCode]
        .filter(Boolean)
        .join(", "),
      p.phone ? `Ph: ${p.phone}` : "",
      p.email,
      p.gstin ? `GSTIN: ${p.gstin}` : "",
      p.pan ? `PAN: ${p.pan}` : "",
    ].filter(Boolean) as string[];
    for (const ln of lines) {
      draw(ln, x, 8.5, { color: MUTED });
      y -= 10.5;
    }
  };
  block(MARGIN, "SUPPLIER", inv.from);
  const afterLeft = y;
  block(MARGIN + colW + 16, "RECIPIENT", inv.to);
  y = Math.min(afterLeft, y) - 6;

  // Particulars strip
  hr();
  y -= 12;
  const particulars: [string, string][] = [
    [inv.invoiceTypeLabel.includes("NOTE") ? "Note No." : "Invoice No.", inv.invoiceNumber],
    ["Date", inv.invoiceDate],
    ...(inv.dueDate ? ([["Due", inv.dueDate]] as [string, string][]) : []),
    ["Place of Supply", `${inv.placeOfSupplyName} (${inv.placeOfSupply})`.trim()],
    ["Supply", inv.supplyLabel],
    ["Reverse Charge", inv.reverseCharge ? "YES" : "No"],
    ...(inv.poRef ? ([["PO / Ref", inv.poRef]] as [string, string][]) : []),
    ...(inv.ewayBill ? ([["E-Way Bill", inv.ewayBill]] as [string, string][]) : []),
    ...(inv.lutRef ? ([["LUT / Bond", inv.lutRef]] as [string, string][]) : []),
    ...(inv.origInvoiceNo ? ([["Orig. Invoice", inv.origInvoiceNo]] as [string, string][]) : []),
    ...(inv.origInvoiceDate ? ([["Orig. Date", inv.origInvoiceDate]] as [string, string][]) : []),
    ...(inv.reason ? ([["Reason", inv.reason]] as [string, string][]) : []),
  ];
  for (let i = 0; i < particulars.length; i += 2) {
    ensure(14);
    draw(`${particulars[i][0]}:`, MARGIN, 8.5, { color: BRAND, bold: true });
    draw(particulars[i][1], MARGIN + 90, 8.5);
    if (particulars[i + 1]) {
      draw(`${particulars[i + 1][0]}:`, MARGIN + colW + 16, 8.5, { color: BRAND, bold: true });
      draw(particulars[i + 1][1], MARGIN + colW + 16 + 90, 8.5);
    }
    y -= 12;
  }
  y -= 4;

  // Line item table
  const cols = [
    { label: "#", x: MARGIN, align: "left" as const },
    { label: "Description", x: MARGIN + 22, align: "left" as const },
    { label: "SAC", x: MARGIN + 250, align: "left" as const },
    { label: "Qty", x: MARGIN + 300, align: "right" as const },
    { label: "Rate", x: MARGIN + 370, align: "right" as const },
    { label: "Amount", x: PAGE_W - MARGIN, align: "right" as const },
  ];
  ensure(20);
  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: W,
    height: 16,
    color: BRAND,
  });
  for (const c of cols) draw(c.label, c.x, 8, { bold: true, color: rgb(1, 1, 1), align: c.align });
  y -= 18;
  inv.lines.forEach((l, idx) => {
    ensure(16);
    draw(String(idx + 1), cols[0].x, 8.5);
    const desc = l.description.length > 46 ? l.description.slice(0, 45) + "…" : l.description;
    draw(desc || "—", cols[1].x, 8.5);
    draw(l.sacCode, cols[2].x, 8.5);
    draw(`${l.qty} ${l.unit}`, cols[3].x, 8.5, { align: "right" });
    draw(inr(l.rate), cols[4].x, 8.5, { align: "right" });
    draw(inr(l.amount), cols[5].x, 8.5, { align: "right" });
    y -= 13;
    if (l.discount > 0) {
      draw(
        `  discount: ${l.discount}${l.discountType === "%" ? "%" : " flat"}`,
        cols[1].x,
        7.5,
        { color: MUTED },
      );
      y -= 10;
    }
  });
  y -= 2;
  hr();
  y -= 12;

  // Totals
  const totalRows: [string, string][] = [
    ["Subtotal (Taxable)", inr(inv.subtotal)],
    ...(inv.cgst ? ([[`CGST @ ${inv.effectiveGstRate / 2}%`, inr(inv.cgst)]] as [string, string][]) : []),
    ...(inv.sgst ? ([[`SGST @ ${inv.effectiveGstRate / 2}%`, inr(inv.sgst)]] as [string, string][]) : []),
    ...(inv.igst ? ([[`IGST @ ${inv.effectiveGstRate}%`, inr(inv.igst)]] as [string, string][]) : []),
    ...(inv.isZeroRated ? ([["GST", "Zero-rated"]] as [string, string][]) : []),
    ...(Math.abs(inv.roundOff) > 0.001
      ? ([["Round Off", `${inv.roundOff >= 0 ? "+" : ""}${inv.roundOff.toFixed(2)}`]] as [string, string][])
      : []),
  ];
  const boxX = PAGE_W - MARGIN - 230;
  for (const [label, val] of totalRows) {
    ensure(14);
    draw(label, boxX, 8.5, { color: MUTED });
    draw(val, PAGE_W - MARGIN, 8.5, { align: "right", bold: true });
    y -= 12;
  }
  ensure(20);
  page.drawRectangle({ x: boxX - 8, y: y - 5, width: 230 + 8, height: 17, color: BRAND });
  draw(
    inv.invoiceType === "credit" ? "TOTAL CREDIT" : inv.invoiceType === "debit" ? "TOTAL DEBIT" : "PAYABLE",
    boxX,
    9.5,
    { bold: true, color: rgb(1, 1, 1) },
  );
  draw(inr(inv.payable), PAGE_W - MARGIN, 9.5, { align: "right", bold: true, color: rgb(1, 1, 1) });
  y -= 20;
  ensure(14);
  draw("Amount in words: ", MARGIN, 8.5, { bold: true });
  draw(inv.amountInWords, MARGIN + 78, 8.5, { color: MUTED });
  y -= 16;

  // SAC breakup
  if (inv.sacBreakup.length) {
    ensure(20);
    draw("TAX BREAKUP BY SAC", MARGIN, 8, { bold: true, color: BRAND });
    y -= 12;
    for (const r of inv.sacBreakup) {
      ensure(12);
      draw(`${r.sacCode}  ${r.sacDesc}`, MARGIN, 8);
      draw(`Taxable ${inr(r.taxable)}`, MARGIN + 240, 8, { color: MUTED });
      draw(`Tax ${inr(r.tax)}`, PAGE_W - MARGIN, 8, { align: "right" });
      y -= 11;
    }
    y -= 6;
  }

  // Bank + signature
  ensure(70);
  hr();
  y -= 12;
  const bankStartY = y;
  const b = inv.bank ?? {};
  const bankLines = [
    b.name ? `Bank: ${b.name}` : "",
    b.branch ? `Branch: ${b.branch}` : "",
    b.account ? `A/C: ${b.account}` : "",
    b.ifsc ? `IFSC: ${b.ifsc}` : "",
    b.upi ? `UPI: ${b.upi}` : "",
    b.swift ? `SWIFT: ${b.swift}` : "",
  ].filter(Boolean) as string[];
  if (bankLines.length) {
    draw("BANK DETAILS", MARGIN, 8, { bold: true, color: BRAND });
    y -= 11;
    for (const ln of bankLines) {
      draw(ln, MARGIN, 8, { color: MUTED });
      y -= 10;
    }
  }
  y = bankStartY;
  draw(`For ${inv.from.name || "StackFox"}`, PAGE_W - MARGIN, 8, { align: "right", bold: true });
  y -= 42;
  draw("Authorised Signatory", PAGE_W - MARGIN, 8, { align: "right", color: MUTED });
  y -= 16;

  if (inv.notes) {
    ensure(24);
    draw("Notes: ", MARGIN, 8, { bold: true });
    draw(inv.notes.slice(0, 120), MARGIN + 34, 8, { color: MUTED });
    y -= 14;
  }

  // Footer / terms
  ensure(40);
  hr(1, BRAND);
  y -= 10;
  const terms =
    "Payment due within 30 days. Interest @ 18% p.a. (MSMED Act s.16). GST per CGST/IGST Act 2017. " +
    "SAC per GST Tariff. Rule 46 CGST Rules 2017; valid for ITC u/s 16(2)(a). TDS u/s 194J/194C where applicable. " +
    "Disputes subject to Jaipur jurisdiction. E&OE.";
  const words = ansi(terms).split(" ");
  let line = "";
  for (const w of words) {
    if (font.widthOfTextAtSize(line + " " + w, 6.5) > W && line) {
      draw(line, MARGIN, 6.5, { color: MUTED });
      y -= 8;
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) {
    draw(line, MARGIN, 6.5, { color: MUTED });
    y -= 8;
  }

  if (inv.warnings.length) {
    y -= 6;
    draw("Validation notes:", MARGIN, 6.5, { bold: true, color: rgb(0.72, 0.11, 0.11) });
    y -= 8;
    for (const w of inv.warnings.slice(0, 6)) {
      ensure(10);
      draw(`- ${w}`, MARGIN, 6.5, { color: rgb(0.72, 0.11, 0.11) });
      y -= 8;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

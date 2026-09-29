/**
 * The payment receipt ("payment slip"): one A4 page, numbered AWL/RCP/<FY>/NNNN, issued for a
 * single captured payment. It states what was received, from whom, against which invoice, and
 * what is still owed afterwards.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SUPPLIER, amountInWords, inr2 } from "./companyInvoice";
import { ansi } from "./pdf";

export interface ReceiptModel {
  receiptNo: string;
  receivedOn: Date;
  /** rupees */
  amount: number;
  method?: string | null;
  gateway: string;
  reference?: string | null;
  payer: { name: string; email?: string | null; gstin?: string | null };
  invoice?: {
    invoiceNo: string;
    /** rupees */
    total: number;
    /** rupees owed after this payment */
    balance: number;
  } | null;
}

const W = 595.28;
const H = 841.89;
const MX = 48;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const FAINT = rgb(0.86, 0.86, 0.88);
const ACCENT = rgb(0.91, 0.33, 0.12);
const GREEN = rgb(0.06, 0.5, 0.3);

const day = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

const METHOD: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  manual: "Bank transfer",
};

export async function renderReceiptPdf(r: ReceiptModel): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Payment receipt ${r.receiptNo}`);
  doc.setAuthor("StackFox");
  doc.setProducer("StackFox");
  doc.setCreationDate(r.receivedOn);
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    o: { bold?: boolean; color?: ReturnType<typeof rgb>; right?: boolean } = {},
  ) => {
    const f = o.bold ? bold : font;
    const t = ansi(s);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: o.right ? x - w : x, y, size, font: f, color: o.color ?? INK });
  };
  const rule = (y: number, color = FAINT, x1 = MX, x2 = W - MX, t = 0.6) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color });

  // Header
  text("STACKFOX", MX, H - 64, 11, { bold: true });
  text(SUPPLIER.legalName, MX, H - 80, 8.5, { color: MUTED });
  text("PAYMENT RECEIPT", W - MX, H - 64, 11, { bold: true, right: true, color: ACCENT });
  text(r.receiptNo, W - MX, H - 82, 13, { bold: true, right: true });
  rule(H - 100);

  // Amount
  let y = H - 170;
  text("AMOUNT RECEIVED", MX, y, 8, { bold: true, color: MUTED });
  y -= 44;
  text(`Rs ${inr2(r.amount)}`, MX, y, 36, { bold: true });
  y -= 22;
  text(amountInWords(r.amount), MX, y, 10, { color: MUTED });

  // Facts
  y -= 50;
  rule(y);
  const rows: Array<[string, string]> = [
    ["Received on", day(r.receivedOn)],
    ["Received from", r.payer.name],
    ...(r.payer.gstin
      ? ([["Client GSTIN", r.payer.gstin]] as Array<[string, string]>)
      : []),
    [
      "Payment method",
      [
        METHOD[String(r.method ?? "").toLowerCase()] ?? r.method,
        r.gateway === "BANK_TRANSFER" ? null : r.gateway,
      ]
        .filter(Boolean)
        .join(" via ") || r.gateway,
    ],
    ...(r.reference ? ([["Reference", r.reference]] as Array<[string, string]>) : []),
    ...(r.invoice
      ? ([["Against invoice", r.invoice.invoiceNo]] as Array<[string, string]>)
      : []),
  ];
  for (const [label, value] of rows) {
    y -= 26;
    text(label, MX, y, 9, { color: MUTED });
    text(value, MX + 130, y, 10.5, { bold: label === "Against invoice" });
    y -= 8;
    rule(y);
  }

  // Invoice position after this payment
  if (r.invoice) {
    y -= 40;
    text("INVOICE POSITION", MX, y, 8, { bold: true, color: MUTED });
    const line = (label: string, value: string, strong = false, color = INK) => {
      y -= 22;
      text(label, MX, y, 10, { color: strong ? INK : MUTED, bold: strong });
      text(value, W - MX, y, 10.5, { right: true, bold: strong, color });
    };
    line("Invoice total", `Rs ${inr2(r.invoice.total)}`);
    line("This payment", `Rs ${inr2(r.amount)}`);
    y -= 6;
    rule(y, INK, MX, W - MX, 0.8);
    r.invoice.balance > 0
      ? line("Balance due", `Rs ${inr2(r.invoice.balance)}`, true, ACCENT)
      : line("Balance due", "Nil - paid in full", true, GREEN);
  }

  // Footer
  rule(96);
  text(
    "This is a computer-generated receipt and needs no signature. It acknowledges receipt of the amount above only.",
    MX,
    76,
    8,
    { color: MUTED },
  );
  text(
    `${SUPPLIER.legalName}  |  CIN ${SUPPLIER.cin}  |  GSTIN ${SUPPLIER.gstin}`,
    MX,
    62,
    7.5,
    { color: MUTED },
  );
  text(`${SUPPLIER.email}  |  ${SUPPLIER.phone}  |  ${SUPPLIER.website}`, MX, 50, 7.5, {
    color: MUTED,
  });

  return Buffer.from(await doc.save());
}

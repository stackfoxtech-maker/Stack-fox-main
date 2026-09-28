import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ansi } from "./pdf";
import { SUPPLIER } from "./companyInvoice";
import { templateFor, TEMPLATE_VERSION, type ContractContext } from "./contractText";

/**
 * Renders contracts as one minimal, typographic document: a cover with the
 * contents, then each contract on its own page(s) with its own signature block.
 *
 * Deliberately restrained: one accent colour, one typeface, generous margins.
 * Helvetica is a standard font, so the file has no font dependencies and the
 * output is stable across viewers.
 */

const W = 595.28;
const H = 841.89;
const MX = 64;
const TOP = H - 72;
const BOTTOM = 76;
const BODY_W = W - MX * 2;

const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.45, 0.45, 0.5);
const FAINT = rgb(0.86, 0.86, 0.88);
const ACCENT = rgb(0.91, 0.33, 0.12);

export interface PackSignature {
  side: string; // CLIENT | STACKFOX
  name?: string;
  signedAt: Date;
}

export interface PackContract {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  executedAt: Date | null;
  signatures: PackSignature[];
  context: ContractContext;
}

export interface Pack {
  clientName: string;
  clientKind?: string;
  clientGstin?: string | null;
  clientAddress?: string | null;
  engagementId: string;
  generatedOn: Date;
  contracts: PackContract[];
  /** A cover with the contents. Off for a single-document copy. */
  cover: boolean;
}

const date = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

const statusLabel = (c: PackContract): string => {
  const clientSigned = c.signatures.some((s) => s.side === "CLIENT");
  const us = c.signatures.some((s) => s.side === "STACKFOX");
  if (c.status === "EXECUTED" || (clientSigned && us)) return "Signed by both parties";
  if (clientSigned) return "Signed by client";
  return "Awaiting signature";
};

/** Letter-spaced capitals for small labels; pdf-lib has no tracking option. */
function tracked(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  spacing: number,
) {
  let cx = x;
  for (const ch of ansi(text)) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

class Sheet {
  page!: PDFPage;
  y = TOP;
  pages: PDFPage[] = [];
  /** Running header for pages after the first of a document. */
  running = "";

  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {}

  newPage(running = this.running) {
    this.page = this.doc.addPage([W, H]);
    this.pages.push(this.page);
    this.y = TOP;
    this.running = running;
    return this.page;
  }

  need(space: number) {
    if (this.y - space < BOTTOM) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const para of ansi(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW && line) {
          out.push(line);
          line = word;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  }

  draw(
    text: string,
    x: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; spacing?: number } = {},
  ) {
    const font = opts.bold ? this.bold : this.font;
    if (opts.spacing) {
      tracked(this.page, text, x, this.y, size, font, opts.color ?? INK, opts.spacing);
      return;
    }
    this.page.drawText(ansi(text), {
      x,
      y: this.y,
      size,
      font,
      color: opts.color ?? INK,
    });
  }

  drawRight(
    text: string,
    xRight: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) {
    const f = opts.bold ? this.bold : this.font;
    const w = f.widthOfTextAtSize(ansi(text), size);
    this.draw(text, xRight - w, size, opts);
  }

  rule(color = FAINT, x1 = MX, x2 = W - MX, thickness = 0.6) {
    this.page.drawLine({
      start: { x: x1, y: this.y },
      end: { x: x2, y: this.y },
      thickness,
      color,
    });
  }

  /** A block of wrapped text; returns nothing, advances the cursor. */
  paragraph(
    text: string,
    x: number,
    size: number,
    opts: { color?: ReturnType<typeof rgb>; lead?: number; width?: number } = {},
  ) {
    const lead = opts.lead ?? size * 1.5;
    const lines = this.wrap(text, this.font, size, opts.width ?? W - MX - x);
    for (const line of lines) {
      this.need(lead);
      this.y -= lead;
      this.draw(line, x, size, { color: opts.color });
    }
  }
}

function footer(sheet: Sheet, pack: Pack) {
  const total = sheet.pages.length;
  sheet.pages.forEach((page, i) => {
    const f = sheet.font;
    const left = ansi(`StackFox  ·  ${pack.engagementId}`);
    page.drawLine({
      start: { x: MX, y: 52 },
      end: { x: W - MX, y: 52 },
      thickness: 0.5,
      color: FAINT,
    });
    page.drawText(left, { x: MX, y: 38, size: 7.5, font: f, color: MUTED });
    const right = `Page ${i + 1} of ${total}`;
    page.drawText(right, {
      x: W - MX - f.widthOfTextAtSize(right, 7.5),
      y: 38,
      size: 7.5,
      font: f,
      color: MUTED,
    });
  });
}

function cover(sheet: Sheet, pack: Pack) {
  sheet.newPage("");
  sheet.y = TOP;
  sheet.draw("STACKFOX", MX, 11, { bold: true, spacing: 2.4 });
  sheet.y -= 14;
  sheet.draw(
    `by ${SUPPLIER.legalName
      .split(" PRIVATE")[0]
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())}`,
    MX,
    8.5,
    { color: MUTED },
  );

  sheet.y = H - 250;
  sheet.draw("AGREEMENT PACK", MX, 8.5, { bold: true, color: ACCENT, spacing: 2.2 });
  sheet.y -= 34;
  for (const line of sheet.wrap(pack.clientName, sheet.bold, 28, BODY_W)) {
    sheet.draw(line, MX, 28, { bold: true });
    sheet.y -= 34;
  }
  sheet.y -= 2;
  sheet.draw(`${pack.engagementId}   ·   Prepared ${date(pack.generatedOn)}`, MX, 10, {
    color: MUTED,
  });

  sheet.y -= 56;
  sheet.draw("CONTENTS", MX, 7.5, { bold: true, color: MUTED, spacing: 1.8 });
  sheet.y -= 10;
  pack.contracts.forEach((c, i) => {
    sheet.y -= 10;
    sheet.rule();
    sheet.y -= 22;
    const t = templateFor(c.type, c.context);
    sheet.draw(String(i + 1).padStart(2, "0"), MX, 10, { color: ACCENT, bold: true });
    sheet.draw(t.title, MX + 34, 11.5, { bold: true });
    sheet.drawRight(statusLabel(c), W - MX, 9, { color: MUTED });
    sheet.y -= 4;
  });
  sheet.y -= 10;
  sheet.rule();

  sheet.y = 150;
  sheet.draw("Provider", MX, 7.5, { bold: true, color: MUTED, spacing: 1.6 });
  sheet.y -= 16;
  sheet.draw(SUPPLIER.legalName, MX, 9.5, { bold: true });
  for (const l of [
    `CIN ${SUPPLIER.cin}`,
    ...SUPPLIER.addressLines.map((s) => s.replace(/\s{2,}/g, " ")),
    `${SUPPLIER.email}  ·  ${SUPPLIER.website}`,
  ]) {
    sheet.y -= 13;
    sheet.draw(l, MX, 8.5, { color: MUTED });
  }
}

function partiesBlock(sheet: Sheet, pack: Pack, c: PackContract) {
  const colW = BODY_W / 2 - 12;
  const left = [
    SUPPLIER.legalName,
    `CIN ${SUPPLIER.cin}`,
    `GSTIN ${SUPPLIER.gstin}`,
    ...SUPPLIER.addressLines.map((s) => s.replace(/\s{2,}/g, " ")),
  ];
  const right = [
    pack.clientName,
    ...(pack.clientKind && pack.clientKind !== "INDIVIDUAL"
      ? [pack.clientKind.replace(/_/g, " ")]
      : []),
    ...(pack.clientGstin ? [`GSTIN ${pack.clientGstin}`] : []),
    ...(pack.clientAddress ? sheet.wrap(pack.clientAddress, sheet.font, 8.5, colW) : []),
  ];
  const rows = Math.max(left.length, right.length);
  sheet.need(40 + rows * 13);
  sheet.y -= 22;
  sheet.draw("PROVIDER", MX, 7, { bold: true, color: MUTED, spacing: 1.6 });
  tracked(sheet.page, "CLIENT", MX + BODY_W / 2 + 12, sheet.y, 7, sheet.bold, MUTED, 1.6);
  for (let i = 0; i < rows; i++) {
    sheet.y -= 13;
    if (left[i])
      sheet.draw(left[i], MX, i === 0 ? 9.5 : 8.5, {
        bold: i === 0,
        color: i === 0 ? INK : MUTED,
      });
    if (right[i])
      sheet.page.drawText(ansi(right[i]), {
        x: MX + BODY_W / 2 + 12,
        y: sheet.y,
        size: i === 0 ? 9.5 : 8.5,
        font: i === 0 ? sheet.bold : sheet.font,
        color: i === 0 ? INK : MUTED,
      });
  }
  sheet.y -= 18;
  sheet.draw("EFFECTIVE", MX, 7, { bold: true, color: MUTED, spacing: 1.6 });
  tracked(
    sheet.page,
    "REFERENCE",
    MX + BODY_W / 2 + 12,
    sheet.y,
    7,
    sheet.bold,
    MUTED,
    1.6,
  );
  sheet.y -= 13;
  sheet.draw(date(c.executedAt ?? c.createdAt), MX, 9);
  sheet.page.drawText(ansi(`${pack.engagementId}  ·  ${c.id.slice(0, 8)}`), {
    x: MX + BODY_W / 2 + 12,
    y: sheet.y,
    size: 9,
    font: sheet.font,
    color: INK,
  });
  sheet.y -= 14;
}

function scheduleTable(sheet: Sheet, c: PackContract) {
  const rows = c.context.schedule;
  if (!rows.length) return;
  sheet.need(50 + rows.length * 22);
  sheet.y -= 22;
  sheet.draw("MILESTONE", MX + 24, 7, { bold: true, color: MUTED, spacing: 1.4 });
  sheet.drawRight("SHARE OF FEE", W - MX, 7, { bold: true, color: MUTED });
  sheet.y -= 8;
  rows.forEach((r, i) => {
    sheet.y -= 6;
    sheet.rule();
    sheet.y -= 15;
    sheet.draw(String(i + 1), MX + 24, 9.5, { color: ACCENT, bold: true });
    sheet.draw(r.name, MX + 44, 9.5);
    sheet.drawRight(`${r.pct}%`, W - MX, 9.5, { bold: true });
  });
  sheet.y -= 6;
  sheet.rule();
  sheet.y -= 6;
}

function signatureBlock(sheet: Sheet, pack: Pack, c: PackContract) {
  sheet.need(150);
  sheet.y -= 34;
  const colW = BODY_W / 2 - 16;
  const clientSig = c.signatures.find((s) => s.side === "CLIENT");
  const ourSig = c.signatures.find((s) => s.side === "STACKFOX");
  const top = sheet.y;

  const one = (
    x: number,
    party: string,
    sig: PackSignature | undefined,
    fallbackName: string,
    sub: string,
  ) => {
    tracked(sheet.page, party.toUpperCase(), x, top, 7, sheet.bold, MUTED, 1.6);
    const lineY = top - 44;
    sheet.page.drawLine({
      start: { x, y: lineY },
      end: { x: x + colW, y: lineY },
      thickness: 0.7,
      color: INK,
    });
    if (sig) {
      const name = sig.name || fallbackName;
      sheet.page.drawText(ansi(name), {
        x,
        y: lineY + 8,
        size: 15,
        font: sheet.font,
        color: INK,
      });
    }
    sheet.page.drawText(ansi(sig ? sig.name || fallbackName : fallbackName), {
      x,
      y: lineY - 14,
      size: 8.5,
      font: sheet.bold,
      color: INK,
    });
    sheet.page.drawText(ansi(sub), {
      x,
      y: lineY - 26,
      size: 8,
      font: sheet.font,
      color: MUTED,
    });
    sheet.page.drawText(
      ansi(sig ? `Signed electronically on ${date(sig.signedAt)}` : "Awaiting signature"),
      {
        x,
        y: lineY - 38,
        size: 8,
        font: sheet.font,
        color: sig ? ACCENT : MUTED,
      },
    );
  };

  one(MX, "For the Client", clientSig, pack.clientName, "Authorised signatory");
  one(
    MX + BODY_W / 2 + 16,
    "For StackFox",
    ourSig,
    SUPPLIER.signatory.name,
    SUPPLIER.signatory.title,
  );
  sheet.y = top - 96;
}

function contractPages(sheet: Sheet, pack: Pack, c: PackContract) {
  const t = templateFor(c.type, c.context);
  sheet.newPage(t.title);
  sheet.y = TOP;
  sheet.draw(t.label.toUpperCase(), MX, 8, { bold: true, color: ACCENT, spacing: 2 });
  sheet.y -= 34;
  sheet.draw(t.title, MX, 24, { bold: true });
  sheet.y -= 22;
  sheet.draw(t.summary, MX, 10.5, { color: MUTED });
  sheet.y -= 18;
  sheet.rule(ACCENT, MX, MX + 28, 1.6);

  partiesBlock(sheet, pack, c);
  sheet.y -= 10;
  sheet.rule();

  t.clauses.forEach((cl, i) => {
    sheet.need(70);
    sheet.y -= 24;
    sheet.draw(String(i + 1).padStart(2, "0"), MX, 8.5, { bold: true, color: ACCENT });
    sheet.draw(cl.heading, MX + 26, 10.5, { bold: true });
    for (const p of cl.paragraphs) {
      sheet.y -= 3;
      sheet.paragraph(p, MX + 26, 9.5, { color: rgb(0.2, 0.2, 0.24), lead: 14 });
    }
    if (t.showSchedule && cl.heading === "Schedule and payment") scheduleTable(sheet, c);
  });

  signatureBlock(sheet, pack, c);
  sheet.y -= 10;
  sheet.draw(`Template version ${TEMPLATE_VERSION}`, MX, 7, { color: MUTED });
}

export async function renderAgreementPack(pack: Pack): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Agreements - ${pack.clientName} - ${pack.engagementId}`);
  doc.setAuthor("StackFox");
  doc.setProducer("StackFox");
  doc.setCreationDate(pack.generatedOn);
  const sheet = new Sheet(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );

  if (pack.cover) cover(sheet, pack);
  for (const c of pack.contracts) contractPages(sheet, pack, c);
  footer(sheet, pack);

  return Buffer.from(await doc.save());
}

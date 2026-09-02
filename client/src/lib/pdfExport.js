import { CURRENCIES } from './constants';
import { jsPDF } from 'jspdf';
import catalogData from '@data/stackfox-data.json';

const serviceMap = new Map(catalogData.services.map(s => [s.id, s]));
const packageMap = new Map(catalogData.packages.map(p => [p.id, p]));
const addonMap = new Map(catalogData.addons.map(a => [a.id, a]));
const categoryMap = new Map(catalogData.categories.map(c => [c.id, c]));

function lookupItem(itemId) {
  if (serviceMap.has(itemId)) return { type: 'service', data: serviceMap.get(itemId) };
  if (packageMap.has(itemId)) return { type: 'package', data: packageMap.get(itemId) };
  if (addonMap.has(itemId)) return { type: 'addon', data: addonMap.get(itemId) };
  return null;
}

export const exportQuotePDF = async (items, curIdx, cartWarnings = [], cartRoi = [], quote = {}) => {
  const cur = CURRENCIES[curIdx];

  const fmtNum = (n) => new Intl.NumberFormat(cur.locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n * cur.rate);
  const fmtCur = (n) => cur.symbol === '₹' ? `Rs. ${fmtNum(n)}` : `${cur.symbol}${fmtNum(n)}`;

  const sub = quote.subtotal || items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tx = quote.gstAmount ?? Math.round(sub * (cur.tax / 100));
  const total = quote.total || sub + tx;
  const quoteNumber = quote.quoteNumber || 'DRAFT';
  const status = quote.status ? quote.status.toUpperCase() : 'DRAFT';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const quoteDate = fmtDate(quote.createdAt) || fmtDate(new Date());
  const validUntil = fmtDate(quote.validUntil);
  const tier = quote.tier || 'GROWTH';

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, ML = 16, MR = 16;
  const cw = W - ML - MR;
  let y = 0;
  let pageNum = 1;

  // ── Palette ──
  const C = {
    fox: [255, 77, 0], foxDk: [200, 55, 0], foxBg: [255, 247, 243],
    dark: [23, 23, 23], text: [50, 50, 50], mid: [110, 110, 110],
    light: [160, 160, 160], faint: [225, 225, 225], bgAlt: [248, 248, 248],
    white: [255, 255, 255], green: [22, 163, 74], greenBg: [240, 253, 244],
  };

  const sc = (...c) => doc.setTextColor(...c);
  const sf = (...c) => doc.setFillColor(...c);
  const sd = (...c) => doc.setDrawColor(...c);

  const newPage = () => {
    doc.addPage();
    pageNum++;
    sf(...C.fox); doc.rect(0, 0, W, 3, 'F');
    y = 16;
  };

  const ensureSpace = (need) => {
    if (y + need > H - 22) { newPage(); return true; }
    return false;
  };

  // ═══════════════════════════════════════════
  //  HEADER
  // ═══════════════════════════════════════════
  sf(...C.fox); doc.rect(0, 0, W, 3, 'F');
  y = 16;

  // Brand
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); sc(...C.fox);
  doc.text('STACKFOX', ML, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sc(...C.light);
  doc.text('by Artwall Labs  |  Smart Code, Swift Delivery.', ML, y + 5);

  // QUOTATION badge
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); sc(...C.dark);
  doc.text('QUOTATION', W - MR, y - 2, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); sc(...C.fox);
  doc.text(quoteNumber, W - MR, y + 3, { align: 'right' });

  if (status === 'PAID') {
    sf(...C.green);
    doc.roundedRect(W - MR - 16, y + 5.5, 16, 5, 1.2, 1.2, 'F');
    doc.setFontSize(6); sc(...C.white); doc.setFont('helvetica', 'bold');
    doc.text('PAID', W - MR - 8, y + 8.8, { align: 'center' });
  }

  // Divider
  y = 30; sd(...C.faint); doc.setLineWidth(0.2); doc.line(ML, y, W - MR, y);

  // ── Meta row ──
  y = 36;
  const metaL = (t, x, yy, o) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6); sc(...C.light); doc.text(t, x, yy, o); };
  const metaV = (t, x, yy, o) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); sc(...C.dark); doc.text(t, x, yy, o); };

  metaL('DATE', ML, y); metaV(quoteDate, ML, y + 4.5);
  metaL('VALID UNTIL', ML + 45, y); metaV(validUntil || 'On request', ML + 45, y + 4.5);
  metaL('TIER', ML + 95, y); metaV(tier, ML + 95, y + 4.5);
  metaL('STATUS', W - MR, y, { align: 'right' }); metaV(status, W - MR, y + 4.5, { align: 'right' });

  // ── FROM / TO ──
  y = 49; sd(...C.faint); doc.line(ML, y, W - MR, y);
  y = 55;

  metaL('FROM', ML, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); sc(...C.dark);
  doc.text('StackFox by Artwall Labs', ML, y + 4.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sc(...C.mid);
  doc.text('stackfox.tech@gmail.com  |  +91 82093 95894', ML, y + 9);
  doc.text('Jaipur, Rajasthan, India  |  GSTIN: 08XXXXX1234X1ZX', ML, y + 13);

  const cn = quote.checkoutDetails?.account?.name || quote.checkoutDetails?.account?.companyName || '';
  const ce = quote.checkoutDetails?.account?.email || '';
  if (cn) {
    metaL('PREPARED FOR', W - MR, y, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); sc(...C.dark);
    doc.text(cn, W - MR, y + 4.5, { align: 'right' });
    if (ce) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sc(...C.mid); doc.text(ce, W - MR, y + 9, { align: 'right' }); }
  }

  // ═══════════════════════════════════════════
  //  SUMMARY TABLE (quick overview)
  // ═══════════════════════════════════════════
  y = 78; sd(...C.faint); doc.line(ML, y, W - MR, y);
  y = 84;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); sc(...C.dark);
  doc.text('Order Summary', ML, y);
  y += 8;

  // Table header
  sf(...C.fox); doc.roundedRect(ML, y, cw, 8, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); sc(...C.white);
  doc.text('#', ML + 4, y + 5.2);
  doc.text('SERVICE / PACKAGE', ML + 11, y + 5.2);
  doc.text('TYPE', ML + cw - 55, y + 5.2, { align: 'center' });
  doc.text('EST.', ML + cw - 35, y + 5.2, { align: 'center' });
  doc.text('QTY', ML + cw - 20, y + 5.2, { align: 'center' });
  doc.text('AMOUNT', ML + cw - 3, y + 5.2, { align: 'right' });
  y += 10;

  items.forEach((x, i) => {
    ensureSpace(10);
    const info = lookupItem(x.itemId);
    const est = info?.data?.est || (info?.type === 'package' ? 'Multi-phase' : '-');
    const typeLabel = info?.type === 'package' ? 'Package' : info?.type === 'addon' ? 'Add-on' : 'Service';

    if (i % 2 === 0) { sf(...C.bgAlt); doc.rect(ML, y - 3, cw, 9, 'F'); }

    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); sc(...C.light);
    doc.text(String(i + 1).padStart(2, '0'), ML + 4, y + 2.5);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); sc(...C.dark);
    const nm = x.name.length > 45 ? x.name.slice(0, 43) + '...' : x.name;
    doc.text(nm, ML + 11, y + 2.5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); sc(...C.mid);
    doc.text(typeLabel, ML + cw - 55, y + 2.5, { align: 'center' });
    doc.text(est, ML + cw - 35, y + 2.5, { align: 'center' });
    doc.setFontSize(7);
    doc.text(String(x.quantity), ML + cw - 20, y + 2.5, { align: 'center' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); sc(...C.dark);
    doc.text(fmtCur(x.price * x.quantity), ML + cw - 3, y + 2.5, { align: 'right' });

    y += 9;
  });

  // Table bottom line
  sd(...C.faint); doc.setLineWidth(0.2); doc.line(ML, y, ML + cw, y);

  // ── Totals ──
  y += 5;
  const sX = ML + cw - 80, sW = 80;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); sc(...C.mid);
  doc.text('Subtotal (' + items.length + ' items)', sX, y);
  sc(...C.dark); doc.text(fmtCur(sub), sX + sW, y, { align: 'right' });
  y += 5.5;
  sc(...C.mid); doc.text(cur.taxName + ' @ ' + cur.tax + '%', sX, y);
  sc(...C.dark); doc.text(fmtCur(tx), sX + sW, y, { align: 'right' });
  y += 4;
  sd(...C.fox); doc.setLineWidth(0.4); doc.line(sX, y, sX + sW, y);
  y += 5.5;

  sf(...C.foxBg); sd(...C.fox); doc.setLineWidth(0.3);
  doc.roundedRect(sX - 4, y - 5, sW + 8, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); sc(...C.dark);
  doc.text('GRAND TOTAL', sX, y + 2);
  doc.setFontSize(11); sc(...C.fox);
  doc.text(fmtCur(total), sX + sW, y + 2.5, { align: 'right' });

  // ═══════════════════════════════════════════
  //  DETAILED SERVICE DESCRIPTIONS (page 2+)
  // ═══════════════════════════════════════════
  newPage();

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); sc(...C.dark);
  doc.text('Detailed Service Descriptions', ML, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); sc(...C.mid);
  doc.text('Complete breakdown of every service and package included in this quotation.', ML, y + 6);
  y += 14;

  items.forEach((x, idx) => {
    const info = lookupItem(x.itemId);
    const isPackage = info?.type === 'package';
    const pkg = isPackage ? info.data : null;
    const svc = !isPackage ? info?.data : null;

    // Estimate space needed
    const baseH = isPackage ? 20 + (pkg?.items?.length || 0) * 18 : 30;
    ensureSpace(Math.min(baseH, 80));

    // ── Item header card ──
    sf(...C.foxBg);
    doc.roundedRect(ML, y, cw, 12, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); sc(...C.fox);
    doc.text(String(idx + 1).padStart(2, '0'), ML + 4, y + 7);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); sc(...C.dark);
    doc.text(x.name, ML + 13, y + 5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sc(...C.mid);
    const typeTag = isPackage ? 'PACKAGE' : info?.type === 'addon' ? 'ADD-ON' : 'SERVICE';
    const est = svc?.est || (isPackage ? 'Multi-phase' : '-');
    doc.text(typeTag + '  |  Est: ' + est + '  |  Qty: ' + x.quantity, ML + 13, y + 9.5);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); sc(...C.fox);
    doc.text(fmtCur(x.price * x.quantity), W - MR - 4, y + 7, { align: 'right' });

    y += 15;

    // ── Description ──
    const desc = svc?.lay || pkg?.description || '';
    if (desc) {
      ensureSpace(12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); sc(...C.text);
      const lines = doc.splitTextToSize(desc, cw - 8);
      doc.text(lines, ML + 4, y);
      y += lines.length * 3.5 + 3;
    }

    // ── Package expansion: list all included sub-services ──
    if (isPackage && pkg?.items?.length > 0) {
      ensureSpace(10);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); sc(...C.dark);
      doc.text('Included in this package (' + pkg.items.length + ' services):', ML + 4, y);
      y += 5;

      pkg.items.forEach((subId, si) => {
        const subSvc = serviceMap.get(subId);
        if (!subSvc) return;

        ensureSpace(18);

        // Sub-service row
        if (si % 2 === 0) { sf(...C.bgAlt); doc.rect(ML + 2, y - 2.5, cw - 4, 15, 'F'); }

        // Number bullet
        sf(...C.fox);
        doc.circle(ML + 7, y + 1.5, 2.2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); sc(...C.white);
        doc.text(String(si + 1), ML + 7, y + 2.5, { align: 'center' });

        // Sub-service name & est
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); sc(...C.dark);
        doc.text(subSvc.name, ML + 13, y + 1.5);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); sc(...C.light);
        doc.text('Est: ' + (subSvc.est || '-') + '  |  ' + fmtCur(subSvc.price), W - MR - 4, y + 1.5, { align: 'right' });

        // Sub-service description
        if (subSvc.lay) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); sc(...C.mid);
          const subLines = doc.splitTextToSize(subSvc.lay, cw - 22);
          const maxLines = subLines.slice(0, 3);
          doc.text(maxLines, ML + 13, y + 5.5);
          y += 4 + maxLines.length * 3;
        } else {
          y += 4;
        }

        y += 3;
      });

      if (pkg.savings) {
        ensureSpace(8);
        sf(...C.greenBg);
        doc.roundedRect(ML + 4, y - 2, cw - 8, 7, 1, 1, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); sc(...C.green);
        doc.text('You save ' + fmtCur(pkg.savings) + ' with this package vs buying individually', ML + 8, y + 2.5);
        y += 9;
      }
    }

    // ── If it's a standalone service, show category context ──
    if (!isPackage && svc?.catId) {
      const cat = categoryMap.get(svc.catId);
      if (cat) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); sc(...C.light);
        doc.text('Category: ' + cat.name, ML + 4, y);
        y += 4;
      }
    }

    // Separator between items
    y += 3;
    if (idx < items.length - 1) {
      sd(...C.faint); doc.setLineWidth(0.15); doc.line(ML + 10, y, W - MR - 10, y);
      y += 6;
    }
  });

  // ═══════════════════════════════════════════
  //  WHAT'S INCLUDED + TERMS
  // ═══════════════════════════════════════════
  y += 6;
  ensureSpace(55);

  // What's Included box
  sf(...C.bgAlt);
  doc.roundedRect(ML, y, cw, 32, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); sc(...C.dark);
  doc.text("What's Included With Every Project", ML + 5, y + 6);

  const includes = [
    'Dedicated project manager & single point of contact',
    'Weekly sprint demos & progress updates',
    'Real-time progress dashboard access',
    'Source code ownership & full IP transfer',
    '30 days post-launch support & bug fixes',
    'Complete documentation, training & handover',
  ];
  let iy = y + 12;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); sc(...C.text);
  const half = Math.ceil(includes.length / 2);
  includes.forEach((inc, i) => {
    const col = i < half ? ML + 5 : ML + cw / 2;
    const row = i < half ? iy + i * 4.5 : iy + (i - half) * 4.5;
    sc(...C.fox); doc.text('>', col, row);
    sc(...C.text); doc.text('  ' + inc, col + 2, row);
  });

  y += 36;

  // ── Terms ──
  ensureSpace(35);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); sc(...C.light);
  doc.text('TERMS & CONDITIONS', ML, y);
  y += 5;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); sc(...C.mid);
  const terms = [
    '1.  This quotation is valid for the period specified above. Prices are subject to revision after expiry.',
    '2.  All amounts are in ' + cur.code + '. GST @18% is applied as per Indian tax regulations where applicable.',
    '3.  Payment terms: 30% advance on acceptance, milestone-based payments as per agreed project plan.',
    '4.  Estimated delivery timelines begin after receipt of advance payment and all required inputs from the client.',
    '5.  Final scope, deliverables, and timeline will be confirmed in the service agreement post-acceptance.',
    '6.  Intellectual property rights for all custom work transfer to the client upon full and final payment.',
    '7.  StackFox provides a 30-day warranty on all delivered work for bug fixes and minor adjustments.',
  ];
  terms.forEach(t => { doc.text(t, ML, y, { maxWidth: cw }); y += 4; });

  y += 6;
  ensureSpace(12);
  sf(...C.foxBg);
  doc.roundedRect(ML, y, cw, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); sc(...C.fox);
  doc.text('Ready to proceed?  ', ML + 5, y + 6);
  doc.setFont('helvetica', 'normal'); sc(...C.text);
  doc.text('Reply to this quote or contact us at stackfox.tech@gmail.com  |  +91 82093 95894', ML + 35, y + 6);

  // ── Footer on every page ──
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = H - 12;
    sd(...C.faint); doc.setLineWidth(0.2); doc.line(ML, fy - 3, W - MR, fy - 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.fox);
    doc.text('STACKFOX', ML, fy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...C.light);
    doc.text('stackfox.tech@gmail.com  |  +91 82093 95894  |  stackfox.in', ML, fy + 3.5);
    doc.text('Page ' + p + ' of ' + pages, W - MR, fy + 3.5, { align: 'right' });
    sf(...C.fox); doc.rect(0, H - 3, W, 3, 'F');
  }

  doc.save('StackFox-Quote-' + quoteNumber.replace(/\s+/g, '-') + '.pdf');
};


/* ═══════════════════════════════════════════════════════════════════════════
   GST TAX INVOICE — single-page A4, matches the Artwall Labs invoice layout.
   Pass a computed invoice from src/lib/invoice.js buildInvoice().
   ═══════════════════════════════════════════════════════════════════════════ */
export async function exportTaxInvoicePDF(inv) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210, H = 297, M = 14;
  const CW = W - M * 2;
  const BLUE = [31, 79, 160];
  const INK = [26, 26, 26];
  const MUT = [110, 110, 110];
  const RULE = [214, 220, 230];
  const rs = (n) => 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  const rsn = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const sc = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const sf = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const sd = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const T = (s, x, y, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
    doc.setFontSize(o.size || 9);
    sc(o.color || INK);
    doc.text(String(s), x, y, { align: o.align || 'left', charSpace: o.spread || 0, maxWidth: o.maxWidth });
  };
  const rule = (y, w = 0.5, c = RULE) => { sd(c); doc.setLineWidth(w); doc.line(M, y, W - M, y); };
  const label = (s, x, yy) => T(s, x, yy, { bold: true, size: 7, color: BLUE, spread: 0.3 });

  let y = 18;

  // ── Header ────────────────────────────────────────────────────────────────
  T(inv.supplier.legalName, M, y, { bold: true, size: 12, spread: 0.5 });
  T(inv.supplier.tradeName, M, y + 4.5, { size: 7, color: BLUE, bold: true, spread: 0.2 });
  T(`CIN: ${inv.supplier.cin}`, M, y + 10, { size: 7.5 });
  T(`GSTIN: ${inv.supplier.gstin}   PAN: ${inv.supplier.pan}`, M, y + 14, { size: 7.5 });
  T(`State: ${inv.supplier.stateName} (${inv.supplier.stateCode})`, M, y + 18, { size: 7.5 });

  doc.setLineWidth(0.4); sd(BLUE);
  doc.rect(W - M - 44, y - 5, 44, 6);
  T('ORIGINAL FOR RECIPIENT', W - M - 22, y - 1, { align: 'center', size: 6, color: BLUE, bold: true, spread: 0.2 });
  T('TAX INVOICE', W - M, y + 7, { align: 'right', bold: true, size: 15, color: BLUE });
  T('Reverse Charge: N/A', W - M, y + 13, { align: 'right', size: 7, color: MUT });
  T('Sec. 31 CGST  |  Rule 46', W - M, y + 17, { align: 'right', size: 7, color: MUT });

  y += 23;
  rule(y, 1.4, BLUE);
  y += 8;

  // ── SUPPLIER · RECIPIENT · PARTICULARS ────────────────────────────────────
  const c1 = M, c2 = M + CW * 0.36, c3 = M + CW * 0.68;
  const top = y;
  label('SUPPLIER', c1, y);
  let sy = y + 5;
  T(inv.supplier.legalName, c1, sy, { bold: true, size: 8 }); sy += 4;
  T(inv.supplier.tradeName, c1, sy, { size: 7, color: BLUE }); sy += 4;
  inv.supplier.addressLines.forEach((l) => { T(l, c1, sy, { size: 7.5, color: MUT }); sy += 3.8; });
  T(`Ph: ${inv.supplier.phone}`, c1, sy, { size: 7.5, color: MUT }); sy += 3.8;
  T(inv.supplier.email, c1, sy, { size: 7.5, color: MUT }); sy += 3.8;
  T(inv.supplier.website, c1, sy, { size: 7.5, color: MUT });

  label('RECIPIENT', c2, top);
  let ry = top + 5;
  T(inv.recipient.name, c2, ry, { bold: true, size: 8 }); ry += 4;
  if (inv.recipient.contact) { T(`Attn: ${inv.recipient.contact}`, c2, ry, { size: 7.5, color: MUT }); ry += 3.8; }
  if (inv.recipient.address) { T(inv.recipient.address, c2, ry, { size: 7.5, color: MUT, maxWidth: CW * 0.3 }); ry += 3.8; }
  if (inv.recipient.email) { T(inv.recipient.email, c2, ry, { size: 7.5, color: MUT }); ry += 3.8; }
  if (inv.recipient.phone) { T(inv.recipient.phone, c2, ry, { size: 7.5, color: MUT }); ry += 3.8; }
  if (inv.recipient.gstin) { T(`GSTIN: ${inv.recipient.gstin}`, c2, ry, { size: 7.5, color: MUT }); ry += 3.8; }
  if (inv.recipient.stateName) T(`State: ${inv.recipient.stateName} (${inv.recipient.stateCode})`, c2, ry, { size: 7.5, color: MUT });

  label('PARTICULARS', c3, top);
  let py = top + 5;
  const par = (k, v) => {
    T(k, c3, py, { size: 7, color: BLUE, bold: true });
    T(v, W - M, py, { size: 7.5, align: 'right' });
    py += 4.6;
  };
  par('Invoice No.', inv.invoiceNo);
  par('Date', inv.date);
  par('Due', inv.dueDate);
  par('Place', `${inv.place} (${inv.supplier.stateCode})`);
  par('Supply', inv.supplyLabel);

  y = Math.max(sy, ry, py) + 6;
  rule(y);
  y += 6;

  // ── Line items ───────────────────────────────────────────────────────────
  const X = {
    no: M + 2, desc: M + 10, sac: M + CW * 0.52, qty: M + CW * 0.64,
    unit: M + CW * 0.71, rate: M + CW * 0.855, disc: M + CW * 0.9, amt: W - M,
  };
  sf(BLUE); doc.rect(M, y, CW, 7, 'F');
  const hc = { color: [255, 255, 255], bold: true, size: 6.5 };
  T('S.NO', X.no, y + 4.7, hc);
  T('DESCRIPTION', X.desc, y + 4.7, hc);
  T('SAC', X.sac, y + 4.7, hc);
  T('QTY', X.qty, y + 4.7, { ...hc, align: 'right' });
  T('UNIT', X.unit, y + 4.7, { ...hc, align: 'center' });
  T('RATE', X.rate, y + 4.7, { ...hc, align: 'right' });
  T('DISC', X.disc, y + 4.7, { ...hc, align: 'right' });
  T('AMOUNT', X.amt, y + 4.7, { ...hc, align: 'right' });
  y += 11;

  inv.lines.forEach((l, i) => {
    if (y > H - 95) { doc.addPage(); y = 20; }
    T(String(i + 1), X.no, y, { size: 8 });
    T(l.name.length > 50 ? l.name.slice(0, 49) + '…' : l.name, X.desc, y, { size: 8, bold: true });
    T(l.sacDesc, X.desc, y + 3.6, { size: 6.5, color: MUT });
    T(l.sacCode, X.sac, y, { size: 7.5 });
    T(String(l.qty), X.qty, y, { size: 7.5, align: 'right' });
    T(l.unit, X.unit, y, { size: 7.5, align: 'center' });
    T(rsn(l.rate), X.rate, y, { size: 7.5, align: 'right' });
    T(l.discount ? rsn(l.discount) : '—', X.disc, y, { size: 7.5, align: 'right', color: MUT });
    T(rsn(l.amount), X.amt, y, { size: 8, align: 'right', color: BLUE, bold: true });
    y += 8;
    rule(y - 2.5, 0.2);
  });

  y += 3;

  // ── Totals box (right) ───────────────────────────────────────────────────
  const bx = W - M - 78, bw = 78;
  const tot = (k, v, opt = {}) => {
    doc.setLineWidth(0.2); sd(RULE);
    doc.line(bx, y + 1.5, bx + bw, y + 1.5);
    T(k, bx + 3, y, { size: 7.5, color: opt.color || MUT });
    T(rs(v), bx + bw - 3, y, { size: 7.5, align: 'right', bold: true, color: opt.color || INK });
    y += 6;
  };
  y += 2;
  tot('Subtotal', inv.subtotal);
  if (inv.cgst) tot(`CGST @ ${inv.halfRate}%`, inv.cgst);
  if (inv.sgst) tot(`SGST @ ${inv.halfRate}%`, inv.sgst);
  if (inv.igst) tot(`IGST @ ${inv.gstRate}%`, inv.igst);
  if (Math.abs(inv.roundOff) >= 0.01) tot('Round Off', inv.roundOff);
  y += 1;
  sf(BLUE); doc.rect(bx, y - 4, bw, 9, 'F');
  T('TOTAL PAYABLE', bx + 3, y + 1.7, { color: [255, 255, 255], bold: true, size: 8 });
  T(rs(inv.payable), bx + bw - 3, y + 1.7, { color: [255, 255, 255], bold: true, size: 9, align: 'right' });
  y += 12;

  T('Amount in Words: ', M, y, { bold: true, size: 8 });
  T(inv.amountInWords, M + 28, y, { italic: true, size: 8, color: MUT, maxWidth: CW - 30 });
  y += 8;
  rule(y);
  y += 6;

  // ── Tax breakup by SAC ───────────────────────────────────────────────────
  T('TAX BREAKUP BY SAC', M, y, { bold: true, size: 7.5, color: BLUE, spread: 0.2 });
  y += 5;
  const S = { sac: M + 2, desc: M + 26, tax: M + CW * 0.44, cg: M + CW * 0.64, sg: M + CW * 0.82, t: W - M };
  const shead = { size: 6.5, color: MUT, bold: true };
  T('SAC', S.sac, y, shead);
  T('Desc', S.desc, y, shead);
  T('Taxable', S.tax, y, { ...shead, align: 'right' });
  T(inv.isInterState ? 'IGST' : `CGST@${inv.halfRate}%`, S.cg, y, { ...shead, align: 'right' });
  if (!inv.isInterState) T(`SGST@${inv.halfRate}%`, S.sg, y, { ...shead, align: 'right' });
  T('Tax', S.t, y, { ...shead, align: 'right' });
  y += 2; rule(y, 0.2); y += 4;
  inv.sacBreakup.forEach((r) => {
    T(r.sacCode, S.sac, y, { size: 7.5, bold: true });
    T(r.sacDesc, S.desc, y, { size: 7.5, color: MUT });
    T(rsn(r.taxable), S.tax, y, { size: 7.5, align: 'right' });
    T(rsn(inv.isInterState ? r.igst : r.cgst), S.cg, y, { size: 7.5, align: 'right', color: MUT });
    if (!inv.isInterState) T(rsn(r.sgst), S.sg, y, { size: 7.5, align: 'right', color: MUT });
    T(rsn(r.tax), S.t, y, { size: 7.5, align: 'right', color: BLUE, bold: true });
    y += 6;
  });
  y += 2;
  rule(y);
  y += 7;

  // ── Bank details + signatory ─────────────────────────────────────────────
  const sigTop = y;
  T('BANK DETAILS', M, y, { bold: true, size: 7.5, color: BLUE, spread: 0.2 });
  y += 5;
  T(`Beneficiary: ${inv.bank.beneficiary}`, M, y, { size: 7.5 }); y += 4;
  T(`Bank: ${inv.bank.bank}`, M, y, { size: 7.5 }); y += 4;
  T(`Branch: ${inv.bank.branch}`, M, y, { size: 7.5 }); y += 4;
  T(`PAN: ${inv.bank.pan}`, M, y, { size: 7.5 });

  let gy = sigTop;
  T(`FOR ${inv.supplier.legalName}`, W - M, gy, { bold: true, size: 7.5, color: BLUE, align: 'right' });
  const cx = W - M - 42, cyc = gy + 15;
  sd(BLUE); doc.setLineWidth(0.4);
  doc.circle(cx, cyc, 10.5); doc.circle(cx, cyc, 7.5);
  T('DIGITALLY', cx, cyc - 1.2, { align: 'center', size: 4, color: BLUE, bold: true });
  T('SIGNED', cx, cyc + 2, { align: 'center', size: 4, color: BLUE, bold: true });
  gy += 29;
  T(inv.supplier.signatory.name, W - M, gy, { bold: true, size: 8.5, align: 'right' });
  T(inv.supplier.signatory.title, W - M, gy + 4, { size: 7, color: BLUE, align: 'right' });
  T(`Date: ${inv.date}   Place: ${inv.place}`, W - M, gy + 8.5, { size: 6.5, color: MUT, align: 'right' });
  T('Digitally signed — IT Act 2000, Sec. 5', W - M, gy + 12.5, { size: 6, color: MUT, align: 'right' });

  y = Math.max(y, gy + 14) + 5;
  T(`Notes: ${inv.notes}`, M, y, { size: 7.5, color: MUT });
  y += 6;
  rule(y, 1, BLUE);
  y += 6;

  // ── Terms ────────────────────────────────────────────────────────────────
  T('TERMS & CONDITIONS', M, y, { bold: true, size: 6.5, color: MUT, spread: 0.2 });
  y += 4;
  const terms =
    '1. Payment due within 30 days. Interest @ 18% p.a. (MSMED Act, Sec. 16). 2. GST per CGST/SGST Act 2017. ' +
    'SAC/HSN per GST Tariff. 3. Rule 46 CGST Rules 2017; valid for ITC u/s 16(2)(a). 4. Reverse Charge: N/A. ' +
    '5. TDS u/s 194J/194C where applicable. 6. Form 16A within 15 days of quarter-end. 7. Retained-amount payment on IP transfer. 8. Disputes: Jaipur jurisdiction. 9. E&OE.';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); sc(MUT);
  const wrapped = doc.splitTextToSize(terms, CW);
  doc.text(wrapped, M, y);
  y += wrapped.length * 2.7 + 4;

  // ── Footer ───────────────────────────────────────────────────────────────
  const fy = H - 14;
  rule(fy - 4, 0.8, BLUE);
  T(`${inv.supplier.legalName}  |  ${inv.supplier.tradeName}  |  CIN: ${inv.supplier.cin}  |  GSTIN: ${inv.supplier.gstin}  |  PAN: ${inv.supplier.pan}`,
    W / 2, fy, { align: 'center', bold: true, size: 6 });
  T(`${inv.supplier.addressLines.join(', ')}  ·  ${inv.supplier.phone}  ·  ${inv.supplier.email}  ·  ${inv.supplier.website}`,
    W / 2, fy + 3.5, { align: 'center', size: 5.5, color: MUT });

  doc.save(`${inv.invoiceNo.replace(/[/\s]+/g, '-')}.pdf`);
}

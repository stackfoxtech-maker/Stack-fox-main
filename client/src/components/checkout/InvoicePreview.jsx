import { useMemo, useState } from 'react';
import { CheckSquare, Download, FileText } from 'lucide-react';
import { buildInvoice, inr2 } from '@lib/invoice';

// jsPDF is loaded on demand (PERF_AUDIT P0-3).
const downloadInvoicePDF = (inv) =>
  import('@lib/pdfExport').then((m) => m.exportTaxInvoicePDF(inv));

const Label = ({ children }) => (
  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1F4FA0]">{children}</div>
);

export default function InvoicePreview({ quote, account, paymentMode, onContinue, onBack }) {
  const [acknowledged, setAcknowledged] = useState({});
  const [acceptedAll, setAcceptedAll] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const inv = useMemo(
    () =>
      buildInvoice(
        quote.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
        {
          name: account.name,
          orgName: account.orgName,
          email: account.email,
          phone: account.phone,
          gstin: account.gstin,
          stateCode: account.stateCode,
        },
        { invoiceNo: quote.invoiceNumber, date: quote.createdAt },
      ),
    [quote, account],
  );

  const dueAmount =
    paymentMode === 'UPFRONT' ? Math.round(inv.payable * 0.95)
      : paymentMode === 'MILESTONE' ? Math.round(inv.payable * 0.3)
      : inv.payable;

  const allAcknowledged = quote.items.every((_, i) => acknowledged[i]);
  const canContinue = allAcknowledged && acceptedAll;

  const toggleItem = (idx) => {
    setAcknowledged((p) => ({ ...p, [idx]: !p[idx] }));
    if (acceptedAll) setAcceptedAll(false);
  };
  const toggleAll = () => {
    const next = !acceptedAll;
    setAcceptedAll(next);
    setAcknowledged(quote.items.reduce((acc, _, i) => ({ ...acc, [i]: next }), {}));
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePDF(inv);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-warm-900">
          <FileText size={18} className="text-fox-500" /> Tax Invoice
        </h2>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-warm-200 bg-white px-3.5 py-2 text-body-sm font-semibold text-warm-700 transition-colors hover:border-warm-300 hover:text-warm-900 disabled:opacity-60"
        >
          <Download size={15} /> {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      {/* ── The invoice document ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-md border border-warm-200 bg-white">
        <div className="mx-auto max-w-[820px] p-6 text-warm-800 sm:p-8" style={{ fontFeatureSettings: '"tnum"' }}>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold tracking-[0.06em] text-warm-900">{inv.supplier.legalName}</h3>
              <p className="mt-0.5 text-[13px] font-semibold text-[#1F4FA0]">{inv.supplier.tradeName}</p>
              <div className="mt-2 space-y-0.5 text-[11px] text-warm-600">
                <p>CIN: {inv.supplier.cin}</p>
                <p>GSTIN: {inv.supplier.gstin} &nbsp;·&nbsp; PAN: {inv.supplier.pan}</p>
                <p>State: {inv.supplier.stateName} ({inv.supplier.stateCode})</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block border border-[#1F4FA0] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#1F4FA0]">
                Original for Recipient
              </span>
              <div className="mt-2 text-2xl font-bold text-[#1F4FA0]">TAX INVOICE</div>
              <p className="mt-1 text-[10px] text-warm-500">Reverse Charge: N/A</p>
              <p className="text-[10px] text-warm-500">Sec. 31 CGST &nbsp;|&nbsp; Rule 46</p>
            </div>
          </div>

          <div className="my-4 h-[2px] bg-[#1F4FA0]" />

          {/* Supplier / Recipient / Particulars */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <Label>Supplier</Label>
              <p className="text-[12px] font-semibold text-warm-900">{inv.supplier.legalName}</p>
              <p className="text-[11px] text-[#1F4FA0]">{inv.supplier.tradeName}</p>
              <div className="mt-1 space-y-0.5 text-[11px] text-warm-600">
                {inv.supplier.addressLines.map((l) => <p key={l}>{l}</p>)}
                <p>Ph: {inv.supplier.phone}</p>
                <p>{inv.supplier.email}</p>
                <p>{inv.supplier.website}</p>
              </div>
            </div>
            <div>
              <Label>Recipient</Label>
              <p className="text-[12px] font-semibold text-warm-900">{inv.recipient.name}</p>
              <div className="mt-1 space-y-0.5 text-[11px] text-warm-600">
                {inv.recipient.contact && <p>Attn: {inv.recipient.contact}</p>}
                {inv.recipient.address && <p>{inv.recipient.address}</p>}
                {inv.recipient.email && <p>{inv.recipient.email}</p>}
                {inv.recipient.phone && <p>{inv.recipient.phone}</p>}
                {inv.recipient.gstin && <p>GSTIN: {inv.recipient.gstin}</p>}
                {inv.recipient.stateName && <p>State: {inv.recipient.stateName} ({inv.recipient.stateCode})</p>}
              </div>
            </div>
            <div>
              <Label>Particulars</Label>
              <dl className="space-y-1 text-[11px]">
                {[
                  ['Invoice No.', inv.invoiceNo],
                  ['Date', inv.date],
                  ['Due', inv.dueDate],
                  ['Place', `${inv.place} (${inv.supplier.stateCode})`],
                  ['Supply', inv.supplyLabel],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="font-semibold text-[#1F4FA0]">{k}</dt>
                    <dd className="text-right text-warm-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Line items */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#1F4FA0] text-left text-[9px] font-bold uppercase tracking-wide text-white">
                  <th className="px-2 py-1.5">S.No</th>
                  <th className="px-2 py-1.5">Description</th>
                  <th className="px-2 py-1.5">SAC</th>
                  <th className="px-2 py-1.5 text-right">Qty</th>
                  <th className="px-2 py-1.5 text-center">Unit</th>
                  <th className="px-2 py-1.5 text-right">Rate</th>
                  <th className="px-2 py-1.5 text-right">Disc</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} className="border-b border-warm-100 align-top">
                    <td className="px-2 py-2 text-warm-500">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-warm-900">{l.name}</div>
                      <div className="text-[10px] text-warm-500">{l.sacDesc}</div>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{l.sacCode}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.qty}</td>
                    <td className="px-2 py-2 text-center">{l.unit}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{inr2(l.rate)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-warm-500">{l.discount ? inr2(l.discount) : '—'}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-[#1F4FA0]">{inr2(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-[300px] text-[12px]">
              <div className="flex justify-between border-b border-warm-100 py-1.5">
                <span className="text-warm-500">Subtotal</span>
                <span className="font-semibold tabular-nums">{inr2(inv.subtotal)}</span>
              </div>
              {!inv.isInterState && (
                <>
                  <div className="flex justify-between border-b border-warm-100 py-1.5">
                    <span className="text-warm-500">CGST @ {inv.halfRate}%</span>
                    <span className="font-semibold tabular-nums">{inr2(inv.cgst)}</span>
                  </div>
                  <div className="flex justify-between border-b border-warm-100 py-1.5">
                    <span className="text-warm-500">SGST @ {inv.halfRate}%</span>
                    <span className="font-semibold tabular-nums">{inr2(inv.sgst)}</span>
                  </div>
                </>
              )}
              {inv.isInterState && (
                <div className="flex justify-between border-b border-warm-100 py-1.5">
                  <span className="text-warm-500">IGST @ {inv.gstRate}%</span>
                  <span className="font-semibold tabular-nums">{inr2(inv.igst)}</span>
                </div>
              )}
              {Math.abs(inv.roundOff) >= 0.01 && (
                <div className="flex justify-between border-b border-warm-100 py-1.5">
                  <span className="text-warm-500">Round Off</span>
                  <span className="font-semibold tabular-nums">{inr2(inv.roundOff)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between bg-[#1F4FA0] px-3 py-2 text-white">
                <span className="text-[11px] font-bold uppercase tracking-wide">Total Payable</span>
                <span className="text-base font-bold tabular-nums">{inr2(inv.payable)}</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px]">
            <span className="font-bold text-warm-900">Amount in Words: </span>
            <span className="italic text-warm-600">{inv.amountInWords}</span>
          </p>

          <div className="my-4 h-px bg-warm-200" />

          {/* SAC breakup */}
          <Label>Tax Breakup by SAC</Label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[11px]">
              <thead>
                <tr className="border-b border-warm-200 text-[9px] font-bold uppercase tracking-wide text-warm-500">
                  <th className="py-1 pr-3 text-left">SAC</th>
                  <th className="py-1 pr-3 text-left">Desc</th>
                  <th className="py-1 pr-3 text-right">Taxable</th>
                  <th className="py-1 pr-3 text-right">{inv.isInterState ? 'IGST' : `CGST@${inv.halfRate}%`}</th>
                  {!inv.isInterState && <th className="py-1 pr-3 text-right">SGST@{inv.halfRate}%</th>}
                  <th className="py-1 text-right">Tax</th>
                </tr>
              </thead>
              <tbody>
                {inv.sacBreakup.map((r) => (
                  <tr key={r.sacCode}>
                    <td className="py-1.5 pr-3 font-semibold tabular-nums">{r.sacCode}</td>
                    <td className="py-1.5 pr-3 text-warm-500">{r.sacDesc}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{inr2(r.taxable)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-warm-500">{inr2(inv.isInterState ? r.igst : r.cgst)}</td>
                    {!inv.isInterState && <td className="py-1.5 pr-3 text-right tabular-nums text-warm-500">{inr2(r.sgst)}</td>}
                    <td className="py-1.5 text-right font-semibold tabular-nums text-[#1F4FA0]">{inr2(r.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="my-4 h-px bg-warm-200" />

          {/* Bank + signatory */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label>Bank Details</Label>
              <div className="space-y-0.5 text-[11px] text-warm-700">
                <p><span className="font-semibold text-warm-900">Beneficiary:</span> {inv.bank.beneficiary}</p>
                <p><span className="font-semibold text-warm-900">Bank:</span> {inv.bank.bank}</p>
                <p><span className="font-semibold text-warm-900">Branch:</span> {inv.bank.branch}</p>
                <p><span className="font-semibold text-warm-900">PAN:</span> {inv.bank.pan}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#1F4FA0]">For {inv.supplier.legalName}</p>
              <div className="mt-2 flex justify-end">
                <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-[#1F4FA0]/60">
                  <span className="text-center text-[7px] font-bold leading-tight text-[#1F4FA0]">DIGITALLY<br />SIGNED</span>
                </div>
              </div>
              <p className="mt-1 text-[12px] font-semibold text-warm-900">{inv.supplier.signatory.name}</p>
              <p className="text-[10px] text-[#1F4FA0]">{inv.supplier.signatory.title}</p>
              <p className="mt-1 text-[9px] text-warm-500">Date: {inv.date} · Place: {inv.place}</p>
              <p className="text-[9px] text-warm-500">Digitally signed — IT Act 2000, Sec. 5</p>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-warm-500"><span className="font-semibold text-warm-900">Notes:</span> {inv.notes}</p>

          <div className="my-4 h-px bg-warm-200" />

          <Label>Terms &amp; Conditions</Label>
          <p className="text-[9.5px] leading-relaxed text-warm-500">
            1. Payment due within 30 days. Interest @ 18% p.a. (MSMED Act, Sec. 16). 2. GST per CGST/SGST Act 2017. SAC/HSN
            per GST Tariff. 3. Rule 46 CGST Rules 2017; valid for ITC u/s 16(2)(a). 4. Reverse Charge: N/A. 5. TDS u/s
            194J/194C where applicable. 6. Form 16A within 15 days of quarter-end. 7. Retained-amount payment on IP transfer.
            8. Disputes subject to Jaipur jurisdiction. 9. E&amp;OE.
          </p>

          <div className="mt-4 h-[2px] bg-[#1F4FA0]" />
          <p className="mt-2 text-center text-[9px] font-bold text-warm-700">
            {inv.supplier.legalName} &nbsp;|&nbsp; {inv.supplier.tradeName} &nbsp;|&nbsp; CIN: {inv.supplier.cin} &nbsp;|&nbsp; GSTIN: {inv.supplier.gstin}
          </p>
          <p className="text-center text-[8px] text-warm-400">
            {inv.supplier.addressLines.join(', ')} · {inv.supplier.phone} · {inv.supplier.email}
          </p>
        </div>
      </div>

      {/* ── Acknowledgement (gates "Continue to Contract") ───────────────── */}
      <div className="rounded-md border border-warm-200 bg-white p-4">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-warm-500">
          Confirm each line before you proceed
        </div>
        <div className="space-y-1.5">
          {quote.items.map((item, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors ${
                acknowledged[i] ? 'border-sage-200 bg-sage-50' : 'border-warm-200 bg-warm-white'
              }`}
            >
              <input type="checkbox" checked={!!acknowledged[i]} onChange={() => toggleItem(i)} className="h-4 w-4 accent-fox-500" />
              <span className="flex-1 text-body-sm font-medium text-warm-800">{item.name}</span>
              <span className="price-tag text-body-sm text-warm-700">{inr2(item.price * item.quantity)}</span>
            </label>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-sm bg-warm-50 p-3">
          <input type="checkbox" checked={acceptedAll} onChange={toggleAll} className="mt-0.5 h-4 w-4 accent-fox-500" />
          <span className="text-body-sm leading-relaxed text-warm-700">
            I, <strong>{account.name || 'the undersigned'}</strong>, accept all {quote.items.length} line item(s), confirm the
            quantities, descriptions and pricing, and authorize {inv.supplier.tradeName} to proceed on payment.
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-body-sm font-medium text-warm-500 hover:text-warm-800">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden text-body-sm text-warm-500 sm:inline">
            Due now: <strong className="text-warm-800">{inr2(dueAmount)}</strong>
          </span>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={`flex items-center gap-2 rounded-pill px-6 py-2.5 text-body-sm font-semibold transition ${
              canContinue ? 'bg-fox-500 text-white hover:bg-fox-600' : 'cursor-not-allowed bg-warm-200 text-warm-400'
            }`}
          >
            <CheckSquare size={16} /> Continue to Contract
          </button>
        </div>
      </div>
    </div>
  );
}

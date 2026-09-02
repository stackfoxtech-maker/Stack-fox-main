import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@lib/api';

/**
 * Free GST Invoice Generator.
 *
 * Ports the Artwall Labs invoice platform feature set: four document types,
 * intra/inter-State + export/SEZ supply detection, per-line discounts, SAC-wise
 * tax breakup, round-off, amount-in-words and a downloadable A4 PDF. All tax
 * maths and the PDF are produced server-side by lib/gstInvoice.ts.
 */

const INV_TYPES = [
  { v: 'tax', l: 'Tax Invoice' },
  { v: 'proforma', l: 'Proforma' },
  { v: 'credit', l: 'Credit Note' },
  { v: 'debit', l: 'Debit Note' },
];

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = ['Nos', 'Hrs', 'Days', 'Weeks', 'Months', 'Projects', 'Pages', 'Screens'];

const SAC = [
  ['998314', 'IT Software Development'],
  ['998313', 'IT Infrastructure & Network'],
  ['998315', 'Hosting & IT Services'],
  ['998316', 'IT Consulting'],
  ['998361', 'Web Design & Development'],
  ['998362', 'UI/UX Design'],
  ['998364', 'AI/ML Platform Services'],
  ['998365', 'Data Analytics'],
  ['999210', 'Digital Marketing'],
  ['998399', 'Professional Technical Services'],
];

const STATES = {
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '19': 'West Bengal',
  '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala',
  '33': 'Tamil Nadu', '36': 'Telangana', '06': 'Haryana', '23': 'Madhya Pradesh',
  '03': 'Punjab', '10': 'Bihar', '21': 'Odisha', '22': 'Chhattisgarh', '05': 'Uttarakhand',
};

const fINR = (n) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function GSTInvoice() {
  const [invType, setInvType] = useState('tax');
  const [gstRate, setGstRate] = useState(18);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [poRef, setPoRef] = useState('');
  const [ewayBill, setEwayBill] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [lutRef, setLutRef] = useState('');

  const [origInvoiceNo, setOrigInvoiceNo] = useState('');
  const [origInvoiceDate, setOrigInvoiceDate] = useState('');
  const [reason, setReason] = useState('');

  const [from, setFrom] = useState({ name: '', gstin: '', pan: '', stateCode: '08', address: '', email: '' });
  const [to, setTo] = useState({ name: '', gstin: '', pan: '', stateCode: '', city: '', address: '', email: '' });

  const [lineItems, setLineItems] = useState([
    { description: '', sacCode: '998314', qty: 1, unit: 'Nos', rate: 0, discount: 0, discountType: '%' },
  ]);
  const [bank, setBank] = useState({ name: '', branch: '', account: '', ifsc: '', upi: '' });
  const [notes, setNotes] = useState('Thank you for your business.');

  const [result, setResult] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCreditDebit = invType === 'credit' || invType === 'debit';

  const supplyPreview = useMemo(() => {
    if (from.stateCode && to.stateCode && from.stateCode !== to.stateCode) return 'Inter-State — IGST';
    return 'Intra-State — CGST + SGST';
  }, [from.stateCode, to.stateCode]);

  const subtotal = useMemo(
    () =>
      lineItems.reduce((s, l) => {
        const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
        const off = l.discountType === '%' ? (gross * (Number(l.discount) || 0)) / 100 : Number(l.discount) || 0;
        return s + Math.max(0, gross - off);
      }, 0),
    [lineItems],
  );

  const setLine = (i, field, value) =>
    setLineItems((p) => p.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  const addLine = () =>
    setLineItems((p) => [
      ...p,
      { description: '', sacCode: '998314', qty: 1, unit: 'Nos', rate: 0, discount: 0, discountType: '%' },
    ]);
  const removeLine = (i) => setLineItems((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const generate = async (e) => {
    e.preventDefault();
    setError('');
    if (!from.name || !to.name) {
      setError('Supplier and recipient names are required.');
      return;
    }
    if (!lineItems.some((l) => l.description || Number(l.rate) > 0)) {
      setError('Add at least one line item.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost('/tools/invoice', {
        invoiceType: invType,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate,
        dueDate: dueDate || undefined,
        gstRate,
        placeOfSupply: to.stateCode || from.stateCode,
        reverseCharge,
        poRef: poRef || undefined,
        ewayBill: ewayBill || undefined,
        lutRef: lutRef || undefined,
        origInvoiceNo: origInvoiceNo || undefined,
        origInvoiceDate: origInvoiceDate || undefined,
        reason: reason || undefined,
        from,
        to,
        lineItems: lineItems.map((l) => ({
          description: l.description,
          sacCode: l.sacCode,
          qty: Number(l.qty) || 0,
          unit: l.unit,
          rate: Number(l.rate) || 0,
          discount: Number(l.discount) || 0,
          discountType: l.discountType,
        })),
        bank,
        notes: notes || undefined,
      });
      setResult(res.data.invoice);
      setPdf(res.data.pdfBase64 || null);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate the invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!pdf) return;
    const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(result?.invoiceNumber || 'invoice').replace(/[^\w-]+/g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <p className="text-sm text-orange-600 font-semibold mb-2">Free Tool · Powered by StackFox</p>
      <h1 className="text-4xl font-bold mb-3">Free GST Invoice Generator</h1>
      <p className="text-gray-600 mb-8">
        Tax invoice, proforma, credit &amp; debit notes. Auto CGST+SGST / IGST detection, per-line
        discounts, SAC-wise tax breakup, round-off, amount in words and a print-ready PDF.
      </p>

      <form onSubmit={generate} className="space-y-6">
        {/* Type + rate */}
        <div className="bg-white border rounded-2xl p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {INV_TYPES.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setInvType(t.v)}
                className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-colors ${
                  invType === t.v
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-orange-500'
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Invoice number (auto if blank)">
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Invoice date">
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="GST rate">
              <select value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} className={inputCls}>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <Field label="PO / Reference">
              <input value={poRef} onChange={(e) => setPoRef(e.target.value)} className={inputCls} />
            </Field>
            <Field label="E-Way Bill">
              <input value={ewayBill} onChange={(e) => setEwayBill(e.target.value)} className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mt-6">
              <input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} />
              Reverse charge (Sec 9(3)/9(4))
            </label>
          </div>
          {isCreditDebit && (
            <div className="grid md:grid-cols-3 gap-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <Field label="Original invoice no.">
                <input value={origInvoiceNo} onChange={(e) => setOrigInvoiceNo(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Original date">
                <input type="date" value={origInvoiceDate} onChange={(e) => setOrigInvoiceDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Reason">
                <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
              </Field>
            </div>
          )}
        </div>

        {/* Parties */}
        <div className="grid md:grid-cols-2 gap-6">
          {[
            ['Supplier (From)', from, setFrom, true],
            ['Recipient (To)', to, setTo, false],
          ].map(([title, party, setParty, isFrom]) => (
            <div key={title} className="bg-white border rounded-2xl p-6">
              <h3 className="font-bold mb-3">{title}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Name">
                    <input value={party.name} onChange={(e) => setParty({ ...party, name: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="GSTIN">
                  <input value={party.gstin} onChange={(e) => setParty({ ...party, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" className={inputCls} />
                </Field>
                <Field label="PAN">
                  <input value={party.pan} onChange={(e) => setParty({ ...party, pan: e.target.value })} className={inputCls} />
                </Field>
                <Field label="State">
                  <select value={party.stateCode} onChange={(e) => setParty({ ...party, stateCode: e.target.value })} className={inputCls}>
                    <option value="">— select —</option>
                    {Object.entries(STATES).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v}</option>
                    ))}
                  </select>
                </Field>
                {!isFrom && (
                  <Field label="City">
                    <input value={party.city || ''} onChange={(e) => setParty({ ...party, city: e.target.value })} className={inputCls} />
                  </Field>
                )}
                <div className="col-span-2">
                  <Field label="Address">
                    <input value={party.address} onChange={(e) => setParty({ ...party, address: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Email">
                    <input value={party.email} onChange={(e) => setParty({ ...party, email: e.target.value })} className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-500">
          Detected supply: <span className="text-orange-600">{supplyPreview}</span>
        </p>

        {/* Line items */}
        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Services / Goods</h3>
            <button type="button" onClick={addLine} className="text-sm text-orange-600 font-semibold hover:underline">
              + Add line item
            </button>
          </div>
          <div className="space-y-3">
            {lineItems.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
                <div className="col-span-12 md:col-span-4">
                  <Field label={`#${i + 1} Description`}>
                    <input value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Field label="SAC/HSN">
                    <select value={l.sacCode} onChange={(e) => setLine(i, 'sacCode', e.target.value)} className={inputCls}>
                      {SAC.map(([c, d]) => (
                        <option key={c} value={c}>{c} — {d}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <Field label="Qty">
                    <input type="number" min="0" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <Field label="Unit">
                    <select value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} className={inputCls}>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Field label="Rate ₹">
                    <input type="number" min="0" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <Field label="Disc">
                    <input type="number" min="0" value={l.discount} onChange={(e) => setLine(i, 'discount', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <Field label="Type">
                    <select value={l.discountType} onChange={(e) => setLine(i, 'discountType', e.target.value)} className={inputCls}>
                      <option value="%">%</option>
                      <option value="flat">₹</option>
                    </select>
                  </Field>
                </div>
                <div className="col-span-12 md:col-span-12 flex justify-end">
                  <button type="button" onClick={() => removeLine(i)} className="text-xs text-gray-400 hover:text-red-500">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-right font-bold text-lg">Subtotal: {fINR(subtotal)}</div>
        </div>

        {/* Bank + notes */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-6">
            <h3 className="font-bold mb-3">Bank details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['name', 'Bank'],
                ['branch', 'Branch'],
                ['account', 'A/C No.'],
                ['ifsc', 'IFSC'],
                ['upi', 'UPI'],
              ].map(([k, lbl]) => (
                <Field key={k} label={lbl}>
                  <input value={bank[k]} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} className={inputCls} />
                </Field>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded-2xl p-6">
            <h3 className="font-bold mb-3">Notes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} className={`${inputCls} resize-y`} />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate Invoice'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {result && (
        <div className="bg-[#FAFAF8] border rounded-2xl p-8 mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-bold">{result.invoiceTypeLabel}</h2>
              <p className="text-sm text-gray-500">
                {result.invoiceNumber} · {result.invoiceDate} · {result.supplyLabel}
              </p>
            </div>
            {pdf && (
              <button onClick={downloadPdf} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">
                ⬇ Download PDF
              </button>
            )}
          </div>

          {result.warnings?.length > 0 && (
            <ul className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 list-disc list-inside space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">#</th>
                  <th>Description</th>
                  <th>SAC</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{i + 1}</td>
                    <td>{l.description || '—'}</td>
                    <td>{l.sacCode}</td>
                    <td className="text-right">{l.qty} {l.unit}</td>
                    <td className="text-right">{fINR(l.rate)}</td>
                    <td className="text-right font-semibold">{fINR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-72 text-sm space-y-1">
              <Row l="Subtotal" v={fINR(result.subtotal)} />
              {result.cgst > 0 && <Row l={`CGST @ ${result.effectiveGstRate / 2}%`} v={fINR(result.cgst)} />}
              {result.sgst > 0 && <Row l={`SGST @ ${result.effectiveGstRate / 2}%`} v={fINR(result.sgst)} />}
              {result.igst > 0 && <Row l={`IGST @ ${result.effectiveGstRate}%`} v={fINR(result.igst)} />}
              {Math.abs(result.roundOff) > 0.001 && <Row l="Round off" v={result.roundOff.toFixed(2)} />}
              <div className="flex justify-between font-bold text-base bg-orange-500 text-white rounded-lg px-3 py-2 mt-2">
                <span>Payable</span>
                <span>{fINR(result.payable)}</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3 italic">{result.amountInWords}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/builder" className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">
              Build Your Website Too
            </Link>
            <Link to="/catalog" className="px-5 py-2.5 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">
              Browse Services
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ l, v }) {
  return (
    <div className="flex justify-between border-b border-gray-200 py-1">
      <span className="text-gray-500">{l}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}

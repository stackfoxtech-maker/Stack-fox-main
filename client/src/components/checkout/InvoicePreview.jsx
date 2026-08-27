import { useState } from 'react';
import { CheckSquare, FileText, Printer, Mail, Phone, MapPin } from 'lucide-react';
import { formatINR } from '@lib/utils';

const STACKFOX = {
  name: 'StackFox Technologies',
  tagline: 'Smart Code, Swift Delivery',
  address: 'Artwall Labs, Jaipur, Rajasthan, India',
  gstin: '27AAACS1234A1Z5',
  email: 'hello@stackfox.in',
  phone: '+91 82093 95894',
  sacCode: '998314',
};

export default function InvoicePreview({ quote, account, paymentMode, onContinue, onBack }) {
  const [acknowledged, setAcknowledged] = useState({});
  const [acceptedAll, setAcceptedAll] = useState(false);

  const subtotal = quote.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const gstAmount = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + gstAmount;
  const dueAmount = paymentMode === 'UPFRONT' ? Math.round(grandTotal * 0.95)
    : paymentMode === 'MILESTONE' ? Math.round(grandTotal * 0.3)
    : grandTotal;

  const allAcknowledged = quote.items.every((_, i) => acknowledged[i]);
  const canContinue = allAcknowledged && acceptedAll;

  const toggleItem = (idx) => {
    setAcknowledged((prev) => ({ ...prev, [idx]: !prev[idx] }));
    if (acceptedAll) setAcceptedAll(false);
  };

  const toggleAll = () => {
    const next = !acceptedAll;
    setAcceptedAll(next);
    setAcknowledged(
      quote.items.reduce((acc, _, i) => ({ ...acc, [i]: next }), {})
    );
  };

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNumber = `SF-INV-${String(Date.now()).slice(-8)}`;

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-warm-900 flex items-center gap-2">
        <FileText size={18} className="text-fox-500" /> Invoice Preview
      </h2>

      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
        {/* Header */}
        <div className="bg-warm-900 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-black tracking-tight">{STACKFOX.name}</h3>
              <p className="text-warm-400 text-xs mt-0.5">{STACKFOX.tagline}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-warm-300">
                <span className="flex items-center gap-1"><MapPin size={10} /> {STACKFOX.address}</span>
                <span className="flex items-center gap-1"><Mail size={10} /> {STACKFOX.email}</span>
                <span className="flex items-center gap-1"><Phone size={10} /> {STACKFOX.phone}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-warm-400 uppercase tracking-widest">Invoice</div>
              <div className="text-sm font-bold font-mono">{invoiceNumber}</div>
              <div className="text-[11px] text-warm-400 mt-1">Dated: {today}</div>
              <div className="text-[11px] text-warm-400">Due: {dueDate}</div>
            </div>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-2 border-b border-warm-100">
          <div className="p-5 border-r border-warm-100">
            <div className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-2">Bill To</div>
            <div className="text-sm font-semibold text-warm-900">{account.name || 'Client'}</div>
            <div className="text-xs text-warm-500 mt-0.5">{account.email || '—'}</div>
            <div className="text-xs text-warm-500">{account.phone || '—'}</div>
            {account.orgName && <div className="text-xs text-warm-500 mt-1">{account.orgName}</div>}
            {account.gstin && <div className="text-xs text-warm-500">GSTIN: {account.gstin}</div>}
          </div>
          <div className="p-5">
            <div className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-2">Ship / Service To</div>
            <div className="text-sm font-semibold text-warm-900">{account.orgName || account.name || 'Client'}</div>
            <div className="text-xs text-warm-500 mt-0.5">{account.email || '—'}</div>
            <div className="text-xs text-warm-500">{account.phone || '—'}</div>
            <div className="text-xs text-warm-500 mt-1">Rajasthan, India</div>
          </div>
        </div>

        {/* Line Items with Acknowledgment */}
        <div className="p-5">
          <div className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-3">Services & Acknowledgement</div>
          <div className="space-y-2">
            {quote.items.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  acknowledged[i] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-warm-50 border-warm-100'
                }`}
              >
                <label className="flex items-center gap-2.5 cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={!!acknowledged[i]}
                    onChange={() => toggleItem(i)}
                    className="w-4 h-4 accent-fox-500"
                  />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${acknowledged[i] ? 'text-emerald-600' : 'text-warm-400'}`}>
                    {acknowledged[i] ? 'Acknowledged' : 'Pending'}
                  </span>
                </label>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-warm-900">{item.name}</div>
                  <div className="text-[11px] text-warm-500 capitalize">{item.itemType} {item.quantity > 1 && `· Qty: ${item.quantity}`}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-bold text-warm-900">{formatINR(item.price * item.quantity)}</div>
                  {item.quantity > 1 && <div className="text-[10px] text-warm-400">{formatINR(item.price)}/ea</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="px-5 pb-5">
          <div className="bg-warm-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">Subtotal</span>
              <span className="font-mono text-warm-800">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">GST (18%)</span>
              <span className="font-mono text-warm-700">{formatINR(gstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">SAC Code</span>
              <span className="font-mono text-warm-600">{STACKFOX.sacCode}</span>
            </div>
            <div className="border-t border-warm-200 pt-2 flex justify-between">
              <span className="text-base font-bold text-warm-900">Grand Total</span>
              <span className="font-mono text-fox-500 text-lg font-black">{formatINR(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-sm bg-white rounded-lg p-2.5 border border-fox-100">
              <span className="text-fox-700 font-medium">
                {paymentMode === 'UPFRONT' ? 'Due Now (5% discount)' : paymentMode === 'MILESTONE' ? 'Due Now (30% advance)' : 'Due Now (full payment)'}
              </span>
              <span className="font-mono text-fox-900 font-bold">{formatINR(dueAmount)}</span>
            </div>
          </div>
        </div>

        {/* Master Acknowledgment */}
        <div className="px-5 pb-5">
          <div className={`p-4 rounded-xl border-2 transition-colors ${acceptedAll ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-200'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedAll}
                onChange={toggleAll}
                className="mt-1 w-4 h-4 accent-fox-500"
              />
              <span className="text-sm text-warm-700 leading-relaxed">
                I, <strong>{account.name || 'the undersigned'}</strong>, acknowledge and accept <strong>all {quote.items.length} service(s)</strong> listed above.
                I confirm the quantities, descriptions, and pricing are correct and I authorize StackFox to proceed with delivery upon payment.
              </span>
            </label>
          </div>
        </div>

        {/* Terms */}
        <div className="px-5 pb-5">
          <div className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-2">Terms & Notes</div>
          <div className="text-[11px] text-warm-500 leading-relaxed space-y-1">
            <p>• All prices are in Indian Rupees (INR) and exclusive of applicable taxes unless stated otherwise.</p>
            <p>• Payment is due within 7 days of invoice date. Late payments incur 2% monthly interest.</p>
            <p>• Services are subject to the terms outlined in the Service Agreement and MSA.</p>
            <p>• This is a system-generated invoice. No signature required — acceptance is recorded digitally.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="text-sm text-warm-500 hover:text-warm-800 font-medium flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-2.5 rounded-xl border border-warm-200 text-warm-500 hover:bg-warm-50 transition-colors"
              title="Print invoice"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition ${
                canContinue
                  ? 'bg-fox-500 text-white hover:bg-fox-600'
                  : 'bg-warm-200 text-warm-400 cursor-not-allowed'
              }`}
            >
              <CheckSquare size={16} /> Continue to Contract
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@lib/api';

const TEMPLATES = ['Professional', 'Classic', 'Minimal'];

export default function GSTInvoice() {
  const [fromName, setFromName] = useState('');
  const [fromGstin, setFromGstin] = useState('');
  const [toName, setToName] = useState('');
  const [toGstin, setToGstin] = useState('');
  const [lineItems, setLineItems] = useState([{ desc: '', qty: 1, amount: 0 }]);
  const [template, setTemplate] = useState('Professional');
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateLine = (i, field, value) => {
    const next = [...lineItems];
    next[i][field] = field === 'qty' || field === 'amount' ? Number(value) : value;
    setLineItems(next);
  };

  const addLine = () => setLineItems((p) => [...p, { desc: '', qty: 1, amount: 0 }]);

  const generate = async (e) => {
    e.preventDefault();
    if (!fromName || !toName || lineItems.length === 0) {
      setError('Please fill from, to and at least one line item.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/tools/invoice', {
        from: { name: fromName, gstin: fromGstin },
        to: { name: toName, gstin: toGstin },
        lineItems: lineItems.filter((l) => l.desc),
        template,
      });
      setInvoice(res.data.invoice);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate invoice. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = lineItems.reduce((s, l) => s + (l.qty || 1) * (l.amount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p className="text-sm text-orange-600 font-semibold mb-2">Free Tool · Powered by StackFox</p>
      <h1 className="text-4xl font-bold mb-3">Free GST Invoice Generator</h1>
      <p className="text-gray-600 mb-8">Create GST-compliant invoices with auto CGST+SGST / IGST detection. 5 free invoices/month without login.</p>

      <form onSubmit={generate} className="bg-white border rounded-2xl p-6 mb-10">
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-1">From (Your business name)</label>
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Your GSTIN</label>
            <input value={fromGstin} onChange={(e) => setFromGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">To (Client name)</label>
            <input value={toName} onChange={(e) => setToName(e.target.value)} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Client GSTIN (optional)</label>
            <input value={toGstin} onChange={(e) => setToGstin(e.target.value)} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
        </div>

        <label className="block text-sm font-semibold mb-2">Template</label>
        <div className="flex flex-wrap gap-2 mb-6">
          {TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemplate(t)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                template === t ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 text-gray-600 hover:border-orange-500 hover:text-orange-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold mb-2">Line Items</label>
        <div className="space-y-2">
          {lineItems.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={l.desc}
                onChange={(e) => updateLine(i, 'desc', e.target.value)}
                placeholder="Description (e.g. Website Development)"
                className="col-span-6 border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="number"
                min="1"
                value={l.qty}
                onChange={(e) => updateLine(i, 'qty', e.target.value)}
                className="col-span-2 border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="number"
                min="0"
                value={l.amount}
                onChange={(e) => updateLine(i, 'amount', e.target.value)}
                placeholder="Amount ₹"
                className="col-span-4 border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-sm text-orange-600 font-semibold hover:underline">+ Add line item</button>
        </div>

        <div className="mt-6 text-right font-bold text-lg">
          Subtotal: ₹{subtotal.toLocaleString('en-IN')}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors mt-4"
        >
          {loading ? 'Generating…' : 'Generate Invoice'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      {invoice && (
        <div className="bg-[#FAFAF8] border rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Your Invoice</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-xl p-4 max-h-[400px] overflow-auto">
            {JSON.stringify(invoice, null, 2)}
          </pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/builder" className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Build Your Own Website Too</Link>
            <Link to="/catalog" className="px-5 py-2.5 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">Browse Services</Link>
          </div>
        </div>
      )}
    </div>
  );
}
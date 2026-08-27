import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Receipt, Plus, Trash2 } from 'lucide-react';

export default function InvoiceGenerator() {
  usePageTitle('Invoice Generator');
  const [client, setClient] = useState({ name: '', email: '', company: '' });
  const [items, setItems] = useState([{ desc: '', qty: 1, rate: 0 }]);
  const [tax, setTax] = useState(10);

  const addItem = () => setItems([...items, { desc: '', qty: 1, rate: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: field === 'desc' ? val : Number(val) };
    setItems(next);
  };

  const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const taxAmt = subtotal * (tax / 100);
  const total = subtotal + taxAmt;

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <Receipt className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">Invoice Generator</h1>
        <p className="text-warm-600">Create professional invoices in seconds.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-warm-200 p-6">
            <h3 className="font-semibold text-warm-900 mb-4">Client Details</h3>
            <div className="space-y-3">
              <input placeholder="Client Name" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} className="w-full border border-warm-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500" />
              <input placeholder="Email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} className="w-full border border-warm-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500" />
              <input placeholder="Company" value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} className="w-full border border-warm-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-warm-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-warm-900">Line Items</h3>
              <button onClick={addItem} className="text-fox-500 hover:text-fox-600 text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Description" value={it.desc} onChange={(e) => updateItem(i, 'desc', e.target.value)} className="flex-1 border border-warm-200 rounded-lg px-3 py-2 text-sm" />
                  <input type="number" min="1" value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} className="w-16 border border-warm-200 rounded-lg px-2 py-2 text-sm text-center" />
                  <input type="number" min="0" value={it.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} className="w-24 border border-warm-200 rounded-lg px-2 py-2 text-sm" placeholder="Rate" />
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="text-warm-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <label className="text-sm text-warm-600">Tax %</label>
              <input type="number" min="0" max="100" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="w-20 border border-warm-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <div className="border-b border-warm-100 pb-4 mb-4">
            <h3 className="text-lg font-bold text-fox-500">INVOICE</h3>
            <p className="text-xs text-warm-400 mt-1">#{String(Date.now()).slice(-6)}</p>
          </div>
          <div className="text-sm mb-6">
            <p className="font-medium text-warm-900">{client.name || 'Client Name'}</p>
            <p className="text-warm-500">{client.email || 'email@example.com'}</p>
            <p className="text-warm-500">{client.company || 'Company'}</p>
          </div>
          <table className="w-full text-sm mb-6">
            <thead><tr className="text-warm-500 border-b border-warm-100"><th className="text-left py-2">Item</th><th className="text-center py-2">Qty</th><th className="text-right py-2">Amount</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-warm-50">
                  <td className="py-2 text-warm-900">{it.desc || '—'}</td>
                  <td className="py-2 text-center text-warm-700">{it.qty}</td>
                  <td className="py-2 text-right text-warm-900">${(it.qty * it.rate).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-warm-600"><span>Subtotal</span><span>${subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-warm-600"><span>Tax ({tax}%)</span><span>${taxAmt.toLocaleString()}</span></div>
            <div className="flex justify-between text-warm-900 font-bold text-lg pt-2 border-t border-warm-200"><span>Total</span><span>${total.toLocaleString()}</span></div>
          </div>
          <button className="mt-6 bg-fox-500 text-white rounded-xl px-6 py-3 hover:bg-fox-600 transition w-full">Download Invoice</button>
        </div>
      </div>
    </div>
  );
}

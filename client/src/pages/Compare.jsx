import { useState } from 'react';
import { GitCompareArrows, Plus, X } from 'lucide-react';

const allServices = [
  { id: 1, name: 'Website Development', category: 'Development', price: 45000, delivery: '15–20 days', description: 'Full-stack custom website with responsive design, CMS, and SEO.' },
  { id: 2, name: 'SEO Optimization', category: 'Marketing', price: 15000, delivery: '7–10 days', description: 'On-page/off-page SEO audit, keyword research, and implementation.' },
  { id: 3, name: 'Logo Design', category: 'Design', price: 5000, delivery: '3–5 days', description: 'Professional logo with 3 concepts, revisions, and full file delivery.' },
  { id: 4, name: 'Mobile App Development', category: 'Development', price: 120000, delivery: '30–45 days', description: 'Cross-platform React Native app with UI/UX and store submission.' },
  { id: 5, name: 'Social Media Marketing', category: 'Marketing', price: 20000, delivery: '5–7 days', description: 'Strategy, content calendar, and management for 3 platforms.' },
  { id: 6, name: 'Brand Identity', category: 'Design', price: 25000, delivery: '10–14 days', description: 'Complete branding: logo, colors, typography, and brand guidelines.' },
];

const rows = [
  { label: 'Price', key: 'price', render: v => `₹${v.toLocaleString()}` },
  { label: 'Delivery Time', key: 'delivery' },
  { label: 'Category', key: 'category' },
  { label: 'Description', key: 'description' },
];

export default function Compare() {
  const [selected, setSelected] = useState([1, 2]);

  const addSlot = () => { if (selected.length < 4) setSelected([...selected, 0]); };
  const removeSlot = (i) => setSelected(selected.filter((_, idx) => idx !== i));
  const changeSlot = (i, id) => { const next = [...selected]; next[i] = Number(id); setSelected(next); };

  const services = selected.map(id => allServices.find(s => s.id === id) || null);

  return (
    <div className="min-h-screen bg-warm-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-warm-900 mb-2 flex items-center gap-3">
          <GitCompareArrows className="text-fox-500" /> Compare Services
        </h1>
        <p className="text-warm-500 mb-8">Select 2 to 4 services to compare side by side.</p>

        <div className="bg-white rounded-2xl border border-warm-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200">
                <th className="text-left p-4 text-warm-500 font-medium w-36">Feature</th>
                {selected.map((id, i) => (
                  <th key={i} className="p-4 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <select value={id} onChange={e => changeSlot(i, e.target.value)} className="flex-1 border border-warm-200 rounded-lg px-3 py-2 text-sm font-medium text-warm-900 focus:outline-none focus:ring-2 focus:ring-fox-500/30 bg-white">
                        <option value={0}>Select service</option>
                        {allServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {selected.length > 2 && (
                        <button onClick={() => removeSlot(i)} className="text-warm-400 hover:text-red-500"><X size={16} /></button>
                      )}
                    </div>
                  </th>
                ))}
                {selected.length < 4 && (
                  <th className="p-4">
                    <button onClick={addSlot} className="flex items-center gap-1 text-fox-500 text-sm font-medium hover:text-fox-600">
                      <Plus size={16} /> Add
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className="border-b border-warm-100 last:border-0">
                  <td className="p-4 font-medium text-warm-700">{row.label}</td>
                  {services.map((s, i) => (
                    <td key={i} className="p-4 text-warm-600">
                      {s ? (row.render ? row.render(s[row.key]) : s[row.key]) : <span className="text-warm-300">—</span>}
                    </td>
                  ))}
                  {selected.length < 4 && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

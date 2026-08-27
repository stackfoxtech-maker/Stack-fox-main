import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Calculator, Check } from 'lucide-react';

const services = {
  'Design': [
    { id: 'ui', label: 'UI/UX Design', price: 2500 },
    { id: 'brand', label: 'Brand Identity', price: 1800 },
    { id: 'proto', label: 'Prototype', price: 1200 },
  ],
  'Development': [
    { id: 'frontend', label: 'Frontend Development', price: 4000 },
    { id: 'backend', label: 'Backend / API', price: 5000 },
    { id: 'mobile', label: 'Mobile App', price: 8000 },
    { id: 'cms', label: 'CMS Integration', price: 2000 },
  ],
  'Marketing': [
    { id: 'seo', label: 'SEO Optimization', price: 1500 },
    { id: 'analytics', label: 'Analytics Setup', price: 800 },
    { id: 'content', label: 'Content Strategy', price: 2000 },
  ],
};

const tiers = [
  { name: 'Starter', mult: 1, desc: 'Essential features, standard timeline' },
  { name: 'Growth', mult: 1.5, desc: 'Extended scope, priority support' },
  { name: 'Premium', mult: 2.2, desc: 'Full-service, dedicated team' },
];

export default function InstantEstimate() {
  usePageTitle('Instant Estimate');
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const base = Object.values(services).flat().filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <Calculator className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">Instant Estimate</h1>
        <p className="text-warm-600">Select services to get an instant project estimate.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {Object.entries(services).map(([cat, items]) => (
          <div key={cat} className="bg-white rounded-2xl border border-warm-200 p-6">
            <h3 className="font-semibold text-warm-900 mb-4">{cat}</h3>
            <div className="space-y-3">
              {items.map((s) => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${selected.has(s.id) ? 'bg-fox-500 border-fox-500' : 'border-warm-300'}`}>
                    {selected.has(s.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  <span className="text-sm text-warm-700 group-hover:text-warm-900">{s.label}</span>
                  <span className="text-xs text-warm-400 ml-auto">${s.price.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {base > 0 && (
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div key={t.name} className={`bg-white rounded-2xl border p-6 text-center ${t.name === 'Growth' ? 'border-fox-500 ring-2 ring-fox-500/20' : 'border-warm-200'}`}>
              {t.name === 'Growth' && <span className="text-xs font-semibold text-fox-500 uppercase tracking-wide">Popular</span>}
              <h3 className="text-lg font-bold text-warm-900 mt-1">{t.name}</h3>
              <p className="text-xs text-warm-500 mt-1 mb-4">{t.desc}</p>
              <div className="text-3xl font-bold text-warm-900">${Math.round(base * t.mult).toLocaleString()}</div>
              <button className="mt-4 bg-fox-500 text-white rounded-xl px-6 py-3 hover:bg-fox-600 transition w-full">Get Started</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

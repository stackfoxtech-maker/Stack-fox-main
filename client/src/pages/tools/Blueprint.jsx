import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Layers, Monitor, Server, Database, Cpu, Globe, ArrowRight } from 'lucide-react';

const components = [
  { id: 'cdn', label: 'CDN', icon: Globe, col: 0 },
  { id: 'frontend', label: 'Frontend', icon: Monitor, col: 1 },
  { id: 'backend', label: 'Backend API', icon: Server, col: 2 },
  { id: 'cache', label: 'Cache (Redis)', icon: Cpu, col: 3 },
  { id: 'database', label: 'Database', icon: Database, col: 4 },
];

const techOptions = {
  cdn: ['Cloudflare', 'AWS CloudFront', 'Fastly'],
  frontend: ['React', 'Next.js', 'Vue', 'Angular'],
  backend: ['Node.js', 'Python', 'Go', 'Java'],
  cache: ['Redis', 'Memcached'],
  database: ['PostgreSQL', 'MongoDB', 'MySQL', 'DynamoDB'],
};

export default function Blueprint() {
  usePageTitle('Architecture Blueprint');
  const [selected, setSelected] = useState(new Set(['frontend', 'backend', 'database']));
  const [techs, setTechs] = useState({});

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const setTech = (id, val) => setTechs({ ...techs, [id]: val });
  const activeComps = components.filter((c) => selected.has(c.id));

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <Layers className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">Architecture Blueprint</h1>
        <p className="text-warm-600">Design your tech stack visually.</p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6 mb-8">
        <h3 className="font-semibold text-warm-900 mb-4">Select Components</h3>
        <div className="flex flex-wrap gap-3">
          {components.map((c) => (
            <button key={c.id} onClick={() => toggle(c.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition ${selected.has(c.id) ? 'border-fox-500 bg-fox-500/10 text-fox-500 font-medium' : 'border-warm-200 text-warm-600 hover:border-warm-300'}`}>
              <c.icon className="w-4 h-4" /> {c.label}
            </button>
          ))}
        </div>
      </div>

      {activeComps.length > 0 && (
        <div className="bg-white rounded-2xl border border-warm-200 p-6">
          <h3 className="font-semibold text-warm-900 mb-6">Architecture Diagram</h3>
          <div className="flex items-center justify-center gap-2 flex-wrap mb-8">
            {activeComps.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-2xl bg-fox-500/10 border-2 border-fox-500 flex flex-col items-center justify-center">
                    <c.icon className="w-6 h-6 text-fox-500" />
                  </div>
                  <span className="text-xs font-medium text-warm-900">{c.label}</span>
                  <span className="text-xs text-fox-500">{techs[c.id] || '—'}</span>
                </div>
                {i < activeComps.length - 1 && <ArrowRight className="w-5 h-5 text-warm-300 mx-1" />}
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-warm-900 mb-4">Technology Choices</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {activeComps.map((c) => (
              <div key={c.id}>
                <label className="text-sm text-warm-600 mb-1 block">{c.label}</label>
                <select value={techs[c.id] || ''} onChange={(e) => setTech(c.id, e.target.value)} className="w-full border border-warm-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500">
                  <option value="">Choose...</option>
                  {techOptions[c.id].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>

          <button className="mt-6 bg-fox-500 text-white rounded-xl px-6 py-3 hover:bg-fox-600 transition w-full">Export Blueprint</button>
        </div>
      )}
    </div>
  );
}

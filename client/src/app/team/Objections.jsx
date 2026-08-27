import { useState } from 'react';
import { MessageSquare, Search, Copy } from 'lucide-react';
import { Button, Input, Badge } from '@components/ui/Primitives';
import { objectionKeys, genericObjections, businessCategories, pitchLibrary } from '@data/salesPitchLibrary';
import { toast } from 'react-hot-toast';

export default function Objections() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');

  const getResponse = (key) => {
    if (selectedCategory && pitchLibrary[selectedCategory]?.objections?.[key]) {
      return pitchLibrary[selectedCategory].objections[key];
    }
    return genericObjections[key];
  };

  const filtered = objectionKeys.filter(o => {
    if (!search) return true;
    return o.label.toLowerCase().includes(search.toLowerCase()) || getResponse(o.id).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Objection Handling</h2>
        <p className="text-warm-500 text-sm mt-1">Quick responses to common client objections</p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">Filter by Category (Optional)</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="input-fx">
              <option value="">All Categories</option>
              {businessCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.group} — {cat.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search objections..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((obj) => (
          <div key={obj.id} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-sm transition">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-xl bg-warning-50 text-warning-600 flex-shrink-0">
                <MessageSquare size={18} />
              </div>
              <div>
                <Badge variant="warning">Objection</Badge>
                <h3 className="font-medium text-warm-900 mt-1">"{obj.label}"</h3>
              </div>
            </div>
            <div className="pl-11">
              <p className="text-sm text-warm-600 leading-relaxed">{getResponse(obj.id)}</p>
              <button onClick={() => { navigator.clipboard.writeText(getResponse(obj.id)); toast.success('Response copied!'); }} className="mt-2 flex items-center gap-1 text-xs text-fox-500 hover:text-fox-700 transition">
                <Copy size={12} /> Copy response
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-warm-500">No objections match your search</div>
      )}
    </div>
  );
}

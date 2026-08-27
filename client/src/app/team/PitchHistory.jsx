import { useState, useMemo } from 'react';
import { TrendingUp, Trophy, Star, Copy, Share2, Filter, ChevronDown } from 'lucide-react';
import { businessCategories, getPitch } from '@data/salesPitchLibrary';
import { Button, Badge } from '@components/ui/Primitives';

const categoryColors = {
  'gym': 'badge-fox', 'restaurant': 'badge-info', 'cafe': 'badge-info', 'hotel': 'badge-info',
  'clinic': 'badge-success', 'hospital': 'badge-success', 'real-estate': 'badge-warning',
  'school': 'badge-fox', 'car-dealer': 'badge-danger', 'default': 'badge-neutral'
};

export default function PitchHistory() {
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  const history = useMemo(() => {
    try {
      const stored = localStorage.getItem('pitchHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const filtered = history.filter(h => {
    if (filterCategory && h.category !== filterCategory) return false;
    if (filterOutcome && h.outcome !== filterOutcome) return false;
    return true;
  });

  const stats = useMemo(() => {
    const byCategory = {};
    history.forEach(h => {
      if (!byCategory[h.category]) byCategory[h.category] = { total: 0, wins: 0 };
      byCategory[h.category].total++;
      if (h.outcome === 'won' || h.outcome === 'shared') byCategory[h.category].wins++;
    });
    return byCategory;
  }, [history]);

  const topCategories = Object.entries(stats)
    .sort((a, b) => b[1].wins - a[1].wins)
    .slice(0, 5);

  const sharePitch = (h) => {
    const pitch = getPitch(h.category);
    if (!pitch) return;
    const text = encodeURIComponent(pitch.shortPitch);
    window.open('https://wa.me/?text=' + text, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Pitch History & Leaderboard</h2>
        <p className="text-warm-500 text-sm mt-1">Track which pitches work best for each category</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-fox-50 text-fox-600"><TrendingUp size={20} /></div>
            <span className="text-sm text-warm-500">Total Pitches Used</span>
          </div>
          <p className="text-2xl font-bold text-warm-900">{history.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-success-50 text-success-600"><Trophy size={20} /></div>
            <span className="text-sm text-warm-500">Top Category</span>
          </div>
          <p className="text-2xl font-bold text-warm-900">{topCategories[0]?.[0]?.replace('-', ' ') || 'N/A'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-warning-50 text-warning-600"><Star size={20} /></div>
            <span className="text-sm text-warm-500">Success Rate</span>
          </div>
          <p className="text-2xl font-bold text-warm-900">{history.length > 0 ? Math.round((history.filter(h => h.outcome === 'won' || h.outcome === 'shared').length / history.length) * 100) : 0}%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-900">Category Performance</h3>
        </div>
        <div className="space-y-3">
          {topCategories.length === 0 && <p className="text-sm text-warm-500 text-center py-4">No pitch history yet. Start using pitches in Pitch Studio to see your performance here.</p>}
          {topCategories.map(([cat, data]) => (
            <div key={cat} className="flex items-center gap-4 p-3 rounded-xl bg-warm-50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-warm-900 capitalize">{cat.replace('-', ' ')}</span>
                  <Badge variant={categoryColors[cat]?.replace('badge-', '') || 'neutral'}>{data.wins} wins</Badge>
                </div>
                <div className="w-full bg-warm-200 rounded-full h-2">
                  <div className="bg-fox-500 h-2 rounded-full transition-all" style={{ width: `${Math.round((data.wins / data.total) * 100)}%` }} />
                </div>
                <p className="text-xs text-warm-500 mt-1">{data.total} total uses | {Math.round((data.wins / data.total) * 100)}% success rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-900">Recent Pitch Activity</h3>
          <div className="flex items-center gap-2">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-fx text-sm">
              <option value="">All Categories</option>
              {businessCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)} className="input-fx text-sm">
              <option value="">All Outcomes</option>
              <option value="won">Won</option>
              <option value="shared">Shared</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-sm text-warm-500 text-center py-6">No pitch history yet</p>}
          {filtered.slice(-10).reverse().map((h, idx) => {
            const pitch = getPitch(h.category);
            return (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-warm-100 hover:bg-warm-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-fox-50 flex items-center justify-center text-fox-600 font-medium text-xs">
                    {pitch?.categoryName?.split(' ').map(w => w[0]).join('').slice(0, 2) || '??'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-900">{pitch?.categoryName || h.category}</p>
                    <p className="text-xs text-warm-500">{new Date(h.date).toLocaleDateString()} | Outcome: {h.outcome}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => sharePitch(h)} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-fox-500 transition">
                    <Share2 size={16} />
                  </button>
                  <Badge variant={h.outcome === 'won' || h.outcome === 'shared' ? 'success' : h.outcome === 'lost' ? 'danger' : 'neutral'}>{h.outcome}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

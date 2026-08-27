import { useEffect, useState } from 'react';
import { Handshake, Search, Filter } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';

export default function Engagements() {
  usePageTitle('Engagements');
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/engagements').then(r => {
      setEngagements(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const filtered = filter === 'all' ? engagements : engagements.filter(e => e.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-900">Engagements</h1>
        <div className="flex gap-2">
          {['all', 'ACTIVE', 'PAUSED', 'COMPLETED'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === s ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Handshake} title="No engagements" description="Active engagements will appear here." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-warm-500 text-left bg-warm-50">
                <th className="px-5 py-3">ID</th><th className="px-5 py-3">Model</th>
                <th className="px-5 py-3">Client</th><th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Start</th>
              </tr></thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-t border-warm-50 hover:bg-warm-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{e.id}</td>
                    <td className="px-5 py-3 font-medium">{e.model}</td>
                    <td className="px-5 py-3">{e.clientId || '–'}</td>
                    <td className="px-5 py-3"><Badge variant={e.status === 'ACTIVE' ? 'success' : e.status === 'PAUSED' ? 'warning' : e.status === 'COMPLETED' ? 'info' : 'neutral'}>{e.status}</Badge></td>
                    <td className="px-5 py-3 text-warm-500">{formatDate(e.executedAt || e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

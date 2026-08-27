import { useEffect, useState } from 'react';
import { Handshake, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';

const ENGAGEMENT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED'];
const PAGE_SIZES = [5, 10, 20];

const statusVariant = (status) => {
  const variant = getStatusBadge(status)?.replace('badge-', '');
  if (variant) return variant;
  if (status === 'ACTIVE') return 'success';
  if (status === 'PAUSED') return 'warning';
  if (status === 'COMPLETED') return 'info';
  return 'neutral';
};

export default function Engagements() {
  usePageTitle('Engagements');
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get('/engagements')
      .then((r) => setEngagements(r.data.data || []))
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load engagements'))
      .finally(() => setLoading(false));
  }, []);

  const setStatus = (e, status) => {
    setActionLoading(`status-${e.id}`);
    api.patch(`/engagements/${e.id}/status`, { status })
      .then(() => api.get('/engagements').then((r) => setEngagements(r.data.data || [])))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to update status'))
      .finally(() => setActionLoading(null));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error) return <EmptyState icon={Handshake} title="Something went wrong" description={error} />;

  const filtered = filter === 'all' ? engagements : engagements.filter((e) => e.status === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-900">Engagements</h1>
        <div className="flex gap-2">
          {['all', 'ACTIVE', 'PAUSED', 'COMPLETED'].map((s) => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }}
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
                <th className="px-5 py-3">Start</th><th className="px-5 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {pageItems.map((e) => (
                  <tr key={e.id} className="border-t border-warm-50 hover:bg-warm-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{e.id}</td>
                    <td className="px-5 py-3 font-medium">{e.model}</td>
                    <td className="px-5 py-3">
                      <Link to={`/app/admin/users?id=${e.clientId}`} className="text-fox-600 hover:underline">{e.clientId || '–'}</Link>
                    </td>
                    <td className="px-5 py-3"><Badge variant={statusVariant(e.status)}>{e.status}</Badge></td>
                    <td className="px-5 py-3 text-warm-500">{formatDate(e.executedAt || e.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(e)}>View</Button>
                        <Link to={`/app/admin/projects?clientId=${e.clientId}`} className="text-xs px-2 py-1 rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200">Projects</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-warm-100">
            <div className="flex items-center gap-2 text-xs text-warm-500">
              <span>Rows per page</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-warm-200 rounded-lg px-2 py-1 bg-white">
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-warm-500">Page {current} of {pages}</span>
              <Button size="sm" variant="ghost" disabled={current <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button size="sm" variant="ghost" disabled={current >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-warm-900">Engagement {selected.id}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-warm-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-warm-500">Model</div><div className="font-medium">{selected.model}</div></div>
              <div><div className="text-xs text-warm-500">Status</div><div className="font-medium">{selected.status}</div></div>
              <div><div className="text-xs text-warm-500">Client</div>
                <Link to={`/app/admin/users?id=${selected.clientId}`} className="text-fox-600 hover:underline" onClick={() => setSelected(null)}>{selected.clientId || '–'}</Link>
              </div>
              <div><div className="text-xs text-warm-500">Executed</div><div className="font-medium">{formatDate(selected.executedAt)}</div></div>
              <div><div className="text-xs text-warm-500">Created</div><div className="font-medium">{formatDate(selected.createdAt)}</div></div>
            </div>

            <div>
              <div className="text-xs text-warm-500 mb-2">Status actions</div>
              <div className="flex flex-wrap gap-2">
                {ENGAGEMENT_STATUSES.map((s) => (
                  <Button key={s} size="sm" variant={selected.status === s ? 'primary' : 'ghost'}
                    disabled={actionLoading !== null} onClick={() => setStatus(selected, s)}>
                    {actionLoading === `status-${selected.id}` ? '...' : capitalize(s.toLowerCase())}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-warm-500 mb-2">Linked projects</div>
              <Link to={`/app/admin/projects?clientId=${selected.clientId}`} onClick={() => setSelected(null)}
                className="text-fox-600 hover:underline text-sm">View associated projects &rarr;</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

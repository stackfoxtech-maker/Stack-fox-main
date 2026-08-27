import { useEffect, useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { Badge, EmptyState, Spinner } from '@components/ui/Primitives';
import { formatDate, capitalize } from '@lib/utils';
import api from '@lib/api';
import toast from 'react-hot-toast';

const statuses = ['INTAKE', 'SCORING', 'BID', 'NO_BID', 'DRAFTING', 'SUBMITTED', 'WON', 'LOST'];
const statusVariant = {
  INTAKE: 'info',
  SCORING: 'warning',
  BID: 'fox',
  NO_BID: 'neutral',
  DRAFTING: 'warning',
  SUBMITTED: 'info',
  WON: 'success',
  LOST: 'danger',
};

const statusLabel = (s) => capitalize(String(s || '').replace(/_/g, ' ').toLowerCase());

export default function RFPs() {
  const [rfps, setRfps] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/rfps')
      .then((r) => setRfps(r.data.data || r.data.items || r.data || []))
      .catch(() => toast.error('Failed to load RFPs.'))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await api.patch(`/rfps/${id}/decision`, { decision: newStatus });
      setRfps((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      toast.success(`RFP marked as ${statusLabel(newStatus)}.`);
    } catch {
      toast.error('Failed to update RFP status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = rfps.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search && !r.issuer.toLowerCase().includes(search.toLowerCase()) && !(r.org?.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-warm-900">RFP Management</h2>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by issuer or client..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-8 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fox-500/30 capitalize">
            <option value="all">All Statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No RFPs found" description="Adjust your filters or check back later." />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-4 px-6 py-3 bg-warm-50 text-xs font-semibold text-warm-500 uppercase tracking-wide">
            <span>Issuer</span><span>Client</span><span>Budget</span><span>Status</span><span>Date</span><span />
          </div>
          {filtered.map((r) => (
            <div key={r.id} className="border-t border-warm-100">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-4 px-6 py-4 items-center cursor-pointer hover:bg-warm-50/50 transition" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <span className="text-sm font-medium text-warm-900">{r.issuer}</span>
                <span className="text-sm text-warm-600">{r.org?.name || '—'}</span>
                <span className="text-sm font-mono text-warm-800">{r.budgetSignal || '—'}</span>
                <select
                  value={r.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleStatusChange(r.id, e.target.value)}
                  disabled={updatingId === r.id}
                  className="text-xs px-2 py-1 rounded-lg border border-warm-200 bg-white capitalize focus:outline-none disabled:opacity-50">
                  {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
                <span className="text-xs text-warm-500">{formatDate(r.createdAt)}</span>
                {expanded === r.id ? <ChevronUp size={16} className="text-warm-400" /> : <ChevronDown size={16} className="text-warm-400" />}
              </div>
              {expanded === r.id && (
                <div className="px-6 pb-4">
                  <div className="bg-warm-50 rounded-xl p-4 text-sm text-warm-700">
                    {r.lossReason ? <p className="mb-2"><span className="font-semibold">Loss reason:</span> {r.lossReason}</p> : null}
                    {r.deadline ? <p className="mb-2"><span className="font-semibold">Deadline:</span> {formatDate(r.deadline)}</p> : null}
                    <p className="text-xs text-warm-500">ID: {r.id}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

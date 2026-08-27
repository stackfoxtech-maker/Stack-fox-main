import { useEffect, useState } from 'react';
import { MessageSquare, Search, Filter, Loader2 } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getInitials } from '@lib/utils';
import { Spinner, Badge, EmptyState, Select } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const statusColors = { NEW: 'info', CONTACTED: 'warning', QUALIFIED: 'fox', CONVERTED: 'success', LOST: 'danger' };
const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

export default function AdminProjectWall() {
  usePageTitle('Admin Project Wall');
  const [inquiries, setInquiries] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/project-inquiries')
      .then((r) => setInquiries(r.data.data || r.data.items || r.data || []))
      .catch(() => toast.error('Failed to load project inquiries.'))
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await api.patch(`/project-inquiries/${id}/status`, { status });
      setInquiries((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
      toast.success(`Lead marked as ${capitalize(status.toLowerCase())}.`);
    } catch {
      toast.error('Failed to update lead status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = inquiries.filter((q) => {
    if (filterStatus !== 'all' && q.status !== filterStatus) return false;
    if (search && !`${q.name} ${q.company || ''} ${q.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-warm-900">Project Wall Manager</h2>
          <p className="text-sm text-warm-500">Track interest and inquiries for live projects.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, company, or email..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-8 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fox-500/30 capitalize">
            <option value="all">All Statuses</option>
            {leadStatuses.map((s) => <option key={s} value={s}>{capitalize(s.toLowerCase())}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-warm-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-warm-50 flex items-center justify-center mx-auto mb-4 text-warm-300">
            <MessageSquare size={32} />
          </div>
          <h3 className="text-lg font-bold text-warm-900">No project inquiries</h3>
          <p className="text-sm text-warm-500 max-w-sm mx-auto mt-2">
            When users click "Discuss Project" on the Project Wall, their messages will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((q) => (
            <div key={q.id} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-fox-500/10 flex items-center justify-center text-fox-500 text-xs font-bold shrink-0">
                  {getInitials(q.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-warm-900 truncate">{q.name}</h3>
                  <p className="text-[10px] text-warm-500 mt-0.5 uppercase tracking-wider truncate">{q.company || 'No company'}</p>
                </div>
                <Badge variant={statusColors[q.status] || 'neutral'}>{capitalize((q.status || '').toLowerCase())}</Badge>
              </div>

              {q.message && <p className="text-xs text-warm-600 line-clamp-3 mb-3">{q.message}</p>}

              <div className="text-[11px] text-warm-400 mb-3">
                {q.email}{q.phone ? ` · ${q.phone}` : ''}<br />
                Received {formatDate(q.createdAt)}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={q.status}
                  onChange={(e) => updateStatus(q.id, e.target.value)}
                  disabled={updatingId === q.id}
                  options={leadStatuses.map((s) => ({ value: s, label: capitalize(s.toLowerCase()) }))}
                  className="text-xs py-1.5 flex-1 capitalize disabled:opacity-50"
                />
                {updatingId === q.id && <Loader2 size={14} className="animate-spin text-warm-400" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

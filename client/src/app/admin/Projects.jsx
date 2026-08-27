import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FolderKanban, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';

const STATUSES = ['ALL', 'DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'REVIEW', 'COMPLETED', 'CANCELLED'];
const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const LIMIT = 10;

export default function AdminProjects() {
  usePageTitle('Admin Projects');
  const { id } = useParams();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(LIMIT);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: LIMIT, pages: 1 });
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (id) return;
    setLoading(true);
    setError(null);
    const params = { page, limit };
    if (statusFilter !== 'ALL') params.status = statusFilter;
    api.get('/projects', { params })
      .then((r) => {
        setProjects(r.data.data || []);
        if (r.data.meta?.pagination) setPagination(r.data.meta.pagination);
      })
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [id, statusFilter, page, limit]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.get(`/projects/${id}`)
      .then((r) => setProject(r.data.data.project))
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshProject = () => {
    api.get(`/projects/${id}`)
      .then((r) => setProject(r.data.data.project))
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load project'));
  };

  const setStatus = (status) => {
    setActionLoading(`status-${status}`);
    api.patch(`/projects/${id}/status`, { status })
      .then(() => refreshProject())
      .catch((e) => setError(e?.response?.data?.message || 'Failed to update status'))
      .finally(() => setActionLoading(null));
  };

  const approveMilestone = (n) => {
    setActionLoading(`ms-${n}`);
    api.patch(`/projects/${id}/milestones/${n}/approve`)
      .then(() => refreshProject())
      .catch((e) => setError(e?.response?.data?.message || 'Failed to approve milestone'))
      .finally(() => setActionLoading(null));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (error && !id) return <EmptyState icon={FolderKanban} title="Something went wrong" description={error} />;
  if (error && id) return <div className="bg-danger-50 text-danger-700 rounded-xl p-4 text-sm">{error}</div>;

  if (id && project) {
    const pid = project._id || project.id;
    const completed = (project.milestones || []).filter((m) => m.status === 'APPROVED').length;
    const total = (project.milestones || []).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/app/admin/projects" className="p-2 hover:bg-warm-100 rounded-lg"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-warm-900">{project.name || pid}</h2>
            <p className="text-xs text-warm-500">{pid} &middot; Service: {project.service?.name || project.serviceId}</p>
          </div>
          <Badge variant={getStatusBadge(project.status)?.replace('badge-', '')}>{capitalize((project.status || '').replace(/_/g, ' '))}</Badge>
        </div>

        <div className="bg-white rounded-xl border border-warm-200 p-4">
          <h3 className="font-semibold text-warm-900 mb-3">Status</h3>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.map((s) => (
              <Button key={s} size="sm" variant={project.status === s ? 'primary' : 'ghost'}
                disabled={actionLoading !== null} onClick={() => setStatus(s)}>
                {actionLoading === `status-${s}` ? '...' : capitalize(s.replace(/_/g, ' '))}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-warm-50 rounded-xl p-4"><div className="text-xs text-warm-500">Milestones</div><div className="font-mono font-semibold mt-1">{total}</div></div>
          <div className="bg-warm-50 rounded-xl p-4"><div className="text-xs text-warm-500">Approved</div><div className="font-mono font-semibold mt-1 text-success-700">{completed}</div></div>
          <div className="bg-warm-50 rounded-xl p-4"><div className="text-xs text-warm-500">Progress</div><div className="font-mono font-semibold mt-1">{total ? Math.round((completed / total) * 100) : 0}%</div></div>
          <div className="bg-warm-50 rounded-xl p-4"><div className="text-xs text-warm-500">Created</div><div className="font-mono font-semibold mt-1">{formatDate(project.createdAt)}</div></div>
        </div>

        <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
          <h3 className="font-semibold text-warm-900 px-5 py-4 border-b border-warm-100">Milestones</h3>
          {!project.milestones?.length ? <p className="p-5 text-sm text-warm-400">No milestones yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-warm-500 bg-warm-50">
                  <th className="px-5 py-3">#</th><th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Payment %</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th>
                </tr></thead>
                <tbody>
                  {(project.milestones || []).map((ms, i) => (
                    <tr key={ms.id || i} className="border-t border-warm-100 hover:bg-warm-50/50">
                      <td className="px-5 py-3 font-mono text-xs">{ms.number}</td>
                      <td className="px-5 py-3 font-medium">{ms.name}</td>
                      <td className="px-5 py-3 font-mono">{ms.paymentPct}%</td>
                      <td className="px-5 py-3 text-warm-500">{ms.dueDate ? formatDate(ms.dueDate) : '–'}</td>
                      <td className="px-5 py-3"><Badge variant={getStatusBadge(ms.status)?.replace('badge-', '') || 'neutral'}>{capitalize((ms.status || '').replace(/_/g, ' '))}</Badge></td>
                      <td className="px-5 py-3">
                        <Button size="sm" variant="ghost" disabled={actionLoading !== null || ms.status === 'APPROVED'}
                          onClick={() => approveMilestone(ms.number)}>
                          {actionLoading === `ms-${ms.number}` ? '...' : ms.status === 'APPROVED' ? 'Approved' : 'Approve'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const visible = q
    ? projects.filter((p) => (p.name || '').toLowerCase().includes(q) || String(p._id || p.id).toLowerCase().includes(q))
    : projects;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-warm-900">All projects</h2>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or ID..."
        className="w-full max-w-sm px-3 py-2 rounded-lg border border-warm-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fox-300"
      />
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600'}`}>
            {s === 'ALL' ? 'All' : capitalize(s.replace(/_/g, ' '))}
          </button>
        ))}
      </div>

      {visible.length === 0 ? <EmptyState icon={FolderKanban} title="No projects" /> : (
        <div className="space-y-3">
          {visible.map((p) => {
            const pid = p._id || p.id;
            return (
              <Link key={pid} to={`/app/admin/projects/${pid}`} className="block bg-white rounded-xl border border-warm-200 p-4 hover:shadow-card transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-warm-900">{p.name || pid}</p>
                    <p className="text-xs text-warm-500">{pid} &middot; {p.service?.name || p.serviceId} &middot; {formatDate(p.createdAt)}</p>
                  </div>
                  <span className="text-xs text-warm-500">{p.milestones?.length || 0} milestones</span>
                  <Badge variant={getStatusBadge(p.status)?.replace('badge-', '')}>{capitalize((p.status || '').replace(/_/g, ' '))}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-warm-500">
          Page {pagination.page} of {pagination.pages} &middot; {pagination.total} total
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
          <Button size="sm" variant="ghost" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

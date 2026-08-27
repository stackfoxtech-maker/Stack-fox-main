import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FolderKanban, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';

const STATUSES = ['ALL', 'DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'REVIEW', 'COMPLETED', 'CANCELLED'];

export default function AdminProjects() {
  usePageTitle('Admin Projects');
  const { id } = useParams();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    if (id) {
      api.get(`/projects/${id}`).then((r) => setProject(r.data.data.project)).catch(() => setProject(null)).finally(() => setLoading(false));
    } else {
      const params = { limit: 100 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      api.get('/projects', { params }).then((r) => setProjects(r.data.data || [])).catch(() => setProjects([])).finally(() => setLoading(false));
    }
  }, [id, statusFilter]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (id && project) {
    const completed = (project.milestones || []).filter((m) => m.status === 'APPROVED').length;
    const total = (project.milestones || []).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/app/admin/projects" className="p-2 hover:bg-warm-100 rounded-lg"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-warm-900">{project.name || project.id}</h2>
            <p className="text-xs text-warm-500">{project.id} &middot; Service: {project.service?.name || project.serviceId}</p>
          </div>
          <Badge variant={getStatusBadge(project.status)?.replace('badge-', '')}>{capitalize((project.status || '').replace(/_/g, ' '))}</Badge>
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
                  <th className="px-5 py-3">Payment %</th><th className="px-5 py-3">Due</th><th className="px-5 py-3">Status</th>
                </tr></thead>
                <tbody>
                  {(project.milestones || []).map((ms, i) => (
                    <tr key={ms.id || i} className="border-t border-warm-100 hover:bg-warm-50/50">
                      <td className="px-5 py-3 font-mono text-xs">{ms.number}</td>
                      <td className="px-5 py-3 font-medium">{ms.name}</td>
                      <td className="px-5 py-3 font-mono">{ms.paymentPct}%</td>
                      <td className="px-5 py-3 text-warm-500">{ms.dueDate ? formatDate(ms.dueDate) : '–'}</td>
                      <td className="px-5 py-3"><Badge variant={getStatusBadge(ms.status)?.replace('badge-', '') || 'neutral'}>{capitalize((ms.status || '').replace(/_/g, ' '))}</Badge></td>
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-warm-900">All projects</h2>
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600'}`}>
            {s === 'ALL' ? 'All' : capitalize(s.replace(/_/g, ' '))}
          </button>
        ))}
      </div>
      {projects.length === 0 ? <EmptyState icon={FolderKanban} title="No projects" /> : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/app/admin/projects/${p.id}`} className="block bg-white rounded-xl border border-warm-200 p-4 hover:shadow-card transition-shadow">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-warm-900">{p.name || p.id}</p>
                  <p className="text-xs text-warm-500">{p.id} &middot; {p.service?.name || p.serviceId} &middot; {formatDate(p.createdAt)}</p>
                </div>
                <span className="text-xs text-warm-500">{p.milestones?.length || 0} milestones</span>
                <Badge variant={getStatusBadge(p.status)?.replace('badge-', '')}>{capitalize((p.status || '').replace(/_/g, ' '))}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

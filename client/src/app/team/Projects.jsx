import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FolderKanban, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge, formatINR } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Projects() {
  usePageTitle('Team Projects');
  const { id } = useParams();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get(`/projects/${id}`).then((r) => setProject(r.data.data.project)).catch(() => toast.error('Failed to load project.')).finally(() => setLoading(false));
    } else {
      api.get('/projects').then((r) => setProjects(r.data.data || [])).catch(() => toast.error('Failed to load projects.')).finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (id && project) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/app/team/projects" className="p-2 hover:bg-warm-100 rounded-lg"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-warm-900">{project.title}</h2>
            <p className="text-xs text-warm-500">{project.projectNumber}</p>
          </div>
          <Badge variant={getStatusBadge(project.status)?.replace('badge-', '')}>{capitalize(project.status)}</Badge>
        </div>
        {project.description && <p className="text-sm text-warm-600">{project.description}</p>}
        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-3">Milestones</h3>
          {project.milestones?.map((ms, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-100 last:border-0">
              <span className="text-sm flex-1">{ms.title}</span>
              <Badge variant={getStatusBadge(ms.status)?.replace('badge-', '') || 'neutral'}>{capitalize(ms.status)}</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-warm-900">Assigned projects</h2>
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects assigned" description="You'll see projects here when assigned by an admin." />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link key={p._id} to={`/app/team/projects/${p._id}`} className="block bg-white rounded-xl border border-warm-200 p-4 hover:shadow-card transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-warm-900">{p.title}</p>
                  <p className="text-xs text-warm-500">{p.projectNumber} · {formatDate(p.createdAt)}</p>
                </div>
                <Badge variant={getStatusBadge(p.status)?.replace('badge-', '')}>{capitalize(p.status)}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

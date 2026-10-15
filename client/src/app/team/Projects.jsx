import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FolderKanban, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Badge, EmptyState, PanelSkeleton } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';
import MilestoneActions from '@components/project/MilestoneActions';
import ChangeRequestsPanel from '@components/project/ChangeRequestsPanel';

export default function Projects() {
  usePageTitle('Team Projects');
  const { id } = useParams();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  // Staff were shown every client's project under "assigned to you". Default to the
  // ones they run, with a switch for the full list.
  const [mine, setMine] = useState(true);

  const reloadProject = () =>
    api
      .get(`/projects/${id}`)
      .then((r) => setProject(r.data.data.project))
      .catch(() => toast.error('Failed to load project.'));

  useEffect(() => {
    setLoading(true);
    if (id) {
      api
        .get(`/projects/${id}`)
        .then((r) => setProject(r.data.data.project))
        .catch(() => toast.error('Failed to load project.'))
        .finally(() => setLoading(false));
    } else {
      api
        .get('/projects', { params: mine ? { mine: 1 } : {} })
        .then((r) => setProjects(r.data.data || []))
        .catch(() => toast.error('Failed to load projects.'))
        .finally(() => setLoading(false));
    }
  }, [id, mine]);

  if (loading) return <PanelSkeleton variant="list" />;

  if (id && project) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/app/team/projects" className="p-2 hover:bg-warm-100 rounded-lg">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-warm-900">
              {project.name || project.title || project.service?.name || project.id}
            </h2>
            <p className="text-xs text-warm-500">{project.projectNumber || project.id}</p>
          </div>
          <Badge variant={getStatusBadge(project.status)?.replace('badge-', '')}>
            {capitalize(project.status)}
          </Badge>
        </div>
        {project.description && <p className="text-sm text-warm-600">{project.description}</p>}
        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-3">Milestones</h3>
          {project.milestones?.map((ms, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 border-b border-warm-100 last:border-0"
            >
              <span className="text-sm flex-1">{ms.name || ms.title}</span>
              <Badge variant={getStatusBadge(ms.status)?.replace('badge-', '') || 'neutral'}>
                {capitalize((ms.status || '').replace(/_/g, ' ').toLowerCase())}
              </Badge>
              <MilestoneActions projectId={project.id} milestone={ms} onChanged={reloadProject} />
            </div>
          ))}
        </div>
        <ChangeRequestsPanel project={project} onChanged={reloadProject} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Projects</h2>
        <div className="inline-flex rounded-pill border border-warm-200 p-0.5 text-xs">
          {[
            [true, 'My projects'],
            [false, 'All projects'],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setMine(value)}
              className={`rounded-pill px-3 py-1.5 font-medium ${
                mine === value ? 'bg-fox-500 text-white' : 'text-warm-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={mine ? 'No projects assigned to you' : 'No projects yet'}
          description={
            mine
              ? "Projects appear here once an admin or senior PM makes you the project manager. Switch to 'All projects' to look around."
              : 'Projects appear here when a client completes checkout.'
          }
        />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link
              key={p._id}
              to={`/app/team/projects/${p._id}`}
              className="block bg-white rounded-xl border border-warm-200 p-4 hover:shadow-card transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-warm-900">
                    {p.name || p.title || p.service?.name || p.id}
                  </p>
                  <p className="text-xs text-warm-500">
                    {p.projectNumber || p.id} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <Badge variant={getStatusBadge(p.status)?.replace('badge-', '')}>
                  {capitalize(p.status)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

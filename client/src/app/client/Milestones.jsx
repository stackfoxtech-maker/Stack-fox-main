import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@lib/utils';
import { Spinner, EmptyState, Badge } from '@components/ui/Primitives';
import api from '@lib/api';

const statusColors = {
  UPCOMING: 'gray',
  IN_PROGRESS: 'orange',
  IN_REVIEW: 'blue',
  APPROVED: 'green',
  REVISION: 'yellow',
};

const statusLabels = {
  UPCOMING: 'Upcoming',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  REVISION: 'Revision',
};

const badgeVariants = {
  UPCOMING: 'neutral',
  IN_PROGRESS: 'warning',
  IN_REVIEW: 'info',
  APPROVED: 'success',
  REVISION: 'warning',
};

export default function Milestones() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/projects', { params: { limit: 10 } })
      .then((r) => {
        const projData = r.data.data || r.data.items || r.data || [];
        setProjects(projData);
        if (projData.length > 0) setSelectedProjectId(projData[0]._id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    api.get(`/projects/${selectedProjectId}/milestones`)
      .then((r) => setMilestones(r.data.data || r.data.items || r.data || []))
      .catch(() => setError(true));
  }, [selectedProjectId]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (error || projects.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm font-semibold text-orange-600 mb-2">G2 · Milestone Tracker</p>
        <h1 className="text-2xl font-bold mb-6">Project Milestones</h1>
        <EmptyState title="No projects yet" description="Milestones will appear here once your project is set up." />
        <div className="mt-8">
          <Link to="/app/client/projects" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">← Back to projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <p className="text-sm font-semibold text-orange-600 mb-2">G2 · Milestone Tracker</p>
      <h1 className="text-2xl font-bold mb-6">Project Milestones</h1>

      {projects.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-warm-700 mb-1.5">Select Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full border border-warm-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30"
          >
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name || p.id}</option>
            ))}
          </select>
        </div>
      )}

      <p className="text-gray-600 mb-6">Real-time progress against your project plan.</p>
      <div className="space-y-4">
        {milestones.map((m) => {
          const status = (m.status || m.statusKey || '').toUpperCase();
          const color = statusColors[status] || 'gray';
          const variant = badgeVariants[status] || 'neutral';
          return (
            <div key={m._id || m.id} className="border rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${color === 'gray' ? 'bg-gray-400' : color === 'orange' ? 'bg-orange-500' : color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div>
                  <div className="font-medium">{m.name || m.title}</div>
                  <div className="text-xs text-gray-500">ID: {m._id || m.id}</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={variant}>{statusLabels[status] || status}</Badge>
                <div className="text-xs text-gray-500 mt-1">{m.dueDate || m.date ? formatDate(m.dueDate || m.date) : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <Link to="/app/client/projects" className="px-4 py-2 text-sm text-orange-600 font-semibold hover:underline">← Back to projects</Link>
      </div>
    </div>
  );
}

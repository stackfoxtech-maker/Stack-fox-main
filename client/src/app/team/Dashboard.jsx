import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  usePageTitle('Team Dashboard');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks/my').then((r) => setTasks(r.data.data?.tasks || [])).catch(() => toast.error('Failed to load tasks.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const todo = tasks.filter((t) => t.status === 'todo');
  const inProgress = tasks.filter((t) => t.status === 'in-progress');
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');

  return (
    <div className="space-y-6">
      <h2 className="text-display-sm text-warm-900">My tasks</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <div className="flex items-center gap-3 mb-1"><CheckSquare size={18} className="text-info-500" /><span className="text-xs text-warm-500">To do</span></div>
          <div className="text-2xl font-bold font-mono text-warm-900">{todo.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <div className="flex items-center gap-3 mb-1"><Clock size={18} className="text-warning-500" /><span className="text-xs text-warm-500">In progress</span></div>
          <div className="text-2xl font-bold font-mono text-warm-900">{inProgress.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <div className="flex items-center gap-3 mb-1"><AlertTriangle size={18} className="text-danger-500" /><span className="text-xs text-warm-500">Overdue</span></div>
          <div className="text-2xl font-bold font-mono text-danger-500">{overdue.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-900">Active tasks</h3>
          <Link to="/app/team/tasks" className="text-xs text-fox-500 hover:underline flex items-center gap-1">All tasks <ArrowRight size={12} /></Link>
        </div>
        {tasks.filter((t) => t.status !== 'done').length === 0 ? (
          <EmptyState icon={CheckSquare} title="All done!" description="No pending tasks right now." />
        ) : (
          <div className="space-y-2">
            {tasks.filter((t) => t.status !== 'done').slice(0, 10).map((t) => (
              <div key={t._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-warm-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warm-900 truncate">{t.title}</p>
                  <p className="text-xs text-warm-500">{t.project?.projectNumber} {t.dueDate && `· Due ${formatDate(t.dueDate)}`}</p>
                </div>
                <Badge variant={getStatusBadge(t.status)?.replace('badge-', '') || 'neutral'}>{capitalize(t.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

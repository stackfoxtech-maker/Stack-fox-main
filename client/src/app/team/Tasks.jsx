import { useEffect, useState } from 'react';
import { CheckSquare, Plus, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { capitalize, cn, formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const columnConfig = {
  backlog: { label: 'Backlog', color: 'border-warm-300' },
  todo: { label: 'To do', color: 'border-info-400' },
  'in-progress': { label: 'In progress', color: 'border-warning-500' },
  review: { label: 'Review', color: 'border-fox-500' },
  done: { label: 'Done', color: 'border-success-500' },
};

const priorityDot = { low: 'bg-warm-400', medium: 'bg-info-500', high: 'bg-warning-500', urgent: 'bg-danger-500' };

export default function Tasks() {
  usePageTitle('Tasks');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('board'); // board | list

  useEffect(() => {
    api.get('/tasks/my').then((r) => setTasks(r.data.data?.tasks || [])).catch(() => toast.error('Failed to load tasks.')).finally(() => setLoading(false));
  }, []);

  const moveTask = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: newStatus } : t));
      toast.success(`Moved to ${columnConfig[newStatus]?.label}`);
    } catch { toast.error('Update failed.'); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const columns = {};
  Object.keys(columnConfig).forEach((k) => { columns[k] = tasks.filter((t) => t.status === k); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Tasks</h2>
        <div className="flex gap-1 bg-warm-100 rounded-lg p-0.5">
          <button onClick={() => setView('board')} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', view === 'board' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500')}>Board</button>
          <button onClick={() => setView('list')} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', view === 'list' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500')}>List</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks assigned" description="Tasks will appear here when assigned to you by a project manager." />
      ) : view === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(columnConfig).map(([status, config]) => (
            <div key={status} className="min-w-[260px] w-[260px] shrink-0">
              <div className={cn('border-t-2 rounded-t-xl pt-3 pb-2 px-3 mb-2', config.color)}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-warm-700 uppercase tracking-wider">{config.label}</span>
                  <span className="text-xs text-warm-400 font-mono">{columns[status]?.length || 0}</span>
                </div>
              </div>
              <div className="space-y-2">
                {(columns[status] || []).map((task) => (
                  <div key={task._id} className="bg-white rounded-xl border border-warm-200 p-3 shadow-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', priorityDot[task.priority])} />
                      <p className="text-sm font-medium text-warm-900 leading-snug">{task.title}</p>
                    </div>
                    {task.project?.projectNumber && (
                      <p className="text-[10px] text-warm-400 mb-2">{task.project.projectNumber}</p>
                    )}
                    {task.dueDate && (
                      <p className={cn('text-[10px]', new Date(task.dueDate) < new Date() ? 'text-danger-500' : 'text-warm-400')}>
                        Due {formatDate(task.dueDate)}
                      </p>
                    )}
                    {/* Quick move buttons */}
                    <div className="flex gap-1 mt-2">
                      {Object.keys(columnConfig).filter((s) => s !== status).slice(0, 2).map((s) => (
                        <button key={s} onClick={() => moveTask(task._id, s)} className="text-[10px] text-fox-500 hover:underline">
                          {columnConfig[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t._id} className="bg-white rounded-xl border border-warm-200 p-4 flex items-center gap-3">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', priorityDot[t.priority])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900 truncate">{t.title}</p>
                <p className="text-xs text-warm-500">{t.project?.projectNumber} {t.dueDate && `· ${formatDate(t.dueDate)}`}</p>
              </div>
              <Badge variant={cn(t.status === 'done' ? 'success' : t.status === 'in-progress' ? 'warning' : 'neutral')}>{capitalize(t.status)}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

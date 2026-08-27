import { useEffect, useState } from 'react';
import { FolderOpen, CheckCircle2, Users, Clock, FileText, ListTodo, LayoutDashboard } from 'lucide-react';
import { Badge, Spinner, EmptyState } from '@components/ui/Primitives';
import { formatDate, timeAgo, getInitials, getAvatarColor } from '@lib/utils';
import api from '@lib/api';

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'files', label: 'Files', icon: FileText },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'team', label: 'Team', icon: Users },
];

const statusColors = { todo: 'info', in_progress: 'warning', done: 'success' };
const statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

export default function Workspace() {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [files, setFiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, evRes, fileRes, taskRes] = await Promise.all([
          api.get('/projects', { params: { limit: 1 } }),
          api.get('/events', { params: { limit: 10 } }),
          api.get('/files', { params: { limit: 10 } }),
          api.get('/tasks/my'),
        ]);

        const projects = projRes.data.data || projRes.data.items || [];
        const firstProject = projects[0];

        setProgress(firstProject?.progress || 0);

        const evData = evRes.data.data || evRes.data.items || [];
        setEvents(evData.map((e) => ({
          id: e._id,
          text: e.action || e.title || 'Activity',
          time: timeAgo(e.createdAt),
          user: e.actor?.name || e.user?.name || 'Unknown',
        })));

        setFiles(fileRes.data.data || fileRes.data.items || []);

        const taskRaw = taskRes.data.data || taskRes.data;
        const taskData = taskRaw?.tasks || taskRaw?.items || (Array.isArray(taskRaw) ? taskRaw : []);
        setTasks(taskData.map((t) => ({
          id: t._id,
          name: t.title || t.name,
          status: t.status,
          assignee: t.assignee?.name || t.assigneeName || 'Unassigned',
        })));

        const uniqueAssignees = [...new Map(
          taskData.filter((t) => t.assignee).map((t) => [t.assignee._id || t.assignee.name, t.assignee])
        ).values()];
        setTeam(uniqueAssignees.map((a) => ({
          name: a.name,
          role: a.role || a.title || 'Team Member',
        })));
      } catch {
        setProgress(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Project Workspace</h2>
        <Badge variant="info">In Progress</Badge>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-warm-700">Overall Progress</span>
          <span className="text-sm font-bold text-fox-500">{progress}%</span>
        </div>
        <div className="w-full bg-warm-100 rounded-full h-2.5">
          <div className="bg-fox-500 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex gap-1 bg-warm-50 rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white text-fox-500 shadow-sm' : 'text-warm-500 hover:text-warm-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        {tab === 'overview' && (
          events.length === 0 ? (
            <EmptyState icon={Clock} title="No recent activity" description="Activity will appear here as your team collaborates." />
          ) : (
            <div className="space-y-3">
              <h3 className="font-medium text-warm-900 text-sm mb-3">Recent Activity</h3>
              {events.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <Clock size={14} className="text-warm-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-warm-800">{a.text}</p>
                    <p className="text-xs text-warm-400">{a.user} · {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'files' && (
          files.length === 0 ? (
            <EmptyState icon={FileText} title="No files yet" description="Uploaded files will appear here." />
          ) : (
            <div className="space-y-3">
              {files.map((f) => (
                <div key={f._id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-warm-400" />
                    <span className="text-sm font-medium text-warm-800">{f.originalName || f.name}</span>
                  </div>
                  <span className="text-xs text-warm-500">{formatDate(f.createdAt)}</span>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'tasks' && (
          tasks.length === 0 ? (
            <EmptyState icon={ListTodo} title="No tasks yet" description="Assigned tasks will appear here." />
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className={t.status === 'done' ? 'text-green-500' : 'text-warm-300'} />
                    <span className="text-sm text-warm-800">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-warm-500">{t.assignee}</span>
                    <Badge variant={statusColors[t.status] || 'neutral'}>{statusLabels[t.status] || t.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'team' && (
          team.length === 0 ? (
            <EmptyState icon={Users} title="No team members" description="Team members will appear once tasks are assigned." />
          ) : (
            <div className="space-y-3">
              {team.map((m) => (
                <div key={m.name} className="flex items-center gap-3 py-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(m.name)}`}>
                    {getInitials(m.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-900">{m.name}</p>
                    <p className="text-xs text-warm-500">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

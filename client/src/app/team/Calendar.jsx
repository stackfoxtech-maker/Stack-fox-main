import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Badge } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const typeColor = { meeting: 'bg-blue-400', review: 'bg-amber-400', deadline: 'bg-fox-500' };
const typeVariant = { meeting: 'info', review: 'warning', deadline: 'danger' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  return { first, total };
}

function mapTaskToTask(task) {
  const status = task.status || 'todo';
  if (status === 'done') return null;
  const type = task.priority === 'urgent' || task.priority === 'critical' ? 'deadline' : status === 'review' ? 'review' : 'meeting';
  return { title: task.title, type };
}

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks/my').then((r) => setTasks(r.data.data?.tasks || [])).catch(() => toast.error('Failed to load calendar tasks.')).finally(() => setLoading(false));
  }, []);

  const { first, total } = getDaysInMonth(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  const tasksByDate = {};
  tasks.forEach((t) => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const mapped = mapTaskToTask(t);
    if (mapped) {
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(mapped);
    }
  });

  const todayTasks = tasksByDate[todayStr] || [];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-warm-200 border-t-fox-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-warm-900">Team Calendar</h2>

      <div className="flex gap-5">
        <div className="flex-1 bg-white rounded-2xl border border-warm-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-warm-100 transition"><ChevronLeft size={18} className="text-warm-600" /></button>
            <h3 className="font-semibold text-warm-900">{monthName}</h3>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-warm-100 transition"><ChevronRight size={18} className="text-warm-600" /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-warm-400 py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: total }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const tasks = tasksByDate[dateStr];
              return (
                <div key={day} className={`relative flex flex-col items-center py-2 rounded-xl text-sm transition cursor-default ${isToday ? 'bg-fox-500 text-white font-bold' : 'text-warm-700 hover:bg-warm-50'}`}>
                  {day}
                  {tasks && (
                    <div className="flex gap-0.5 mt-1">
                      {tasks.map((t, j) => <div key={j} className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : typeColor[t.type]}`} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-72 bg-white rounded-2xl border border-warm-200 p-6">
          <h3 className="font-medium text-warm-900 text-sm mb-4 flex items-center gap-2">
            <Clock size={15} className="text-fox-500" /> Today's Schedule
          </h3>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-warm-400">No tasks scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-warm-50">
                  <div className={`w-2 h-2 rounded-full ${typeColor[t.type]}`} />
                  <div>
                    <p className="text-sm font-medium text-warm-800">{t.title}</p>
                    <Badge variant={typeVariant[t.type]} className="mt-1">{t.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-warm-100">
            <h4 className="text-xs font-semibold text-warm-500 uppercase mb-2">Legend</h4>
            {Object.entries(typeColor).map(([k, c]) => (
              <div key={k} className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
                <span className="text-xs text-warm-600 capitalize">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

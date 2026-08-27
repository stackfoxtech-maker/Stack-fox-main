import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { cn, timeAgo } from '@lib/utils';
import { Spinner, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';

export default function Notifications() {
  usePageTitle('Notifications');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(r => {
      setNotifications(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-warm-900">Notifications</h1>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="All caught up" description="You have no notifications." />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={cn(
              'bg-white rounded-2xl border p-4 flex items-start gap-3 transition-colors',
              n.readAt ? 'border-warm-100' : 'border-fox-200 bg-fox-50/30'
            )}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                n.readAt ? 'bg-warm-100 text-warm-400' : 'bg-fox-100 text-fox-600'
              )}>
                <Bell size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', n.readAt ? 'text-warm-600' : 'text-warm-900 font-medium')}>{n.title || n.body}</p>
                <p className="text-xs text-warm-400 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && (
                <button onClick={() => markRead(n.id)} className="text-fox-500 hover:text-fox-700 p-1">
                  <Check size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Bell, Plus, Edit2, Trash2 } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Spinner, Badge, EmptyState, Modal, Button, Input, Textarea } from '@components/ui/Primitives';
import api from '@lib/api';

export default function Notifications() {
  usePageTitle('Notification Templates');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/notification-templates').then(r => {
      setTemplates(Array.isArray(r.data) ? r.data : (r.data.data || []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-900">Notification Templates</h1>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={Bell} title="No templates" description="Notification templates define the format for each event type." />
      ) : (
        <div className="grid gap-3">
          {templates.map(t => (
            <div key={t.id || t.code} className="bg-white rounded-2xl border border-warm-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-warm-900">{t.code}</p>
                  <p className="text-sm text-warm-500 mt-1">{t.channel || 'email'} · {t.subject || 'No subject'}</p>
                </div>
                <Badge variant={t.active !== false ? 'success' : 'neutral'}>{t.active !== false ? 'Active' : 'Disabled'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

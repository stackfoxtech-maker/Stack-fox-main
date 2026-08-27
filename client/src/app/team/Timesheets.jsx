import { useEffect, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Timesheets() {
  usePageTitle('My Timesheets');
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timesheets').then(r => {
      setTimesheets(r.data.data || []);
      setLoading(false);
    }).catch(() => { toast.error('Failed to load timesheets.'); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-warm-900">My Timesheets</h1>

      {timesheets.length === 0 ? (
        <EmptyState icon={Clock} title="No timesheets" description="Your weekly timesheets will appear here." />
      ) : (
        <div className="space-y-3">
          {timesheets.map(ts => (
            <div key={ts.id} className="bg-white rounded-2xl border border-warm-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-warm-900">Week of {formatDate(ts.weekStart)}</p>
                  <p className="text-sm text-warm-500">{ts.engagementId}</p>
                </div>
                <Badge variant={ts.status === 'APPROVED' ? 'success' : ts.status === 'DISPUTED' ? 'danger' : 'warning'}>{ts.status}</Badge>
              </div>
              {ts.lines && (
                <p className="text-sm text-warm-500 mt-2">
                  {ts.lines.reduce((s, l) => s + (l.hours || 0), 0)} hours logged across {ts.lines.length} entries
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

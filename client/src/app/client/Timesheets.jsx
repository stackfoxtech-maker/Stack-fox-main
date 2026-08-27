import { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';

export default function Timesheets() {
  usePageTitle('Timesheets');
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timesheets').then(r => {
      setTimesheets(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const handleApproveAll = async (id) => {
    try {
      await api.post(`/timesheets/${id}/approve-all`);
      setTimesheets(prev => prev.map(t => t.id === id ? { ...t, status: 'APPROVED' } : t));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-warm-900">Timesheets</h1>

      {timesheets.length === 0 ? (
        <EmptyState icon={Clock} title="No timesheets" description="Timesheets for TNM/RET/DED engagements will appear here weekly." />
      ) : (
        <div className="space-y-3">
          {timesheets.map(ts => (
            <div key={ts.id} className="bg-white rounded-2xl border border-warm-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-warm-400" />
                  <div>
                    <p className="font-medium text-warm-900">Week of {formatDate(ts.weekStart)}</p>
                    <p className="text-sm text-warm-500">Engagement: {ts.engagementId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ts.status === 'APPROVED' ? 'success' : ts.status === 'DISPUTED' ? 'danger' : 'warning'}>
                    {ts.status}
                  </Badge>
                  {ts.status === 'PENDING' && (
                    <button onClick={() => handleApproveAll(ts.id)}
                      className="btn-fox text-xs px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <CheckCircle size={14} /> Approve All
                    </button>
                  )}
                </div>
              </div>

              {ts.lines && ts.lines.length > 0 && (
                <div className="mt-3 border-t border-warm-100 pt-3">
                  <table className="w-full text-sm">
                    <thead><tr className="text-warm-500 text-left">
                      <th className="pb-2">Date</th><th className="pb-2">Hours</th><th className="pb-2">Task</th><th className="pb-2">Status</th>
                    </tr></thead>
                    <tbody>
                      {ts.lines.map((line, i) => (
                        <tr key={i} className="border-t border-warm-50">
                          <td className="py-2">{formatDate(line.date)}</td>
                          <td className="py-2 font-mono">{line.hours}h</td>
                          <td className="py-2 text-warm-600">{line.task || '–'}</td>
                          <td className="py-2"><Badge variant={line.status === 'APPROVED' ? 'success' : 'neutral'} className="text-xs">{line.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

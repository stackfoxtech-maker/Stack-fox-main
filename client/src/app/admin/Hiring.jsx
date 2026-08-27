import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatDate, capitalize, cn } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button, Select } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const statusColors = { submitted: 'info', screening: 'warning', interview: 'fox', technical: 'fox', offer: 'success', hired: 'success', rejected: 'danger', withdrawn: 'neutral' };

export default function Hiring() {
  usePageTitle('Admin Hiring');
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState([]);
  const [selectedJob, setSelectedJob] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/jobs'),
      selectedJob === 'all' ? Promise.resolve({ data: { data: [] } }) : api.get(`/jobs/${selectedJob}/applications`),
    ]).then(([jr, ar]) => {
      setJobs(jr.data.data?.jobs || []);
      setApps(ar.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedJob]);

  const updateStatus = async (appId, status) => {
    try {
      await api.put(`/jobs/applications/${appId}`, { status });
      toast.success(`Updated to ${status}.`);
      if (selectedJob !== 'all') {
        const r = await api.get(`/jobs/${selectedJob}/applications`);
        setApps(r.data.data || []);
      }
    } catch { toast.error('Failed.'); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-warm-900">Hiring & applications</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {jobs.map((j) => (
          <button key={j._id} onClick={() => { setSelectedJob(j._id); setLoading(true); }}
            className={cn('bg-white rounded-xl border border-warm-200 p-4 text-left hover:shadow-card transition-shadow', selectedJob === j._id && 'ring-2 ring-fox-500')}>
            <p className="text-sm font-medium text-warm-900 truncate">{j.title}</p>
            <p className="text-xs text-warm-500 mt-1">{j.type} &middot; {j.applicationCount || 0} applications</p>
          </button>
        ))}
      </div>

      {selectedJob === 'all' ? (
        <div className="bg-warm-100 rounded-xl p-8 text-center text-warm-500">Select a job to view applications.</div>
      ) : apps.length === 0 ? (
        <EmptyState icon={Briefcase} title="No applications yet" />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a._id} className="bg-white rounded-xl border border-warm-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-medium text-warm-900">{a.name}</p>
                  <p className="text-xs text-warm-500">{a.email} &middot; {a.experience || 'N/A'} &middot; Applied {formatDate(a.createdAt)}</p>
                </div>
                <Badge variant={statusColors[a.status] || 'neutral'}>{capitalize(a.status)}</Badge>
              </div>
              {a.coverLetter && <p className="text-xs text-warm-600 mb-2 line-clamp-2">{a.coverLetter}</p>}
              <div className="flex gap-2 flex-wrap">
                {['screening', 'interview', 'technical', 'offer', 'hired', 'rejected'].map((s) => (
                  <button key={s} onClick={() => updateStatus(a._id, s)} disabled={a.status === s}
                    className={cn('text-[10px] px-2 py-1 rounded-md font-medium transition-colors', a.status === s ? 'bg-warm-200 text-warm-500' : 'bg-warm-100 text-warm-600 hover:bg-fox-50 hover:text-fox-600')}>
                    {capitalize(s)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

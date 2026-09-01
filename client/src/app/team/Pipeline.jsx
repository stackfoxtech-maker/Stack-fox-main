import { useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { businessCategories } from '@data/salesPitchLibrary';
import { cn, formatINRShort } from '@lib/utils';
import { Spinner } from '@components/ui/Primitives';
import { apiGet, apiPatch } from '@lib/api';
import { toast } from 'react-hot-toast';

const pipelineStages = [
  { id: 'new', label: 'New Lead', color: 'bg-info-50 border-info-200' },
  { id: 'contacted', label: 'Contacted', color: 'bg-info-50 border-info-200' },
  { id: 'interested', label: 'Interested', color: 'bg-success-50 border-success-200' },
  { id: 'meeting', label: 'Meeting Scheduled', color: 'bg-warning-50 border-warning-200' },
  { id: 'demo', label: 'Demo Completed', color: 'bg-warning-50 border-warning-200' },
  { id: 'proposal', label: 'Proposal Sent', color: 'bg-fox-50 border-fox-200' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-warning-50 border-warning-200' },
  { id: 'won', label: 'Won', color: 'bg-success-50 border-success-200' },
  { id: 'not-interested', label: 'Not Interested', color: 'bg-warm-50 border-warm-200' },
  { id: 'lost', label: 'Lost', color: 'bg-danger-50 border-danger-200' },
  { id: 'followup', label: 'Follow Up Later', color: 'bg-warm-50 border-warm-200' },
];

const PRIORITY_LABEL = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(null);

  useEffect(() => {
    apiGet('/leads', { limit: 300 })
      .then((r) =>
        setLeads(
          (r.data?.data ?? []).map((l) => ({
            id: l.id,
            businessName: l.company || l.name || '—',
            category: l.category || '',
            value: l.value || 0,
            priority: PRIORITY_LABEL[l.priority] || 'Medium',
            stage: l.stage || 'new',
          })),
        ),
      )
      .catch(() => toast.error('Could not load the pipeline'))
      .finally(() => setLoading(false));
  }, []);

  const moveLead = async (leadId, toStageId) => {
    if (moving) return;
    setMoving(leadId);
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, stage: toStageId } : l)));
    try {
      await apiPatch(`/leads/${leadId}/stage`, { stage: toStageId });
    } catch (err) {
      setLeads(prev);
      toast.error(err.response?.data?.message || 'Could not move the lead');
    } finally {
      setMoving(null);
    }
  };

  const getCategoryName = (catId) => businessCategories.find((c) => c.id === catId)?.name || catId;
  const getPriorityColor = (p) => ({ High: 'border-l-danger-500', Medium: 'border-l-warning-500', Low: 'border-l-warm-300' }[p] || 'border-l-warm-300');

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Lead Pipeline</h2>
        <p className="text-warm-500 text-sm mt-1">Visualise and manage your sales pipeline</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        {pipelineStages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id} className={cn('flex-shrink-0 w-72 rounded-2xl border p-4', stage.color)}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-warm-800">{stage.label}</h3>
                <span className="text-xs font-medium text-warm-500 bg-white/60 px-2 py-0.5 rounded-lg">{stageLeads.length}</span>
              </div>
              <div className="space-y-3">
                {stageLeads.map((lead) => (
                  <div key={lead.id} className={cn('bg-white rounded-xl border-l-4 p-3 shadow-sm hover:shadow-md transition', getPriorityColor(lead.priority), moving === lead.id && 'opacity-50')}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm text-warm-900">{lead.businessName}</h4>
                      <GripVertical size={14} className="text-warm-300" />
                    </div>
                    <p className="text-xs text-warm-500 mb-2">{getCategoryName(lead.category)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-warm-700">₹{formatINRShort(lead.value)}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-md font-medium', lead.priority === 'High' ? 'bg-danger-50 text-danger-700' : lead.priority === 'Medium' ? 'bg-warning-50 text-warning-700' : 'bg-warm-100 text-warm-600')}>{lead.priority}</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-warm-100">
                      <p className="text-xs text-warm-500 mb-1.5">Move to:</p>
                      <div className="flex flex-wrap gap-1">
                        {pipelineStages.filter((s) => s.id !== stage.id).slice(0, 5).map((s) => (
                          <button key={s.id} disabled={!!moving} onClick={() => moveLead(lead.id, s.id)} className="text-xs px-2 py-1 rounded-md bg-warm-50 text-warm-600 hover:bg-warm-100 transition disabled:opacity-50">
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="text-center py-6 text-warm-400 text-xs">No leads</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

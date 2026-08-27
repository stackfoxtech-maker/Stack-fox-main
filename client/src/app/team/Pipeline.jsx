import { useState } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { businessCategories, leadStatuses } from '@data/salesPitchLibrary';
import { cn, formatINRShort } from '@lib/utils';

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

const statusToStage = {
  'New Lead': 'new',
  'Contacted': 'contacted',
  'Interested': 'interested',
  'Meeting Scheduled': 'meeting',
  'Demo Completed': 'demo',
  'Proposal Sent': 'proposal',
  'Negotiation': 'negotiation',
  'Won': 'won',
  'Not Interested': 'not-interested',
  'Lost': 'lost',
  'Follow Up Later': 'followup',
};

const mockPipelineLeads = [
  { id: 1, businessName: 'FitZone Gym', category: 'gym', value: 50000, priority: 'High', status: 'New Lead' },
  { id: 2, businessName: 'Spice Garden', category: 'restaurant', value: 35000, priority: 'Medium', status: 'Interested' },
  { id: 3, businessName: 'Patna Dental', category: 'dental', value: 45000, priority: 'High', status: 'Meeting Scheduled' },
  { id: 4, businessName: 'City Plaza', category: 'hotel', value: 80000, priority: 'High', status: 'Proposal Sent' },
  { id: 5, businessName: 'Kumar Electronics', category: 'electronics', value: 25000, priority: 'Low', status: 'Contacted' },
  { id: 6, businessName: 'Singh Properties', category: 'real-estate', value: 60000, priority: 'High', status: 'Negotiation' },
];

export default function Pipeline() {
  const [leads, setLeads] = useState(mockPipelineLeads);

  const moveLead = (leadId, newStatus) => {
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
  };

  const getStageLeads = (stageId) => {
    const statusMap = {
      new: 'New Lead', contacted: 'Contacted', interested: 'Interested',
      meeting: 'Meeting Scheduled', demo: 'Demo Completed', proposal: 'Proposal Sent',
      negotiation: 'Negotiation', won: 'Won', 'not-interested': 'Not Interested',
      lost: 'Lost', followup: 'Follow Up Later',
    };
    return leads.filter(l => l.status === statusMap[stageId]);
  };

  const getCategoryName = (catId) => {
    const cat = businessCategories.find(c => c.id === catId);
    return cat ? cat.name : catId;
  };

  const getPriorityColor = (p) => ({ High: 'border-l-danger-500', Medium: 'border-l-warning-500', Low: 'border-l-warm-300' }[p] || 'border-l-warm-300');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-display-sm text-warm-900">Lead Pipeline</h2>
        <p className="text-warm-500 text-sm mt-1">Visualize and manage your sales pipeline</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        {pipelineStages.map((stage) => {
          const stageLeads = getStageLeads(stage.id);
          return (
            <div key={stage.id} className={cn('flex-shrink-0 w-72 rounded-2xl border p-4', stage.color)}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-warm-800">{stage.label}</h3>
                <span className="text-xs font-medium text-warm-500 bg-white/60 px-2 py-0.5 rounded-lg">{stageLeads.length}</span>
              </div>
              <div className="space-y-3">
                {stageLeads.map((lead) => (
                  <div key={lead.id} className={cn('bg-white rounded-xl border-l-4 p-3 shadow-sm hover:shadow-md transition cursor-pointer', getPriorityColor(lead.priority))}>
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
                        {pipelineStages.filter(s => s.id !== stage.id).slice(0, 5).map((s) => (
                          <button key={s.id} onClick={() => moveLead(lead.id, s.label)} className="text-xs px-2 py-1 rounded-md bg-warm-50 text-warm-600 hover:bg-warm-100 transition">
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

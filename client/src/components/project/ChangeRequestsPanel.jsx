import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@lib/api';
import useAuthStore from '@store/authStore';
import { formatINR, capitalize } from '@lib/utils';
import { Badge, Button } from '@components/ui/Primitives';
import { DELIVERY_ROLES } from '../../../../packages/core/src/roles/index';

/**
 * A project's change requests, for the team. A client can raise one, but there was
 * no screen anywhere to price it, so every request stayed "Submitted" for ever.
 * Pricing one here moves it to "Assessed" and the client can then approve or
 * reject it (approving raises the invoice).
 */
function AssessForm({ projectId, cr, onDone }) {
  const [rupees, setRupees] = useState(cr.costDelta ? String(Number(cr.costDelta) / 100) : '');
  const [days, setDays] = useState(cr.timelineDelta != null ? String(cr.timelineDelta) : '0');
  const [impact, setImpact] = useState(cr.scopeImpact || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const cost = Math.round(Number(rupees) * 100);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error('Enter the extra cost in rupees (0 if none).');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}/change-requests/${cr.id}/assess`, {
        costDelta: cost,
        timelineDelta: Math.round(Number(days) || 0),
        ...(impact.trim() ? { scopeImpact: impact.trim() } : {}),
      });
      toast.success('Sent to the client for a decision.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save the assessment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-warm-500">
        Extra cost (₹, before GST)
        <input
          type="number"
          min="0"
          className="input-fx text-sm mt-1"
          value={rupees}
          onChange={(e) => setRupees(e.target.value)}
        />
      </label>
      <label className="text-xs text-warm-500">
        Extra days
        <input
          type="number"
          className="input-fx text-sm mt-1"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </label>
      <label className="text-xs text-warm-500 sm:col-span-2">
        What changes in scope
        <textarea
          rows={2}
          className="input-fx text-sm mt-1"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
        />
      </label>
      <div className="sm:col-span-2">
        <Button size="sm" variant="primary" onClick={save} isLoading={saving}>
          {cr.status === 'ASSESSED' ? 'Update assessment' : 'Send to client'}
        </Button>
      </div>
    </div>
  );
}

export default function ChangeRequestsPanel({ project, onChanged }) {
  const role = useAuthStore((s) => s.user?.role);
  const canAssess = DELIVERY_ROLES.includes(role);
  const crs = project.changeRequests || [];
  if (crs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5">
      <h3 className="font-semibold text-warm-900 mb-3">Change requests</h3>
      <div className="space-y-4">
        {crs.map((cr) => (
          <div key={cr.id} className="border-b border-warm-100 pb-4 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-warm-900 flex-1">{cr.title}</p>
              <Badge variant={cr.status === 'SUBMITTED' ? 'warning' : 'neutral'}>
                {capitalize(cr.status.toLowerCase())}
              </Badge>
            </div>
            {cr.description && <p className="text-xs text-warm-500 mt-1">{cr.description}</p>}
            {cr.status === 'ASSESSED' && (
              <p className="text-xs text-warm-600 mt-1">
                {formatINR(Number(cr.costDelta ?? 0) / 100)} · {cr.timelineDelta ?? 0} day(s) ·
                waiting for the client
              </p>
            )}
            {canAssess && ['SUBMITTED', 'ASSESSED'].includes(cr.status) && (
              <AssessForm projectId={project.id} cr={cr} onDone={() => onChanged?.()} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@lib/api';
import useAuthStore from '@store/authStore';
import { Button } from '@components/ui/Primitives';
import {
  MILESTONE_WORK_ROLES,
  MILESTONE_APPROVE_ROLES,
} from '../../../../packages/core/src/roles/index';

/**
 * The action a milestone is waiting on, for the signed-in user.
 *
 *   UPCOMING     team: Start
 *   IN_PROGRESS  team: Submit for review
 *   IN_REVIEW    PM/admin: Approve (raises the invoice) · Request revision
 *   REVISION     team: Resubmit
 *   APPROVED     done
 *
 * Mirrors MILESTONE_TRANSITIONS and the role sets in packages/core, which the
 * API enforces; hiding a button here is a convenience, not the check.
 */
export default function MilestoneActions({ projectId, milestone, onChanged }) {
  const role = useAuthStore((s) => s.user?.role);
  const [busy, setBusy] = useState(false);
  const canWork = MILESTONE_WORK_ROLES.includes(role);
  const canApprove = MILESTONE_APPROVE_ROLES.includes(role);
  const base = `/projects/${projectId}/milestones/${milestone.number}`;

  const run = async (request, done) => {
    setBusy(true);
    try {
      await request();
      toast.success(done);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status, done) => run(() => api.patch(`${base}/status`, { status }), done);
  const approve = () => run(() => api.patch(`${base}/approve`), 'Approved. Invoice raised.');
  const revise = () => {
    const feedback = window.prompt('What needs to change?');
    if (!feedback?.trim()) return;
    run(
      () => api.patch(`${base}/request-revision`, { feedback: feedback.trim() }),
      'Sent back for revision.',
    );
  };

  const hint = (text) => <span className="text-xs text-warm-400">{text}</span>;

  switch (milestone.status) {
    case 'UPCOMING':
      return canWork ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setStatus('IN_PROGRESS', 'Started.')}
        >
          Start
        </Button>
      ) : (
        hint('Not started')
      );
    case 'IN_PROGRESS':
      return canWork ? (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => setStatus('IN_REVIEW', 'Submitted for review.')}
        >
          Submit for review
        </Button>
      ) : (
        hint('Team is working on it')
      );
    case 'REVISION':
      return canWork ? (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => setStatus('IN_REVIEW', 'Resubmitted for review.')}
        >
          Resubmit
        </Button>
      ) : (
        hint('Being revised')
      );
    case 'IN_REVIEW':
      return canApprove ? (
        <span className="inline-flex gap-2">
          <Button size="sm" variant="primary" disabled={busy} onClick={approve}>
            Approve
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={revise}>
            Request revision
          </Button>
        </span>
      ) : (
        hint('Waiting for PM approval')
      );
    case 'APPROVED':
      return hint('Approved');
    default:
      return null;
  }
}

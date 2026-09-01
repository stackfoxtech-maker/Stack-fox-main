import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, Layers, FileText, Clock } from 'lucide-react';
import { Spinner, Button } from '@components/ui/Primitives';
import { apiGet, apiPost } from '@lib/api';
import { formatDate } from '@lib/utils';
import toast from 'react-hot-toast';

const CONFIDENCE_STYLE = {
  HIGH: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-red-100 text-red-700',
};

/** Sums the PERT-weighted hours across every role for one custom line. */
function pertHours(estHours) {
  if (!estHours || typeof estHours !== 'object') return null;
  let total = 0;
  for (const v of Object.values(estHours)) {
    if (v && typeof v === 'object' && 'o' in v && 'l' in v && 'p' in v) {
      total += (Number(v.o) + 4 * Number(v.l) + Number(v.p)) / 6;
    }
  }
  return Math.round(total);
}

// ── Queue list ────────────────────────────────────────────────────────────────
function Queue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/admin/se-queue')
      .then((r) => setItems(Array.isArray(r.data) ? r.data : r.data?.data ?? []))
      .catch((e) => setError(e.response?.status === 403
        ? 'You need the SE or Senior PM role to review workspaces.'
        : 'Could not load the review queue.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <p className="text-sm font-semibold text-fox-600 mb-1">Solutions Engineering</p>
      <h1 className="text-2xl font-bold mb-2">Scope review queue</h1>
      <p className="text-warm-500 text-sm mb-8">
        Workspaces a client submitted for sign-off before checkout. Review the scope, then approve or send it back with notes.
      </p>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <p className="text-sm text-fox-600 text-center py-10">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-warm-400 text-center py-10">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((ws) => {
            const canvas = Array.isArray(ws.canvas) ? ws.canvas : [];
            return (
              <li key={ws.id}>
                <Link
                  to={`/app/team/se-queue/${ws.id}`}
                  className="flex items-center justify-between bg-white border border-warm-200 rounded-xl p-4 hover:border-fox-300 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-warm-900 font-mono text-sm">{ws.id.slice(0, 8)}</div>
                    <div className="text-xs text-warm-500 mt-0.5">
                      {canvas.length} service{canvas.length === 1 ? '' : 's'} · submitted {formatDate(ws.updatedAt)}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-fox-600">Review →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Single workspace review ───────────────────────────────────────────────────
function Detail({ id }) {
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [serviceNames, setServiceNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet(`/workspaces/${id}`),
      apiGet('/catalogue/services', { limit: 500 }).catch(() => ({ data: { data: [] } })),
    ])
      .then(([wsRes, svcRes]) => {
        if (cancelled) return;
        setWs(wsRes.data);
        const rows = svcRes.data?.data ?? svcRes.data ?? [];
        setServiceNames(Object.fromEntries((Array.isArray(rows) ? rows : []).map((s) => [s.id, s.name])));
      })
      .catch(() => !cancelled && setError('Could not load this workspace.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  const canvas = useMemo(() => (Array.isArray(ws?.canvas) ? ws.canvas : []), [ws]);
  const customLines = useMemo(
    () => (Array.isArray(ws?.customLineItems) ? ws.customLineItems : []),
    [ws],
  );

  const act = async (kind) => {
    if (busy) return;
    if (kind === 'return' && !notes.trim()) {
      toast.error('Add a note so the client knows what to change.');
      return;
    }
    setBusy(true);
    try {
      const action = kind === 'approve' ? 'se-approve' : 'se-return';
      const body = kind === 'return' ? { notes: notes.trim() } : {};
      await apiPost(`/workspaces/${id}/${action}`, body);
      toast.success(kind === 'approve' ? 'Workspace approved' : 'Sent back to the client');
      navigate('/app/team/se-queue');
    } catch (e) {
      toast.error(e.response?.data?.error || 'That did not go through — try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (error) return <p className="text-sm text-fox-600 text-center py-10">{error}</p>;

  const alreadyDone = ws.seStatus && ws.seStatus !== 'SE_QUEUE';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/app/team/se-queue" className="inline-flex items-center gap-1 text-sm text-warm-500 hover:text-warm-800 mb-4">
        <ArrowLeft size={15} /> Back to queue
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold font-mono">{ws.id.slice(0, 8)}</h1>
          <p className="text-xs text-warm-500 mt-1">
            Submitted {formatDate(ws.updatedAt)} · timeline ×{Number(ws.timelineMult || 1).toFixed(2)}
          </p>
        </div>
        {alreadyDone && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warm-100 text-warm-600">
            {ws.seStatus === 'SE_APPROVED' ? 'Approved' : 'Returned'}
          </span>
        )}
      </div>

      {/* Services */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-warm-700 mb-3">
          <Layers size={16} /> Services ({canvas.length})
        </h2>
        {canvas.length === 0 ? (
          <p className="text-sm text-warm-400">No catalogue services — custom scope only.</p>
        ) : (
          <ul className="divide-y divide-warm-100 border border-warm-200 rounded-xl overflow-hidden">
            {canvas.map((entry) => {
              const features = entry.features && typeof entry.features === 'object' ? entry.features : {};
              const on = Object.values(features).filter(Boolean).length;
              const total = Object.keys(features).length;
              return (
                <li key={entry.serviceId} className="flex items-center justify-between bg-white px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-warm-900">
                      {serviceNames[entry.serviceId] || entry.serviceId}
                    </div>
                    <div className="text-xs text-warm-500 font-mono">{entry.serviceId}</div>
                  </div>
                  <span className="text-xs text-warm-500">{on}/{total} features on</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Custom lines */}
      <section className="mb-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-warm-700 mb-3">
          <FileText size={16} /> Custom line items ({customLines.length})
        </h2>
        {customLines.length === 0 ? (
          <p className="text-sm text-warm-400">None.</p>
        ) : (
          <div className="space-y-3">
            {customLines.map((line) => {
              const hrs = pertHours(line.estHours);
              return (
                <div key={line.id} className="bg-white border border-warm-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-warm-900">{line.title}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CONFIDENCE_STYLE[line.confidence] || 'bg-warm-100 text-warm-600'}`}>
                      {line.confidence || '—'}
                    </span>
                  </div>
                  {line.description && <p className="text-sm text-warm-600 mb-2">{line.description}</p>}
                  {line.acceptCriteria && (
                    <p className="text-xs text-warm-500 mb-2">
                      <span className="font-semibold text-warm-600">Acceptance:</span> {line.acceptCriteria}
                    </p>
                  )}
                  {hrs != null && (
                    <p className="flex items-center gap-1 text-xs text-warm-500">
                      <Clock size={12} /> ~{hrs} h (PERT-weighted across roles)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Actions */}
      {!alreadyDone && (
        <div className="sticky bottom-0 bg-warm-50/95 backdrop-blur border-t border-warm-200 -mx-6 px-6 py-4">
          {returnMode ? (
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="What does the client need to change before this can be approved?"
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none"
              />
              <div className="flex gap-2">
                <Button variant="primary" disabled={busy} onClick={() => act('return')}>
                  <RotateCcw size={15} className="mr-1.5" /> Send back to client
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setReturnMode(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy} onClick={() => act('approve')}>
                <CheckCircle2 size={15} className="mr-1.5" /> Approve scope
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setReturnMode(true)}>
                <RotateCcw size={15} className="mr-1.5" /> Return with notes
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SEWorkspace() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <Queue />;
}

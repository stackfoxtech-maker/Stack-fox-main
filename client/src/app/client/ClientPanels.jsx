import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Activity as ActivityIcon, GitPullRequest, BarChart3, PackageCheck, Download,
  KeyRound, CheckCircle2, AlertTriangle, Eye, FileText,
} from 'lucide-react';
import { formatDate, formatINR, timeAgo } from '@lib/utils';
import { Modal, Input, Textarea, Select, Button, Spinner, EmptyState, Badge } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

/* ────────────────────────────────────────────────────────────────────────────
   Shared bits
   ──────────────────────────────────────────────────────────────────────────── */

const CHART_COLOR = '#FF6B35';
const CHART_COLOR_ALT = '#2563EB';

/** Reads a list out of the API envelope, whichever shape a route uses. */
const listOf = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

const Stat = ({ label, value, tone = 'default', hint }) => (
  <div className="bg-white rounded-xl border border-warm-200 p-4">
    <div className="text-xs text-warm-500">{label}</div>
    <div className={`text-xl font-bold font-mono mt-1 ${
      tone === 'danger' ? 'text-danger-600' : tone === 'success' ? 'text-success-700' : 'text-warm-900'
    }`}>{value}</div>
    {hint && <div className="text-[11px] text-warm-400 mt-0.5">{hint}</div>}
  </div>
);

const PanelHeader = ({ icon: Icon, eyebrow, title, description }) => (
  <div className="mb-6">
    <p className="text-sm font-semibold text-fox-600 mb-2 flex items-center gap-1.5">
      <Icon size={15} /> {eyebrow}
    </p>
    <h1 className="text-2xl font-bold text-warm-900">{title}</h1>
    {description && <p className="text-warm-600 mt-2 max-w-2xl">{description}</p>}
  </div>
);

const BackLink = () => (
  <div className="mt-8">
    <Link to="/app/client/projects" className="text-sm text-fox-600 font-semibold hover:underline">
      Back to projects
    </Link>
  </div>
);

/* ────────────────────────────────────────────────────────────────────────────
   G3 · Activity feed
   ──────────────────────────────────────────────────────────────────────────── */

/** Fallback when the translator worker has not yet rendered an event. */
const humanise = (code) =>
  String(code || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function Activity() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // "Unread" is anything newer than the last time this panel was opened.
  const [lastSeen] = useState(() => localStorage.getItem('sf_activity_seen'));

  useEffect(() => {
    api.get('/events', { params: { limit: 50 } })
      .then((r) => {
        setEvents(listOf(r));
        localStorage.setItem('sf_activity_seen', new Date().toISOString());
      })
      .catch((err) => setError(err.response?.data?.error || 'Could not load your activity feed.'))
      .finally(() => setLoading(false));
  }, []);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const isUnread = (e) => !lastSeen || new Date(e.createdAt) > new Date(lastSeen);
  const items = unreadOnly ? events.filter(isUnread) : events;
  const unreadCount = events.filter(isUnread).length;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <PanelHeader
        icon={ActivityIcon}
        eyebrow="Activity feed"
        title="Activity"
        description="Every change on your projects, in plain language."
      />

      {error && (
        <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${!unreadOnly ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600'}`}
        >
          All activity ({events.length})
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${unreadOnly ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600'}`}
        >
          New since last visit ({unreadCount})
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title={unreadOnly ? 'Nothing new' : 'No activity yet'}
          description={unreadOnly ? 'You are all caught up.' : 'Events appear here as your project progresses.'}
        />
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div
              key={String(e.seq)}
              className={`border rounded-xl p-4 ${isUnread(e) ? 'bg-fox-50 border-fox-200' : 'bg-white border-warm-200'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <p className="text-warm-800 text-sm">{e.humanReadable || humanise(e.code)}</p>
                <span className="text-xs text-warm-500 shrink-0">{timeAgo(e.createdAt)}</span>
              </div>
              <div className="text-[11px] text-warm-400 mt-1.5 font-mono">
                {e.actor === 'system' || e.actor === 'SYSTEM' ? 'StackFox' : e.actor} &middot; {e.code}
              </div>
            </div>
          ))}
        </div>
      )}
      <BackLink />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   G8 · Change requests
   ──────────────────────────────────────────────────────────────────────────── */

const CR_STATUS_STYLE = {
  approved: 'bg-success-100 text-success-700',
  paid: 'bg-success-100 text-success-700',
  rejected: 'bg-danger-100 text-danger-700',
  lapsed: 'bg-warm-100 text-warm-600',
  assessed: 'bg-fox-100 text-fox-700',
  submitted: 'bg-info-100 text-info-700',
  draft: 'bg-info-100 text-info-700',
};

export function Changes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', urgency: 'MEDIUM' });
  const [submitting, setSubmitting] = useState(false);
  const [acting, setActing] = useState(null);

  const fetchItems = useCallback(() => {
    setLoading(true);
    return api.get('/change-requests')
      .then((r) => setItems(listOf(r)))
      .catch(() => toast.error('Could not load your change requests.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const create = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Add a title and a description.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/change-requests', form);
      toast.success('Change request submitted.');
      setShowNew(false);
      setForm({ title: '', description: '', urgency: 'MEDIUM' });
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit that request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Once StackFox has priced a change, the client decides. Approving one with a
  // cost raises an invoice server-side, so the price is shown before deciding.
  const decide = async (cr, accept) => {
    setActing(cr.id);
    try {
      const verb = accept ? 'client-approve' : 'client-reject';
      await api.patch(`/projects/${cr.projectId}/change-requests/${cr.id}/${verb}`);
      toast.success(accept ? 'Change request approved.' : 'Change request declined.');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not record your decision.');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6">
      <PanelHeader
        icon={GitPullRequest}
        eyebrow="Change requests"
        title="Change Requests"
        description="Ask for scope changes and track them. Each one is either covered by your revision allowance or quoted as a fixed price before any work starts."
      />

      <div className="mb-5">
        <Button variant="primary" onClick={() => setShowNew(true)}>+ New change request</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={GitPullRequest}
          title="No change requests yet"
          description="Raise one when your scope needs to move."
        />
      ) : (
        <div className="space-y-4">
          {items.map((c) => {
            const status = String(c.status || '').toLowerCase();
            const priced = c.costDelta != null && c.costDelta > 0;
            return (
              <div key={c.id} className="border border-warm-200 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-fox-600">{c.id}</span>
                      <span className="font-semibold text-warm-900">{c.title}</span>
                    </div>
                    <p className="text-sm text-warm-600 mt-1">{c.description}</p>
                    <div className="text-xs text-warm-400 mt-1.5">Raised {formatDate(c.createdAt)}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${CR_STATUS_STYLE[status] ?? 'bg-warm-100 text-warm-600'}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>

                {status === 'assessed' && (
                  <div className="mt-3 rounded-xl bg-warm-50 p-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span>
                        Cost impact:{' '}
                        <span className="font-mono font-semibold">
                          {priced ? formatINR(c.costDelta / 100) : 'No extra charge'}
                        </span>
                      </span>
                      {c.timelineDelta != null && (
                        <span>Timeline impact: <span className="font-mono font-semibold">+{c.timelineDelta} days</span></span>
                      )}
                    </div>
                    {c.scopeImpact && <p className="text-xs text-warm-600 mt-2">{c.scopeImpact}</p>}
                    {priced && (
                      <p className="text-xs text-warm-500 mt-2">
                        Approving this raises an invoice for {formatINR(c.costDelta / 100)} plus GST.
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="primary" size="sm"
                        isLoading={acting === c.id}
                        onClick={() => decide(c, true)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary" size="sm"
                        disabled={acting === c.id}
                        onClick={() => decide(c, false)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New change request" size="md">
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Brief summary of the change"
          />
          <Select
            label="Urgency"
            value={form.urgency}
            onChange={(e) => setForm({ ...form, urgency: e.target.value })}
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
            ]}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What needs to change, and why?"
          />
          <Button variant="primary" onClick={create} isLoading={submitting}>Submit request</Button>
        </div>
      </Modal>

      <BackLink />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   G10 · Reports
   ──────────────────────────────────────────────────────────────────────────── */

const minutesToText = (m) => {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

const ChartCard = ({ title, description, children, footer }) => (
  <div className="bg-white border border-warm-200 rounded-2xl p-5">
    <h2 className="font-semibold text-warm-900">{title}</h2>
    <p className="text-sm text-warm-600 mb-4">{description}</p>
    {children}
    {footer}
  </div>
);

export function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    api.get('/reports/summary')
      .then((r) => setReport(r.data.data))
      .catch((err) => setError(err.response?.data?.error || 'Could not load your reports.'))
      .finally(() => setLoading(false));
  }, []);

  // Produces a stored JSON artefact server-side and hands back a signed URL.
  const generate = async (type) => {
    setGenerating(type);
    try {
      const res = await api.post('/reports/generate', { type });
      const url = res.data?.data?.downloadUrl;
      if (url) {
        window.open(url, '_blank', 'noopener');
        toast.success('Report generated.');
      } else {
        toast.error(res.data?.meta?.warning || 'Report generated, but no download is available.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate that report.');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <PanelHeader icon={BarChart3} eyebrow="Reports and analytics" title="Reports" />
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      </div>
    );
  }

  const { spend, timeline, revisions, engagement } = report ?? {};
  const hasSpend = spend?.series?.some((s) => s.invoiced > 0 || s.paid > 0);
  const hasTimeline = (timeline?.projects?.length ?? 0) > 0;
  const hasRevisions = (revisions?.projects?.length ?? 0) > 0;
  const hasSupport = (engagement?.totals?.tickets ?? 0) > 0;

  const GenerateButton = ({ type }) => (
    <button
      onClick={() => generate(type)}
      disabled={generating === type}
      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-fox-500 text-white text-sm rounded-xl font-medium hover:bg-fox-600 disabled:opacity-50 transition"
    >
      <Download size={14} />
      {generating === type ? 'Generating…' : 'Download report'}
    </button>
  );

  const NoData = ({ children }) => (
    <div className="bg-warm-50 rounded-xl h-40 flex items-center justify-center text-warm-400 text-sm px-4 text-center">
      {children}
    </div>
  );

  return (
    <div className="p-6">
      <PanelHeader
        icon={BarChart3}
        eyebrow="Reports and analytics"
        title="Reports"
        description="Spending, delivery speed, quality and support responsiveness — computed from your own projects."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Invoiced" value={formatINR(spend?.totals?.invoiced ?? 0)} />
        <Stat label="Paid" value={formatINR(spend?.totals?.paid ?? 0)} tone="success" />
        <Stat
          label="Outstanding"
          value={formatINR(spend?.totals?.outstanding ?? 0)}
          tone={spend?.totals?.outstanding > 0 ? 'danger' : 'default'}
          hint={spend?.totals?.overdueCount > 0 ? `${spend.totals.overdueCount} overdue` : null}
        />
        <Stat
          label="Milestones on time"
          value={timeline?.totals?.onTimePct != null ? `${timeline.totals.onTimePct}%` : '—'}
          hint={timeline?.totals?.late > 0 ? `${timeline.totals.late} running late` : null}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard
          title="Monthly spend"
          description="Invoiced versus settled, over the last six months."
          footer={<GenerateButton type="spend" />}
        >
          {hasSpend ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spend.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#A8A29E" />
                <YAxis tick={{ fontSize: 11 }} stroke="#A8A29E" width={70}
                       tickFormatter={(v) => `₹${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v}`} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="invoiced" name="Invoiced" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Paid" fill={CHART_COLOR_ALT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData>No invoices raised yet. Spending appears here after your first invoice.</NoData>
          )}
        </ChartCard>

        <ChartCard
          title="Project timeline"
          description="Milestone progress against committed dates."
          footer={<GenerateButton type="timeline" />}
        >
          {hasTimeline ? (
            <div className="space-y-3">
              {timeline.projects.slice(0, 6).map((p) => (
                <div key={p.projectId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate text-warm-800">{p.project}</span>
                    <span className="font-mono text-warm-600 shrink-0 ml-2">
                      {p.approved}/{p.totalMilestones}
                      {p.lateCount > 0 && <span className="text-danger-600 ml-2">{p.lateCount} late</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.lateCount > 0 ? 'bg-warning-500' : 'bg-fox-500'}`}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NoData>No projects with milestones yet.</NoData>
          )}
        </ChartCard>

        <ChartCard
          title="Revisions and quality"
          description="Revision rounds used against your allowance, and defects raised."
          footer={<GenerateButton type="revisions" />}
        >
          {hasRevisions ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Rounds used" value={`${revisions.totals.roundsUsed}/${revisions.totals.roundsIncluded}`} />
                <Stat label="Bugs raised" value={revisions.totals.bugsRaised} />
                <Stat
                  label="Still open"
                  value={revisions.totals.bugsOpen}
                  tone={revisions.totals.bugsOpen > 0 ? 'danger' : 'success'}
                />
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={revisions.projects.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" vertical={false} />
                  <XAxis dataKey="project" tick={{ fontSize: 10 }} stroke="#A8A29E" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#A8A29E" allowDecimals={false} width={30} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="roundsUsed" name="Rounds used" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bugsRaised" name="Bugs" fill={CHART_COLOR_ALT} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <NoData>No delivery activity to measure yet.</NoData>
          )}
        </ChartCard>

        <ChartCard
          title="Engagement health"
          description="How quickly we respond, and how you rate the work."
          footer={<GenerateButton type="engagement" />}
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="Avg first response" value={minutesToText(engagement?.totals?.avgResponseMinutes)} />
            <Stat label="Avg resolution" value={minutesToText(engagement?.totals?.avgResolutionMinutes)} />
            <Stat
              label="SLA met"
              value={engagement?.totals?.slaMetPct != null ? `${engagement.totals.slaMetPct}%` : '—'}
              tone={engagement?.totals?.slaMetPct != null && engagement.totals.slaMetPct < 80 ? 'danger' : 'success'}
            />
            <Stat
              label="Your rating"
              value={engagement?.totals?.avgRating != null ? `${engagement.totals.avgRating}/5` : '—'}
              hint={engagement?.totals?.responses ? `${engagement.totals.responses} response(s)` : 'No feedback yet'}
            />
          </div>
          {hasSupport ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={engagement.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#A8A29E" />
                <YAxis tick={{ fontSize: 11 }} stroke="#A8A29E" allowDecimals={false} width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="value" name="Tickets raised" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <NoData>No support tickets raised — nothing to chart yet.</NoData>
          )}
        </ChartCard>
      </div>

      <BackLink />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   G11 · Post-delivery handover
   ──────────────────────────────────────────────────────────────────────────── */

export function Handover() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kitLoading, setKitLoading] = useState(false);
  const [error, setError] = useState(null);

  const [revealed, setRevealed] = useState({});
  const [busy, setBusy] = useState(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    api.get('/handover/projects')
      .then((r) => {
        const list = listOf(r);
        setProjects(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch((err) => setError(err.response?.data?.error || 'Could not load your handovers.'))
      .finally(() => setLoading(false));
  }, []);

  const loadKit = useCallback((id) => {
    if (!id) return;
    setKitLoading(true);
    setRevealed({});
    api.get(`/handover/${id}`)
      .then((r) => setKit(r.data.data))
      .catch((err) => {
        setKit(null);
        toast.error(err.response?.data?.error || 'Could not load that handover kit.');
      })
      .finally(() => setKitLoading(false));
  }, []);

  useEffect(() => { loadKit(selectedId); }, [selectedId, loadKit]);

  const download = async (fileId, name) => {
    setBusy(fileId);
    try {
      const res = await api.get(`/handover/${selectedId}/deliverables/${fileId}/download`);
      const url = res.data?.data?.url;
      if (!url) throw new Error('no url');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.response?.data?.error || `Could not download ${name}.`);
    } finally {
      setBusy(null);
    }
  };

  // Revealing a credential is audited server-side, so it is an explicit action
  // rather than something the kit returns up front.
  const reveal = async (credentialId) => {
    setBusy(credentialId);
    try {
      const res = await api.post(`/handover/${selectedId}/credentials/${credentialId}/reveal`, {});
      setRevealed((prev) => ({ ...prev, [credentialId]: res.data.data.credentials }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not reveal that credential.');
    } finally {
      setBusy(null);
    }
  };

  const accept = async () => {
    setBusy('accept');
    try {
      await api.post(`/handover/${selectedId}/accept`, {});
      toast.success('Handover accepted. Your warranty period starts now.');
      loadKit(selectedId);
    } catch (err) {
      const outstanding = err.response?.data?.outstanding;
      toast.error(
        outstanding?.length
          ? `Not ready yet: ${outstanding.join(', ')}`
          : err.response?.data?.message || 'Could not accept this handover.',
      );
    } finally {
      setBusy(null);
    }
  };

  const dispute = async () => {
    if (!disputeReason.trim()) { toast.error('Tell us what is outstanding.'); return; }
    setBusy('dispute');
    try {
      await api.post(`/handover/${selectedId}/dispute`, { reason: disputeReason });
      toast.success('Raised with your project manager.');
      setDisputeOpen(false);
      setDisputeReason('');
      loadKit(selectedId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not raise that.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <PanelHeader icon={PackageCheck} eyebrow="Post-delivery handover" title="Handover Kit" />
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-6">
        <PanelHeader icon={PackageCheck} eyebrow="Post-delivery handover" title="Handover Kit" />
        <EmptyState
          icon={PackageCheck}
          title="No handovers yet"
          description="Once a project is delivered, its source, docs and credentials appear here."
        />
      </div>
    );
  }

  const warranty = kit?.warranty;
  const accepted = Boolean(kit?.handover?.acceptedAt);
  const disputed = kit?.handover?.status === 'DISPUTED';

  return (
    <div className="p-6">
      <PanelHeader
        icon={PackageCheck}
        eyebrow="Post-delivery handover"
        title="Handover Kit"
        description="Everything that was delivered — source, documentation and system access — plus your sign-off."
      />

      {projects.length > 1 && (
        <div className="mb-5 max-w-md">
          <Select
            label="Project"
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}

      {kitLoading || !kit ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Readiness checklist — computed from live data, not a stored flag. */}
          <div className="bg-white border border-warm-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-warm-900">Handover checklist</h2>
              <Badge variant={accepted ? 'success' : disputed ? 'danger' : kit.readyToAccept ? 'info' : 'neutral'}>
                {accepted ? 'Accepted' : disputed ? 'Disputed' : kit.readyToAccept ? 'Ready to accept' : 'In preparation'}
              </Badge>
            </div>
            <div className="space-y-2">
              {kit.checklist.map((c) => (
                <div key={c.key} className="flex items-center gap-3 text-sm">
                  {c.done
                    ? <CheckCircle2 size={16} className="text-success-600 shrink-0" />
                    : <AlertTriangle size={16} className="text-warning-500 shrink-0" />}
                  <span className={c.done ? 'text-warm-700' : 'text-warm-500'}>{c.label}</span>
                  {c.detail && <span className="text-xs text-warm-400 ml-auto font-mono">{c.detail}</span>}
                </div>
              ))}
            </div>

            {!accepted && (
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-warm-100">
                <Button
                  variant="primary"
                  disabled={!kit.readyToAccept || busy === 'accept'}
                  isLoading={busy === 'accept'}
                  onClick={accept}
                >
                  Accept handover
                </Button>
                <Button variant="secondary" onClick={() => setDisputeOpen(true)}>
                  Something is missing
                </Button>
                {!kit.readyToAccept && (
                  <p className="text-xs text-warm-500 self-center">
                    Everything above must be complete before you can accept.
                  </p>
                )}
              </div>
            )}

            {accepted && (
              <p className="text-xs text-warm-500 mt-4 pt-4 border-t border-warm-100">
                Accepted on {formatDate(kit.handover.acceptedAt)}.
              </p>
            )}
          </div>

          {/* Deliverables */}
          <div className="bg-white border border-warm-200 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold text-warm-900 mb-4">Deliverables</h2>
            {kit.deliverables.length === 0 ? (
              <p className="text-sm text-warm-400">No files have been uploaded to this project yet.</p>
            ) : (
              <div className="space-y-2">
                {kit.deliverables.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 border border-warm-100 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={18} className="text-warm-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-warm-900 truncate">{d.name}</div>
                        <div className="text-xs text-warm-500">
                          {d.sizeBytes ? `${(d.sizeBytes / 1024).toFixed(0)} KB · ` : ''}
                          v{d.version} · {formatDate(d.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="secondary" size="sm"
                      disabled={d.status !== 'ready' || busy === d.id}
                      isLoading={busy === d.id}
                      onClick={() => download(d.id, d.name)}
                    >
                      <Download size={14} /> Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credentials */}
          <div className="bg-white border border-warm-200 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold text-warm-900 mb-1">System access</h2>
            <p className="text-sm text-warm-600 mb-4">
              Stored encrypted. Every reveal is logged against your account.
            </p>
            {kit.credentials.length === 0 ? (
              <p className="text-sm text-warm-400">No credentials have been handed over for this project.</p>
            ) : (
              <div className="space-y-2">
                {kit.credentials.map((c) => (
                  <div key={c.id} className="border border-warm-100 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <KeyRound size={18} className="text-warm-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-warm-900 truncate">{c.systemName}</div>
                          {c.accessedAt && (
                            <div className="text-xs text-warm-500">Last viewed {formatDate(c.accessedAt)}</div>
                          )}
                        </div>
                      </div>
                      {!revealed[c.id] && (
                        <Button
                          variant="secondary" size="sm"
                          disabled={busy === c.id}
                          isLoading={busy === c.id}
                          onClick={() => reveal(c.id)}
                        >
                          <Eye size={14} /> Reveal
                        </Button>
                      )}
                    </div>
                    {revealed[c.id] && (
                      <pre className="mt-3 bg-warm-900 text-warm-50 rounded-lg p-3 text-xs overflow-x-auto">
                        {JSON.stringify(revealed[c.id], null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warranty — driven by the real delivery date */}
          <div className="bg-warm-50 rounded-2xl p-6">
            <h2 className="font-bold text-warm-900 mb-2">
              {kit.handover.warrantyDays}-day warranty
            </h2>
            {warranty?.active ? (
              <p className="text-sm text-warm-600">
                Active until <strong>{formatDate(warranty.expiresAt)}</strong> — {warranty.daysRemaining} day
                {warranty.daysRemaining === 1 ? '' : 's'} remaining. Any bug you report in this window is fixed
                free of charge. Raise it under <Link to="/app/client/support" className="text-fox-600 hover:underline">Support</Link>.
              </p>
            ) : warranty?.expiresAt ? (
              <p className="text-sm text-warm-600">
                Expired on {formatDate(warranty.expiresAt)}. New work is quoted as a change request.
              </p>
            ) : (
              <p className="text-sm text-warm-600">
                Starts when you accept the handover above, and runs for {kit.handover.warrantyDays} days.
              </p>
            )}
          </div>
        </>
      )}

      <Modal isOpen={disputeOpen} onClose={() => setDisputeOpen(false)} title="What is missing?" size="md">
        <div className="space-y-4">
          <Textarea
            label="Tell us what is outstanding"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Describe what has not been delivered or does not work as expected."
          />
          <Button variant="primary" onClick={dispute} isLoading={busy === 'dispute'}>
            Send to my project manager
          </Button>
        </div>
      </Modal>

      <BackLink />
    </div>
  );
}

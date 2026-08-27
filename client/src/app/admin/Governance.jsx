import { useEffect, useState } from 'react';
import { Plus, Flag, IndianRupee, Mail, CalendarClock, ShieldCheck } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, cn } from '@lib/utils';
import { Spinner, Button, EmptyState, Badge, Modal, Input, Select, Textarea } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

function useAdminResource(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    api.get(path)
      .then((r) => setItems(Array.isArray(r.data) ? r.data : r.data.data || r.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);
  return { items, loading, refetch: fetchData };
}

// ── Feature Flags ────────────────────────────────────────────────
export function Flags() {
  usePageTitle('Feature Flags');
  const { items, loading, refetch } = useAdminResource('/admin/flags');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: '', description: '', type: 'BOOL', defaultValue: false });
  const [saving, setSaving] = useState(false);

  const toggle = async (flag) => {
    try {
      await api.patch(`/admin/flags/${flag.id}`, { defaultValue: !flag.defaultValue });
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const create = async () => {
    if (!form.id) { toast.error('Flag ID is required.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/flags', form);
      toast.success('Flag created.');
      setOpen(false);
      setForm({ id: '', description: '', type: 'BOOL', defaultValue: false });
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-warm-900">Feature Flags</h2>
          <p className="text-sm text-warm-500">Boolean and variant flags that gate platform behavior.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus size={16} /> New Flag</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> :
      items.length === 0 ? <EmptyState icon={Flag} title="No flags yet" /> : (
        <div className="bg-white rounded-2xl border border-warm-200 divide-y divide-warm-100">
          {items.map((f) => (
            <div key={f.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-semibold text-warm-900">{f.id}</div>
                <div className="text-xs text-warm-500">{f.description || 'No description'} &middot; {f.type}</div>
              </div>
              <button
                onClick={() => toggle(f)}
                className={cn('w-11 h-6 rounded-full transition-colors relative flex-shrink-0', f.defaultValue ? 'bg-fox-500' : 'bg-warm-200')}
              >
                <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', f.defaultValue ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New feature flag">
        <div className="space-y-4">
          <Input label="Flag ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="whatsapp_commerce_enabled" />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'BOOL', label: 'Boolean' }, { value: 'VARIANT', label: 'Variant' }]} />
          <Button variant="primary" onClick={create} isLoading={saving}>Create</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Rate Cards / Pricing ─────────────────────────────────────────
export function Pricing() {
  usePageTitle('Pricing & Rate Cards');
  const { items, loading, refetch } = useAdminResource('/admin/rate-cards');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'ROLE', key: '', rate: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.key || !form.rate) { toast.error('Key and rate are required.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/rate-cards', {
        type: form.type,
        key: form.key,
        rate: Math.round(Number(form.rate) * 100),
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      });
      toast.success('Rate card entry added.');
      setOpen(false);
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-warm-900">Pricing &amp; Rate Cards</h2>
          <p className="text-sm text-warm-500">Versioned per-point and per-role rates powering estimates and T&amp;M billing.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus size={16} /> New Rate</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> :
      items.length === 0 ? <EmptyState icon={IndianRupee} title="No rate cards yet" /> : (
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-warm-50 border-b border-warm-200">
              <th className="text-left py-3 px-4 font-semibold text-warm-700">Type</th>
              <th className="text-left py-3 px-4 font-semibold text-warm-700">Key</th>
              <th className="text-right py-3 px-4 font-semibold text-warm-700">Rate</th>
              <th className="text-right py-3 px-4 font-semibold text-warm-700">Effective from</th>
            </tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-warm-100 last:border-0">
                  <td className="py-3 px-4"><Badge variant="neutral">{r.type}</Badge></td>
                  <td className="py-3 px-4 font-mono text-warm-700">{r.key}</td>
                  <td className="py-3 px-4 text-right font-semibold text-warm-900">{formatINR(r.rate / 100)}{r.type === 'ROLE' ? '/hr' : '/pt'}</td>
                  <td className="py-3 px-4 text-right text-warm-500">{formatDate(r.effectiveFrom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New rate card entry">
        <div className="space-y-4">
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'ROLE', label: 'Role (₹/hour)' }, { value: 'POINT', label: 'Point (₹/point)' }]} />
          <Input label="Key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="senior-dev" />
          <Input label="Rate (₹)" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          <Input label="Effective from" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          <Button variant="primary" onClick={create} isLoading={saving}>Add</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Notification Templates ───────────────────────────────────────
export function Templates() {
  usePageTitle('Notification Templates');
  const { items, loading, refetch } = useAdminResource('/admin/notification-templates');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ key: '', subject: '', body: '', ctaLabel: '', ctaUrlTpl: '' });
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditing(null); setForm({ key: '', subject: '', body: '', ctaLabel: '', ctaUrlTpl: '' }); setOpen(true); };
  const openEdit = (t) => { setEditing(t.key); setForm(t); setOpen(true); };

  const save = async () => {
    if (!form.key || !form.body) { toast.error('Key and body are required.'); return; }
    setSaving(true);
    try {
      if (editing) await api.patch(`/admin/notification-templates/${encodeURIComponent(editing)}`, form);
      else await api.post('/admin/notification-templates', form);
      toast.success('Saved.');
      setOpen(false);
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-warm-900">Notification Templates</h2>
          <p className="text-sm text-warm-500">One entry per event code &middot; channel, e.g. TICKET_RAISED.email.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}><Plus size={16} /> New Template</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> :
      items.length === 0 ? <EmptyState icon={Mail} title="No templates yet" /> : (
        <div className="bg-white rounded-2xl border border-warm-200 divide-y divide-warm-100">
          {items.map((t) => (
            <button key={t.key} onClick={() => openEdit(t)} className="w-full text-left p-4 hover:bg-warm-50 transition-colors">
              <div className="font-mono text-sm font-semibold text-warm-900">{t.key}</div>
              <div className="text-xs text-warm-500 mt-0.5">{t.subject || t.body.slice(0, 80)}</div>
            </button>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit template' : 'New template'} size="lg">
        <div className="space-y-4">
          {!editing && <Input label="Key (event_code.channel)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="TICKET_RAISED.email" />}
          <Input label="Subject (email only)" value={form.subject || ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Textarea label="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Supports {{variables}}" />
          <Input label="CTA label" value={form.ctaLabel || ''} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} />
          <Input label="CTA URL template" value={form.ctaUrlTpl || ''} onChange={(e) => setForm({ ...form, ctaUrlTpl: e.target.value })} />
          <Button variant="primary" onClick={save} isLoading={saving}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Compliance Calendar ──────────────────────────────────────────
export function Compliance() {
  usePageTitle('Compliance');
  const { items, loading, refetch } = useAdminResource('/admin/compliance');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ orgId: '', type: 'GST', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const statusVariant = { UPCOMING: 'info', FILED: 'success', OVERDUE: 'danger' };

  const markFiled = async (item) => {
    try {
      await api.patch(`/admin/compliance/${item.id}`, { status: 'FILED', filedAt: new Date().toISOString() });
      toast.success('Marked filed.');
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const create = async () => {
    if (!form.orgId || !form.dueDate) { toast.error('Org ID and due date are required.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/compliance', { ...form, dueDate: new Date(form.dueDate).toISOString() });
      toast.success('Added.');
      setOpen(false);
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-warm-900">Compliance Calendar</h2>
          <p className="text-sm text-warm-500">Statutory filing deadlines per organisation — GST, TDS, GSTR-1, SOFTEX.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus size={16} /> New Filing</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> :
      items.length === 0 ? <EmptyState icon={CalendarClock} title="No filings tracked" /> : (
        <div className="bg-white rounded-2xl border border-warm-200 divide-y divide-warm-100">
          {items.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-warm-900">{c.type} &middot; {c.org?.name || c.orgId}</div>
                <div className="text-xs text-warm-500">Due {formatDate(c.dueDate)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[c.status] || 'neutral'}>{c.status}</Badge>
                {c.status !== 'FILED' && (
                  <button onClick={() => markFiled(c)} className="text-xs text-fox-500 hover:underline">Mark filed</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New compliance filing">
        <div className="space-y-4">
          <Input label="Org ID" value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })} placeholder="ORG-DEMO-PAY" />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'GST', label: 'GST' }, { value: 'TDS', label: 'TDS' }, { value: 'GSTR1', label: 'GSTR-1' }, { value: 'SOFTEX', label: 'SOFTEX' }]} />
          <Input label="Due date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <Button variant="primary" onClick={create} isLoading={saving}>Add</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── KYC / Sanctions Screening ────────────────────────────────────
export function Screening() {
  usePageTitle('Screening Queue');
  const { items, loading, refetch } = useAdminResource('/admin/screening');

  const resolve = async (item, result) => {
    const reviewNote = result === 'FAIL' ? prompt('Reason for rejection?') || '' : '';
    try {
      await api.patch(`/admin/screening/${item.id}`, { result, reviewNote });
      toast.success(result === 'PASS' ? 'Cleared.' : 'Rejected.');
      refetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-warm-900">KYC &amp; Sanctions Screening</h2>
        <p className="text-sm text-warm-500">Orders and accounts held for manual review before proceeding.</p>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> :
      items.length === 0 ? <EmptyState icon={ShieldCheck} title="No holds — queue is clear" /> : (
        <div className="bg-white rounded-2xl border border-warm-200 divide-y divide-warm-100">
          {items.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-warm-900">{s.checkType}</div>
                <div className="text-xs text-warm-500">{s.orgId ? `Org ${s.orgId}` : s.userId ? `User ${s.userId}` : '—'} &middot; {formatDate(s.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warning">HOLD</Badge>
                <button onClick={() => resolve(s, 'PASS')} className="text-xs text-success-600 font-medium hover:underline">Clear</button>
                <button onClick={() => resolve(s, 'FAIL')} className="text-xs text-danger-500 font-medium hover:underline">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

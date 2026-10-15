import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Circle, Trash2, Upload } from 'lucide-react';
import api from '@lib/api';
import useAuthStore from '@store/authStore';
import { formatDate } from '@lib/utils';
import { Button } from '@components/ui/Primitives';
import { VAULT_ROLES } from '../../../../packages/core/src/roles/index';

/**
 * Delivery, from the team's side: what the client will be asked to accept.
 *
 * The client's Handover page needs files, approved milestones and settled invoices
 * before "Accept" unlocks, but staff had nowhere in the app to upload a deliverable
 * or store a credential, so a project could not be delivered without calling the API
 * by hand. This is that screen: the live checklist, deliverable files and (for
 * roles that may hold secrets) the credential vault.
 */
function Checklist({ kit }) {
  const accepted = kit.handover?.status === 'ACCEPTED';
  const disputed = kit.handover?.status === 'DISPUTED';
  return (
    <div>
      <ul className="space-y-1.5">
        {kit.checklist.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            {c.done ? (
              <CheckCircle2 size={16} className="text-success-500 shrink-0" />
            ) : (
              <Circle size={16} className="text-warm-300 shrink-0" />
            )}
            <span className={c.done ? 'text-warm-700' : 'text-warm-900 font-medium'}>
              {c.label}
              {c.optional ? ' (optional)' : ''}
            </span>
            {c.detail && <span className="text-xs text-warm-400">{c.detail}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-warm-500">
        {accepted
          ? `Accepted by the client on ${formatDate(kit.handover.acceptedAt)}. Warranty runs for ${kit.handover.warrantyDays} days.`
          : disputed
            ? `The client disputed this handover: ${kit.handover.notes || 'no details given'}`
            : kit.readyToAccept
              ? 'Everything is in place. The client can accept the handover now.'
              : 'The client can accept once every item above is done.'}
      </p>
    </div>
  );
}

function Files({ projectId, kit, reload }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await api.post('/files/upload', {
        filename: file.name,
        contentType: file.type || undefined,
        size: file.size,
        projectId,
      });
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', file);
      const put = await fetch(data.meta.upload.url, { method: 'PUT', body });
      if (!put.ok) throw new Error('storage upload failed');
      await api.post(`/files/${data.data.id}/confirm`);
      toast.success('File added to the handover.');
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/files/${id}`);
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not delete the file.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-warm-900">Deliverable files</h4>
        <label className="btn-outline text-xs px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5">
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" className="hidden" onChange={upload} disabled={uploading} />
        </label>
      </div>
      {kit.deliverables.length === 0 ? (
        <p className="text-xs text-warm-400">Nothing uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-warm-100">
          {kit.deliverables.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-warm-400">{formatDate(f.createdAt)}</span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={`Delete ${f.name}`}
                className="p-1 text-warm-400 hover:text-danger-500"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Vault({ projectId, kit, reload }) {
  const empty = { systemName: '', url: '', username: '', password: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const { systemName, ...secret } = form;
      const credentials = Object.fromEntries(Object.entries(secret).filter(([, v]) => v.trim()));
      await api.post('/vault', { projectId, systemName: systemName.trim(), credentials });
      toast.success('Stored securely. The client can reveal it from their handover page.');
      setForm(empty);
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not store the credentials.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/vault/${id}`);
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not remove it.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-warm-900">Access and credentials</h4>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : 'Add system'}
        </Button>
      </div>
      {kit.credentials.length === 0 && !open && (
        <p className="text-xs text-warm-400">
          None stored. Skip this if there is nothing to hand over.
        </p>
      )}
      <ul className="divide-y divide-warm-100">
        {kit.credentials.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="flex-1 truncate">{c.systemName}</span>
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label={`Remove ${c.systemName}`}
              className="p-1 text-warm-400 hover:text-danger-500"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ['systemName', 'System (e.g. Hosting, Domain registrar)'],
            ['url', 'Login URL'],
            ['username', 'Username'],
            ['password', 'Password'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs text-warm-500">
              {label}
              <input
                className="input-fx text-sm mt-1"
                type={key === 'password' ? 'password' : 'text'}
                autoComplete="off"
                value={form[key]}
                onChange={set(key)}
              />
            </label>
          ))}
          <label className="text-xs text-warm-500 sm:col-span-2">
            Notes
            <textarea
              rows={2}
              className="input-fx text-sm mt-1"
              value={form.notes}
              onChange={set('notes')}
            />
          </label>
          <div className="sm:col-span-2">
            <Button
              size="sm"
              variant="primary"
              onClick={save}
              isLoading={saving}
              disabled={!form.systemName.trim()}
            >
              Store securely
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HandoverKit({ projectId }) {
  const role = useAuthStore((s) => s.user?.role);
  const canVault = VAULT_ROLES.includes(role);
  const [kit, setKit] = useState(null);

  const reload = () =>
    api
      .get(`/handover/${projectId}`)
      .then((r) => setKit(r.data.data))
      .catch(() => {});

  useEffect(() => {
    reload();
  }, [projectId]);

  if (!kit) return null;

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5 space-y-6">
      <h3 className="font-semibold text-warm-900">Handover</h3>
      <Checklist kit={kit} />
      <Files projectId={projectId} kit={kit} reload={reload} />
      {canVault && <Vault projectId={projectId} kit={kit} reload={reload} />}
    </div>
  );
}

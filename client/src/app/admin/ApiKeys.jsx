import { useState, useEffect } from 'react';
import { Key, Copy, Trash2, Search, Plus, AlertTriangle } from 'lucide-react';
import { usePageTitle, useDebounce } from '@lib/hooks';
import { formatDate, cn } from '@lib/utils';
import { Button, Input, Modal, Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

/**
 * Admin screen for issuing and revoking /v1 API keys.
 *
 * This is the missing half of a feature whose backend has worked the whole
 * time. `api_keys` sat at zero rows in production not because issuance was
 * broken, but because nothing let anyone reach it: GET /api-keys answered a
 * missing ?orgId= with 403 "Insufficient permissions" (fixed separately —
 * F-25), and even with that fixed there was no screen to issue one from.
 * Verified end to end against the local API before this was written: POST
 * /api-keys -> 201 with a plaintext key, that key opens /v1, a junk key gets
 * 401, a read-only key gets 403 on a write.
 *
 * Internal staff have no orgId of their own (confirmed at login — an admin's
 * orgId is null by design), so this always acts on behalf of a client org,
 * found by searching users the same way the Users page does.
 */
export default function ApiKeys() {
  usePageTitle('API Keys');

  const [search, setSearch] = useState('');
  const q = useDebounce(search, 250);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [org, setOrg] = useState(null); // { id, name/email of the user picked }

  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(['read']);
  const [issuing, setIssuing] = useState(false);
  const [issuedKey, setIssuedKey] = useState(null); // shown exactly once

  const searchUsers = async (term) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await api.get('/users', { params: { search: term, limit: 10 } });
      const rows = r.data?.data || [];
      setResults(rows.filter((u) => u.orgId));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search — one request per pause, not per keystroke, matching
  // the pattern already used by the admin Catalog page.
  useEffect(() => {
    searchUsers(q);
  }, [q]);

  const fetchKeys = async (orgId) => {
    setLoadingKeys(true);
    try {
      const r = await api.get('/api-keys', { params: { orgId } });
      const rows = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setKeys(rows);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load keys.');
      setKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  };

  const pickOrg = (user) => {
    setOrg({ id: user.orgId, label: user.name || user.email, email: user.email });
    setResults([]);
    setSearch('');
    fetchKeys(user.orgId);
  };

  const openIssue = () => {
    setLabel('');
    setScopes(['read']);
    setIssuedKey(null);
    setModalOpen(true);
  };

  const toggleScope = (s) => {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const issue = async () => {
    if (!org) return;
    setIssuing(true);
    try {
      const r = await api.post(
        '/api-keys',
        { label: label.trim() || undefined, scopes: scopes.length ? scopes : undefined },
        { params: { orgId: org.id } },
      );
      setIssuedKey(r.data);
      fetchKeys(org.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to issue key.');
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (key) => {
    if (!confirm(`Revoke key ${key.prefix}…? Anything using it stops working immediately.`)) return;
    try {
      await api.delete(`/api-keys/${key.id}`);
      toast.success('Key revoked.');
      fetchKeys(org.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke key.');
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(issuedKey.key);
      toast.success('Copied.');
    } catch {
      toast.error('Copy failed — select and copy manually.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-warm-900 tracking-tight">API Keys</h2>
        <p className="text-sm text-warm-500">
          Issue and revoke /v1 public API credentials on behalf of a client organisation.
        </p>
      </div>

      {!org ? (
        <div className="bg-white rounded-3xl border border-warm-200 p-6 max-w-lg">
          <label className="text-sm font-bold text-warm-700 mb-2 block">
            Find the client to issue a key for
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-fx pl-11 h-12 text-base bg-white border-warm-200 focus:border-fox-500 rounded-2xl w-full"
            />
          </div>
          {searching && <Spinner size="sm" className="mt-3" />}
          {results.length > 0 && (
            <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pickOrg(u)}
                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-warm-50 transition-colors"
                >
                  <div className="text-sm font-bold text-warm-900">{u.name || u.email}</div>
                  <div className="text-xs text-warm-500">
                    {u.email} · {u.role}
                  </div>
                </button>
              ))}
            </div>
          )}
          {search.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="text-xs text-warm-400 mt-3">
              No matching client user with an organisation.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-white rounded-2xl border border-warm-200 px-5 py-3">
            <div>
              <div className="text-xs text-warm-400 uppercase tracking-wide font-bold">
                Acting for
              </div>
              <div className="text-sm font-bold text-warm-900">{org.label}</div>
              <div className="text-xs text-warm-500 font-mono">{org.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={openIssue}>
                <Plus size={16} /> Issue key
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setOrg(null)}>
                Change client
              </Button>
            </div>
          </div>

          {loadingKeys ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" variant="fox" />
            </div>
          ) : keys.length === 0 ? (
            <div className="bg-white/50 rounded-3xl border-2 border-dashed border-warm-200 p-16">
              <EmptyState
                icon={Key}
                title="No API keys yet"
                description="Issue one to let this client call the /v1 public API."
              />
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-warm-200 shadow-elevated overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-warm-50/50 border-b border-warm-200">
                    <th className="py-3 px-5 font-bold text-warm-700 uppercase tracking-wider text-xs">
                      Key
                    </th>
                    <th className="py-3 px-5 font-bold text-warm-700 uppercase tracking-wider text-xs">
                      Scopes
                    </th>
                    <th className="py-3 px-5 font-bold text-warm-700 uppercase tracking-wider text-xs">
                      Last used
                    </th>
                    <th className="py-3 px-5 font-bold text-warm-700 uppercase tracking-wider text-xs">
                      Created
                    </th>
                    <th className="py-3 px-5 font-bold text-warm-700 uppercase tracking-wider text-xs text-center">
                      Status
                    </th>
                    <th className="py-3 px-5 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-warm-100 last:border-0">
                      <td className="py-3 px-5 font-mono text-warm-800">{k.prefix}…</td>
                      <td className="py-3 px-5">
                        {(k.scopes || []).map((s) => (
                          <Badge key={s} variant="neutral" className="mr-1">
                            {s}
                          </Badge>
                        ))}
                      </td>
                      <td className="py-3 px-5 text-warm-500">
                        {k.lastUsed ? formatDate(k.lastUsed) : 'Never'}
                      </td>
                      <td className="py-3 px-5 text-warm-500">{formatDate(k.createdAt)}</td>
                      <td className="py-3 px-5 text-center">
                        <Badge variant={k.revokedAt ? 'danger' : 'success'}>
                          {k.revokedAt ? 'Revoked' : 'Active'}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-right">
                        {!k.revokedAt && (
                          <button
                            onClick={() => revoke(k)}
                            className="text-danger-500 hover:text-danger-700"
                            title="Revoke"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Issue an API key"
        size="sm"
      >
        {issuedKey ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-warning-50 text-warning-800 rounded-xl p-3 text-xs">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                {issuedKey.warning ||
                  'Copy this key now — it is not stored and cannot be shown again.'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-warm-50 rounded-xl p-3 font-mono text-sm break-all">
              {issuedKey.key}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={copyKey}>
                <Copy size={16} /> Copy key
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setIssuedKey(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Label (optional)"
              placeholder="e.g. Zapier integration"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div>
              <label className="text-sm font-bold text-warm-700 mb-2 block">Scopes</label>
              <div className="flex gap-2">
                {['read', 'write'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-bold border transition-colors',
                      scopes.includes(s)
                        ? 'bg-fox-500 border-fox-500 text-white'
                        : 'bg-white border-warm-200 text-warm-600',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-warm-400 mt-2">
                /v1 is a reporting API; write only covers webhook registration. Defaults to
                read-only if nothing is selected.
              </p>
            </div>
            <Button variant="primary" className="w-full" onClick={issue} disabled={issuing}>
              {issuing ? <Spinner size="sm" /> : 'Issue key'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

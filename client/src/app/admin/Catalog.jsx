import { useEffect, useState } from 'react';
import { Package, Plus, Trash2, Search, Pencil } from 'lucide-react';
import { usePageTitle, useDebounce } from '@lib/hooks';
import { formatINR, cn } from '@lib/utils';
import { Spinner, Button, EmptyState, Badge, Modal, Input, Select, Textarea } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'services', label: 'Services' },
  { key: 'features', label: 'Features' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'bundles', label: 'Bundles' },
];

const EMPTY_FORMS = {
  services: { id: '', categoryTier1: '', name: '', slug: '', baseWeight: '', sacCode: '998314', status: 'DRAFT', starterPrice: '', starterTimelineDays: '' },
  features: { id: '', serviceId: '', name: '', description: '', weight: '', defaultState: false },
  dependencies: { fromId: '', toId: '', type: 'REQUIRES' },
  bundles: { id: '', name: '', discountPct: '', matchThreshold: '90', status: 'ACTIVE' },
};

export default function Catalog() {
  usePageTitle('Admin Catalog');
  const [tab, setTab] = useState('services');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORMS.services);
  const [saving, setSaving] = useState(false);
  const q = useDebounce(search, 200);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/${tab}`, { params: { limit: 500 } });
      const data = r.data;
      // Some admin endpoints return a bare array, others the `{ data }` envelope
      // (services/bundles are paginated; features/dependencies are plain lists).
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : (data?.items || []);
      setItems(rows);
    } catch (err) {
      console.error('Fetch error:', err);
      setItems([]);
      toast.error(`Failed to load ${tab}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tab]);

  const filtered = q
    ? items.filter((i) => (i.name || i.id || '').toLowerCase().includes(q.toLowerCase()))
    : items;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORMS[tab]);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(tab === 'dependencies' ? item.id : item.id);
    setForm({ ...EMPTY_FORMS[tab], ...item });
    setModalOpen(true);
  };

  const buildPayload = () => {
    if (tab === 'services') {
      return {
        ...(editingId ? {} : { id: form.id }),
        categoryTier1: form.categoryTier1,
        name: form.name,
        slug: form.slug,
        baseWeight: Number(form.baseWeight) || 0,
        sacCode: form.sacCode,
        status: form.status,
        starterPrice: form.starterPrice ? Number(form.starterPrice) * 100 : null,
        starterTimelineDays: form.starterTimelineDays ? Number(form.starterTimelineDays) : null,
      };
    }
    if (tab === 'features') {
      return {
        ...(editingId ? {} : { id: form.id }),
        serviceId: form.serviceId,
        name: form.name,
        description: form.description || null,
        weight: Number(form.weight) || 1,
        defaultState: !!form.defaultState,
      };
    }
    if (tab === 'dependencies') {
      return { fromId: form.fromId, toId: form.toId, type: form.type };
    }
    return {
      ...(editingId ? {} : { id: form.id }),
      name: form.name,
      discountPct: Number(form.discountPct) || 0,
      matchThreshold: Number(form.matchThreshold) || 90,
      status: form.status,
      members: form.members ?? [],
    };
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/admin/${tab}/${editingId}`, buildPayload());
        toast.success('Updated.');
      } else {
        await api.post(`/admin/${tab}`, buildPayload());
        toast.success('Created.');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Delete this ${tab.slice(0, -1)}?`)) return;
    try {
      await api.delete(`/admin/${tab}/${item.id}`);
      toast.success('Deleted.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-warm-900 tracking-tight">Catalog Management</h2>
          <p className="text-sm text-warm-500">Manage services, features, dependencies, and bundles that power the Builder and estimation engine.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}><Plus size={16} /> Add {tab.slice(0, -1)}</Button>
      </div>

      <div className="flex gap-1 bg-warm-100 rounded-2xl p-1.5 w-fit border border-warm-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); }}
            className={cn(
              'px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
              tab === t.key ? 'bg-white shadow-nav text-fox-600' : 'text-warm-500 hover:text-warm-800 hover:bg-white/50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'dependencies' && (
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            placeholder={`Search in ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-fx pl-11 h-12 text-base bg-white border-warm-200 focus:border-fox-500 transition-all rounded-2xl"
          />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="xl" variant="fox" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/50 rounded-3xl border-2 border-dashed border-warm-200 p-20">
          <EmptyState icon={Package} title={`No ${tab} yet`} description="Add one to get started." />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-warm-200 shadow-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-warm-50/50 border-b border-warm-200">
                  <th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">Name / ID</th>
                  {tab === 'services' && <><th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">Category</th><th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">Status</th></>}
                  {tab === 'features' && <th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">Service</th>}
                  {tab === 'dependencies' && <><th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">From → To</th><th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">Type</th></>}
                  {tab === 'bundles' && <th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs">Discount</th>}
                  <th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs text-right">Price</th>
                  <th className="py-4 px-6 font-bold text-warm-700 uppercase tracking-wider text-xs text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-fox-50/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-warm-900 text-base">{item.name || `${item.fromId} → ${item.toId}`}</span>
                        <span className="text-xs font-mono text-warm-400 mt-0.5">{item.id || item.serviceId}</span>
                      </div>
                    </td>
                    {tab === 'services' && (<>
                      <td className="py-4 px-6"><Badge variant="neutral">{item.categoryTier1}</Badge></td>
                      <td className="py-4 px-6"><Badge variant={item.status === 'PUBLISHED' ? 'success' : 'warning'}>{item.status}</Badge></td>
                    </>)}
                    {tab === 'features' && <td className="py-4 px-6 text-xs font-mono text-warm-500">{item.serviceId}</td>}
                    {tab === 'dependencies' && (<>
                      <td className="py-4 px-6 text-xs font-mono text-warm-500">{item.fromId} → {item.toId}</td>
                      <td className="py-4 px-6"><Badge variant="neutral">{item.type}</Badge></td>
                    </>)}
                    {tab === 'bundles' && <td className="py-4 px-6 text-sm font-bold text-fox-600">{item.discountPct}%</td>}
                    <td className="py-4 px-6 text-right">
                      <span className="text-base font-black text-warm-900">
                        {item.starterPrice ? formatINR(item.starterPrice / 100) : '—'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        {tab !== 'dependencies' && (
                          <button onClick={() => openEdit(item)} className="p-2 hover:bg-warm-100 rounded-xl text-warm-400 hover:text-warm-900 transition-all" title="Edit">
                            <Pencil size={16} />
                          </button>
                        )}
                        <button onClick={() => remove(item)} className="p-2 hover:bg-danger-50 rounded-xl text-warm-400 hover:text-danger-500 transition-all" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs px-2 text-warm-400 font-medium">
        Showing {filtered.length} of {items.length} {tab}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editingId ? 'Edit' : 'Add'} ${tab.slice(0, -1)}`} size="md">
        <div className="space-y-4">
          {tab === 'services' && (<>
            {!editingId && <Input label="ID (e.g. SF-WEB-020)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />}
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <Input label="Category (categoryTier1)" value={form.categoryTier1} onChange={(e) => setForm({ ...form, categoryTier1: e.target.value })} />
            <Input label="Base weight" type="number" value={form.baseWeight} onChange={(e) => setForm({ ...form, baseWeight: e.target.value })} />
            <Input label="SAC code" value={form.sacCode} onChange={(e) => setForm({ ...form, sacCode: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'PUBLISHED', label: 'Published' }, { value: 'ARCHIVED', label: 'Archived' }]} />
            <Input label="Starter price (₹)" type="number" value={form.starterPrice} onChange={(e) => setForm({ ...form, starterPrice: e.target.value })} />
            <Input label="Starter timeline (days)" type="number" value={form.starterTimelineDays} onChange={(e) => setForm({ ...form, starterTimelineDays: e.target.value })} />
          </>)}
          {tab === 'features' && (<>
            {!editingId && <Input label="ID (e.g. SF-WEB-001-F01)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />}
            <Input label="Service ID" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} placeholder="SF-WEB-001" />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="Weight" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          </>)}
          {tab === 'dependencies' && (<>
            <Input label="From service ID" value={form.fromId} onChange={(e) => setForm({ ...form, fromId: e.target.value })} placeholder="SF-WEB-001" />
            <Input label="To service ID" value={form.toId} onChange={(e) => setForm({ ...form, toId: e.target.value })} placeholder="SF-DEVOPS-005" />
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'REQUIRES', label: 'Requires' }, { value: 'RECOMMENDS', label: 'Recommends' }, { value: 'ENHANCES', label: 'Enhances' }, { value: 'CONFLICTS', label: 'Conflicts' }]} />
          </>)}
          {tab === 'bundles' && (<>
            {!editingId && <Input label="ID (e.g. pkg-newbundle)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />}
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Discount %" type="number" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} />
            <Input label="Match threshold %" type="number" value={form.matchThreshold} onChange={(e) => setForm({ ...form, matchThreshold: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          </>)}
          <Button variant="primary" onClick={save} isLoading={saving}>{editingId ? 'Save changes' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}

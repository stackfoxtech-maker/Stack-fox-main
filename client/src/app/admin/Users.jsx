import { useEffect, useState } from 'react';
import { Users as UsersIcon, Plus, Search } from 'lucide-react';
import { usePageTitle, useDebounce } from '@lib/hooks';
import { formatDate, capitalize, cn } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button, Input, Modal, Select } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const roleBadge = { admin: 'fox', client: 'info', team: 'success', freelancer: 'warning' };

export default function AdminUsers() {
  usePageTitle('Admin Users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEAM' });
  const q = useDebounce(search, 200);

  const fetch = () => {
    const params = { limit: 100 };
    if (roleFilter !== 'all') params.role = roleFilter;
    if (q) params.search = q;
    api.get('/users', { params }).then((r) => setUsers(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [roleFilter, q]);

  const createUser = async () => {
    if (!form.name || !form.email || !form.password) { toast.error('Fill all fields.'); return; }
    try {
      await api.post('/users', form);
      toast.success('User created.');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'TEAM' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'Deactivated.' : 'Activated.');
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const isTeamMember = (user) => user.role?.toLowerCase() === 'team';

  const toggleTeamMember = async (user) => {
    const nextRole = isTeamMember(user) ? 'INDIVIDUAL_CLIENT' : 'TEAM';
    try {
      await api.put(`/users/${user._id}`, { role: nextRole });
      toast.success(isTeamMember(user) ? 'Removed from team.' : 'Added as team member.');
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Users</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus size={16} /> Add User</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-fx pl-9 text-sm" />
        </div>
        <div className="flex gap-1">
          {['all', 'client', 'team', 'admin', 'freelancer'].map((r) => (
            <button key={r} onClick={() => { setRoleFilter(r); setLoading(true); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', roleFilter === r ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600')}>
              {capitalize(r)}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> :
      users.length === 0 ? <EmptyState icon={UsersIcon} title="No users found" /> : (
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-warm-50 border-b border-warm-200">
              <th className="text-left py-3 px-4 font-semibold text-warm-700">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-warm-700">Email</th>
              <th className="text-center py-3 px-4 font-semibold text-warm-700">Role</th>
              <th className="text-center py-3 px-4 font-semibold text-warm-700">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-warm-700">Joined</th>
              <th className="text-right py-3 px-4 font-semibold text-warm-700">Actions</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-warm-100 hover:bg-warm-50">
                  <td className="py-3 px-4 font-medium text-warm-900">{u.name}</td>
                  <td className="py-3 px-4 text-warm-500">{u.email}</td>
                  <td className="py-3 px-4 text-center"><Badge variant={roleBadge[u.role?.toLowerCase()] || 'neutral'}>{u.role}</Badge></td>
                  <td className="py-3 px-4 text-center"><Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="py-3 px-4 text-right text-warm-500">{formatDate(u.createdAt)}</td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => toggleTeamMember(u)} className="text-xs text-fox-500 hover:underline">
                      {isTeamMember(u) ? 'Remove from team' : 'Make team member'}
                    </button>
                    <button onClick={() => toggleActive(u)} className="text-xs text-warm-500 hover:underline">
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create user">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={[{ value: 'TEAM', label: 'Team' }, { value: 'CLIENT', label: 'Client' }, { value: 'DEVELOPER', label: 'Developer' }, { value: 'PM', label: 'Project Manager' }, { value: 'ADMIN', label: 'Admin' }]} />
          <Button variant="primary" onClick={createUser}>Create User</Button>
        </div>
      </Modal>
    </div>
  );
}

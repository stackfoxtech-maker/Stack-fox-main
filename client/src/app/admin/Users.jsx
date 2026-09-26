import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, Plus, Search, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePageTitle, useDebounce } from '@lib/hooks';
import { formatDate, capitalize, cn } from '@lib/utils';
import {
  Spinner,
  Badge,
  EmptyState,
  Button,
  Input,
  Modal,
  Select,
} from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const roleBadge = {
  admin: 'fox',
  client: 'info',
  team: 'success',
  freelancer: 'warning',
  developer: 'warning',
  pm: 'info',
};

const DEFAULT_META = { pagination: { total: 0, page: 1, limit: 10, pages: 1 } };

export default function AdminUsers() {
  usePageTitle('Admin Users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'TEAM' });
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'TEAM' });
  const q = useDebounce(search, 200);
  const queryClient = useQueryClient();

  // Reference pattern for the client-wide TanStack Query adoption (see
  // main.jsx for the provider). Other pages keep their existing
  // useEffect+useState fetches until migrated individually — no big-bang
  // rewrite.
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['admin-users', { page, limit, roleFilter, q }],
    queryFn: async () => {
      const params = { page, limit };
      if (roleFilter !== 'all') params.role = roleFilter;
      if (q) params.search = q;
      const r = await api.get('/users', { params });
      return { users: r.data.data || [], meta: r.data.meta || DEFAULT_META };
    },
    placeholderData: (prev) => prev,
  });
  const users = data?.users || [];
  const meta = data?.meta || DEFAULT_META;
  const error = queryError ? queryError.response?.data?.message || 'Failed to fetch users.' : null;

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: (form) => api.post('/users', form),
    onSuccess: () => {
      toast.success('User created.');
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', role: 'TEAM' });
      invalidateUsers();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => api.put(`/users/${id}`, patch),
    onError: (err) => toast.error(err.response?.data?.message || 'Failed.'),
  });

  const createUser = () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error('Fill all fields.');
      return;
    }
    createMutation.mutate(createForm);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role?.toUpperCase() || 'TEAM' });
    setShowEdit(true);
  };

  const updateUser = () => {
    if (!editUser) return;
    updateMutation.mutate(
      {
        id: editUser._id,
        patch: { name: editForm.name, email: editForm.email, role: editForm.role },
      },
      {
        onSuccess: () => {
          toast.success('User updated.');
          setShowEdit(false);
          setEditUser(null);
          invalidateUsers();
        },
      },
    );
  };

  const toggleActive = (user) => {
    updateMutation.mutate(
      { id: user._id, patch: { isActive: !user.isActive } },
      {
        onSuccess: () => {
          toast.success(user.isActive ? 'Deactivated.' : 'Activated.');
          invalidateUsers();
        },
      },
    );
  };

  const isTeamMember = (user) => user.role?.toLowerCase() === 'team';

  const toggleTeamMember = (user) => {
    const nextRole = isTeamMember(user) ? 'CLIENT' : 'TEAM';
    updateMutation.mutate(
      { id: user._id, patch: { role: nextRole } },
      {
        onSuccess: () => {
          toast.success(isTeamMember(user) ? 'Removed from team.' : 'Added as team member.');
          invalidateUsers();
        },
      },
    );
  };

  const start =
    meta.pagination.total === 0 ? 0 : (meta.pagination.page - 1) * meta.pagination.limit + 1;
  const end = Math.min(meta.pagination.page * meta.pagination.limit, meta.pagination.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Users</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add User
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-fx pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'client', 'team', 'admin', 'freelancer'].map((r) => (
            <button
              key={r}
              onClick={() => {
                setRoleFilter(r);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                roleFilter === r ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600',
              )}
            >
              {capitalize(r)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" />
      ) : (
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-warm-200">
                <th className="text-left py-3 px-4 font-semibold text-warm-700">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-warm-700">Email</th>
                <th className="text-center py-3 px-4 font-semibold text-warm-700">Role</th>
                <th className="text-center py-3 px-4 font-semibold text-warm-700">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-warm-700">Joined</th>
                <th className="text-right py-3 px-4 font-semibold text-warm-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-warm-100 hover:bg-warm-50">
                  <td className="py-3 px-4 font-medium text-warm-900">{u.name}</td>
                  <td className="py-3 px-4 text-warm-500">{u.email}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={roleBadge[u.role?.toLowerCase()] || 'neutral'}>{u.role}</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right text-warm-500">{formatDate(u.createdAt)}</td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-xs text-fox-500 hover:underline inline-flex items-center gap-1"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={() => toggleTeamMember(u)}
                      className="text-xs text-fox-500 hover:underline"
                    >
                      {isTeamMember(u) ? 'Remove from team' : 'Make team member'}
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs text-warm-500 hover:underline"
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t border-warm-200">
            <span className="text-xs text-warm-500">
              Showing {start}-{end} of {meta.pagination.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.pagination.page <= 1}
              >
                <ChevronLeft size={14} /> Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(meta.pagination.pages, p + 1))}
                disabled={meta.pagination.page >= meta.pagination.pages}
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create user">
        <div className="space-y-4">
          <Input
            label="Name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          />
          <Input
            label="Password"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          />
          <Select
            label="Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            options={[
              { value: 'TEAM', label: 'Team' },
              { value: 'CLIENT', label: 'Client' },
              { value: 'DEVELOPER', label: 'Developer' },
              { value: 'PM', label: 'Project Manager' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
          <Button variant="primary" onClick={createUser}>
            Create User
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit user">
        <div className="space-y-4">
          <Input
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Select
            label="Role"
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            options={[
              { value: 'TEAM', label: 'Team' },
              { value: 'CLIENT', label: 'Client' },
              { value: 'DEVELOPER', label: 'Developer' },
              { value: 'PM', label: 'Project Manager' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
          <Button variant="primary" onClick={updateUser}>
            Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}

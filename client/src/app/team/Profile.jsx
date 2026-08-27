import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Input, Button } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';

export default function Profile() {
  usePageTitle('Team Profile');
  const { user, updateProfile, changePassword, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', designation: user?.designation || '', skills: user?.skills?.join(', ') || '' });
  const [pw, setPw] = useState({ current: '', new: '' });

  const handleSave = () => {
    updateProfile({ ...form, skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean) });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-warm-900">Profile</h2>
      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Email" value={user?.email || ''} disabled className="opacity-60" />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Senior Developer" />
        <Input label="Skills (comma-separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, MongoDB" />
        <Button variant="primary" onClick={handleSave} isLoading={isLoading}>Save</Button>
      </div>
      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <h3 className="font-medium text-warm-900">Change password</h3>
        <Input label="Current" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <Input label="New" type="password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} />
        <Button variant="outline" onClick={() => changePassword(pw.current, pw.new)} isLoading={isLoading}>Update</Button>
      </div>
    </div>
  );
}

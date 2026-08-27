import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Input, Textarea, Button } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';
import toast from 'react-hot-toast';

export default function Profile() {
  usePageTitle('Profile');
  const { user, updateProfile, changePassword, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    company: { name: user?.company?.name || '', gstNumber: user?.company?.gstNumber || '', address: { line1: user?.company?.address?.line1 || '', city: user?.company?.address?.city || '', state: user?.company?.address?.state || '', pincode: user?.company?.address?.pincode || '' } },
  });
  const [pw, setPw] = useState({ current: '', new: '' });
  const set = (path, val) => {
    const keys = path.split('.');
    setForm((prev) => {
      const next = { ...prev };
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = { ...obj[keys[i]] }; obj = obj[keys[i]]; }
      obj[keys[keys.length - 1]] = val;
      return next;
    });
  };

  const handleSave = () => updateProfile(form);
  const handlePw = () => {
    if (pw.new.length < 8) { toast.error('Min 8 characters.'); return; }
    changePassword(pw.current, pw.new);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-warm-900">Profile settings</h2>

      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <h3 className="font-medium text-warm-900">Personal info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Email" value={user?.email || ''} disabled className="opacity-60" />
          <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <h3 className="font-medium text-warm-900">Company details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Company name" value={form.company.name} onChange={(e) => set('company.name', e.target.value)} />
          <Input label="GST number" value={form.company.gstNumber} onChange={(e) => set('company.gstNumber', e.target.value)} placeholder="22AAAAA0000A1Z5" />
          <Input label="Address" value={form.company.address.line1} onChange={(e) => set('company.address.line1', e.target.value)} />
          <Input label="City" value={form.company.address.city} onChange={(e) => set('company.address.city', e.target.value)} />
          <Input label="State" value={form.company.address.state} onChange={(e) => set('company.address.state', e.target.value)} />
          <Input label="Pincode" value={form.company.address.pincode} onChange={(e) => set('company.address.pincode', e.target.value)} />
        </div>
      </div>

      <Button variant="primary" onClick={handleSave} isLoading={isLoading}>Save Changes</Button>

      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <h3 className="font-medium text-warm-900">Change password</h3>
        <Input label="Current password" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <Input label="New password" type="password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} placeholder="Min 8 characters" />
        <Button variant="outline" onClick={handlePw} isLoading={isLoading}>Update Password</Button>
      </div>
    </div>
  );
}

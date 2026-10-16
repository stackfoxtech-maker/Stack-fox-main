import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Input, Button } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';
import toast from 'react-hot-toast';
import api from '@lib/api';

export default function Profile() {
  usePageTitle('Profile');
  const { user, updateProfile, changePassword, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    company: {
      name: user?.company?.name || '',
      gstNumber: user?.company?.gstNumber || '',
      address: {
        line1: user?.company?.address?.line1 || '',
        city: user?.company?.address?.city || '',
        state: user?.company?.address?.state || '',
        pincode: user?.company?.address?.pincode || '',
      },
    },
  });
  const [pw, setPw] = useState({ current: '', new: '' });
  const set = (path, val) => {
    const keys = path.split('.');
    if (keys.some((k) => k === '__proto__' || k === 'constructor' || k === 'prototype')) return;
    setForm((prev) => {
      const next = { ...prev };
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = val;
      return next;
    });
  };

  // Only an organisation's owner or admin may change its company details.
  const canEditCompany = Boolean(user?.orgId) && ['ORG_OWNER', 'CLIENT_ADMIN'].includes(user?.role);

  // The profile route accepts only name and phone (it rejected the whole form, company
  // included, with a 400). Company details belong to the organisation and go to its own
  // route, with the field names it expects.
  const handleSave = async () => {
    const res = await updateProfile({ name: form.name, phone: form.phone });
    if (!res?.success || !canEditCompany) return;
    const c = form.company;
    const address = Object.fromEntries(
      Object.entries({
        line1: c.address.line1,
        city: c.address.city,
        state: c.address.state,
        postalCode: c.address.pincode,
      }).filter(([, v]) => v && v.trim()),
    );
    const body = {
      ...(c.name.trim() ? { name: c.name.trim() } : {}),
      ...(c.gstNumber.trim() ? { gstin: c.gstNumber.trim().toUpperCase() } : {}),
      ...(Object.keys(address).length ? { billingAddress: address } : {}),
    };
    if (!Object.keys(body).length) return;
    try {
      await api.patch(`/orgs/${user.orgId}`, body);
      toast.success('Company details saved.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save the company details.');
    }
  };
  const handlePw = () => {
    if (pw.new.length < 8) {
      toast.error('Min 8 characters.');
      return;
    }
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

      {canEditCompany && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
          <h3 className="font-medium text-warm-900">Company details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Company name"
              value={form.company.name}
              onChange={(e) => set('company.name', e.target.value)}
            />
            <Input
              label="GST number"
              value={form.company.gstNumber}
              onChange={(e) => set('company.gstNumber', e.target.value)}
              placeholder="22AAAAA0000A1Z5"
            />
            <Input
              label="Address"
              value={form.company.address.line1}
              onChange={(e) => set('company.address.line1', e.target.value)}
            />
            <Input
              label="City"
              value={form.company.address.city}
              onChange={(e) => set('company.address.city', e.target.value)}
            />
            <Input
              label="State"
              value={form.company.address.state}
              onChange={(e) => set('company.address.state', e.target.value)}
            />
            <Input
              label="Pincode"
              value={form.company.address.pincode}
              onChange={(e) => set('company.address.pincode', e.target.value)}
            />
          </div>
        </div>
      )}

      <Button variant="primary" onClick={handleSave} isLoading={isLoading}>
        Save Changes
      </Button>

      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <h3 className="font-medium text-warm-900">Change password</h3>
        <Input
          label="Current password"
          type="password"
          value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
        />
        <Input
          label="New password"
          type="password"
          value={pw.new}
          onChange={(e) => setPw({ ...pw, new: e.target.value })}
          placeholder="Min 8 characters"
        />
        <Button variant="outline" onClick={handlePw} isLoading={isLoading}>
          Update Password
        </Button>
      </div>
    </div>
  );
}

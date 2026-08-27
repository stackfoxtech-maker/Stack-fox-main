import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { Input, Button } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';

export default function ResetPassword() {
  usePageTitle('Reset Password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { resetPassword, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { return; }
    const result = await resetPassword(token, password);
    if (result.success) navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md">
        <h1 className="text-display-sm text-warm-900 mb-2">Set new password</h1>
        <p className="text-sm text-warm-500 mb-6">Choose a strong password for your account.</p>

        <div className="card-fx p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required />
            <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required error={confirm && password !== confirm ? 'Passwords do not match' : ''} />
            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full" disabled={!password || password !== confirm}>Reset Password</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

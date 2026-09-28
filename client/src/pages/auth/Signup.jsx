import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import useAuthStore from '@store/authStore';
import GoogleButton from '@components/auth/GoogleButton';
import AuthShell, { Item, OrDivider, SubmitButton } from '@components/auth/AuthShell';
import AuthField, { isEmail } from '@components/auth/AuthField';

export default function Signup() {
  usePageTitle('Sign up');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(form);
    if (result.success) navigate('/app/client');
  };

  return (
    <AuthShell
      variant="signup"
      title="Create your account"
      subtitle="Start building with StackFox today — it takes under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="inline-block px-1 py-2 font-medium text-fox-600 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <Item className="space-y-4">
        <GoogleButton label="Sign up with Google" />
        <OrDivider />
      </Item>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Item>
          <AuthField
            label="Full name"
            icon={User}
            valid={form.name.trim().length >= 2}
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
            required
            autoFocus
          />
        </Item>
        <Item>
          <AuthField
            label="Email"
            type="email"
            icon={Mail}
            valid={isEmail(form.email)}
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </Item>
        <Item>
          <AuthField
            password
            icon={Lock}
            label="Password"
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
            helperText="Min 8 characters"
            autoComplete="new-password"
            showStrength
            required
          />
        </Item>
        <Item>
          <SubmitButton isLoading={isLoading}>Create Account</SubmitButton>
        </Item>
        <Item>
          <p className="text-center text-xs text-warm-400">
            By signing up you agree to our{' '}
            <Link to="/legal" className="inline-block py-1.5 underline hover:text-warm-600">
              terms &amp; privacy policy
            </Link>
            .
          </p>
        </Item>
      </form>
    </AuthShell>
  );
}

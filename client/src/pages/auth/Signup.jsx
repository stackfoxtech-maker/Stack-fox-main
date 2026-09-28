import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import useAuthStore from '@store/authStore';
import GoogleButton from '@components/auth/GoogleButton';
import AuthShell, { Item, OrDivider, SubmitButton } from '@components/auth/AuthShell';
import AuthField, { isEmail } from '@components/auth/AuthField';

export default function Signup() {
  usePageTitle('Sign up');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // A referral invite email links here with ?ref=CODE. Stash it so the
  // checkout wizard (pages/Checkout.jsx) can prefill it later — the person
  // is signing up now, not necessarily checking out in the same visit.
  useEffect(() => {
    const ref = searchParams.get('ref')?.trim();
    if (ref) localStorage.setItem('stackfox_referral_code', ref.toUpperCase());
  }, [searchParams]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // "+91 98765-43210" -> "+919876543210": the API accepts digits with an
    // optional leading +. The number is a contact detail; the account is
    // verified by email.
    const phone = form.phone.replace(/(?!^\+)[^\d]/g, '');
    const result = await register({ ...form, phone: phone || undefined });
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
            label="Phone"
            type="tel"
            inputMode="tel"
            icon={Phone}
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91 98765 43210"
            helperText="So your project team can reach you. We verify your account by email."
            autoComplete="tel"
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

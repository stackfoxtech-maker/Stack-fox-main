import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Input, Button } from '@components/ui/Primitives';
import { BrandLogo } from '@components/ui/BrandLogo';
import useAuthStore from '@store/authStore';
import GoogleButton from '@components/auth/GoogleButton';

export default function Signup() {
  usePageTitle('Sign up');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPw, setShowPw] = useState(false);
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await register(form);
    if (result.success) navigate('/app/client');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <BrandLogo size={32} withBackground containerClassName="shadow-sm shadow-fox-200 group-hover:scale-105 transition-transform" />
            <span className="text-xl font-semibold"><span className="text-warm-900">stack</span><span className="text-fox-500">fox</span></span>
          </Link>
          <h1 className="text-display-sm text-warm-900">Create your account</h1>
          <p className="text-sm text-warm-500 mt-1">Start building with StackFox today</p>
        </div>

        <div className="card-fx p-6">
          <div className="space-y-4">
            <GoogleButton label="Sign up with Google" />
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-warm-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs uppercase tracking-wide text-warm-400">or</span></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <Input label="Full name" value={form.name} onChange={set('name')} required autoFocus />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
            <Input label="Phone" value={form.phone} onChange={set('phone')} required />
            <div className="relative">
              <Input label="Password" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••" helperText="Min 8 characters" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-9 text-warm-400 hover:text-warm-600">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
              Create Account <ArrowRight size={18} />
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-warm-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-fox-500 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

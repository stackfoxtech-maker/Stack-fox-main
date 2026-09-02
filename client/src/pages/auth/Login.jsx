import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Input, Button } from '@components/ui/Primitives';
import { BrandLogo } from '@components/ui/BrandLogo';
import useAuthStore from '@store/authStore';
import GoogleButton from '@components/auth/GoogleButton';

// Google sends the user back through /auth/google/callback, which redirects
// here with a machine-readable reason rather than a raw provider string.
const OAUTH_ERRORS = {
  access_denied: 'You cancelled the Google sign-in.',
  email_unverified: 'That Google account has an unverified email address.',
  account_disabled: 'This account is disabled. Contact support to reactivate it.',
  expired_state: 'That sign-in attempt timed out. Please try again.',
  google_exchange_failed: 'Google sign-in failed. Please try again.',
  session_unavailable: 'Sign-in is temporarily unavailable. Please try again shortly.',
  invalid_response: 'Google returned an unexpected response. Please try again.',
};

const PHONE_RE = /^(\+?\d{10,15})$/;

export default function Login() {
  usePageTitle('Log in');
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpStep, setOtpStep] = useState('enter-phone'); // 'enter-phone' | 'enter-code'
  const { login, sendOtp, verifyOtp, isLoading, getDashboardPath } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const oauthError = params.get('error');
  const expired = params.get('expired');
  const notice = oauthError
    ? OAUTH_ERRORS[oauthError] || 'Google sign-in failed. Please try again.'
    : expired
      ? 'Your session expired. Please log in again.'
      : '';

  const done = (result) => {
    if (result.success) navigate(getDashboardPath());
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    done(await login(email, password));
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    const p = phone.replace(/[^\d+]/g, '');
    if (!PHONE_RE.test(p)) return;
    const r = await sendOtp({ phone: p });
    if (r.success) setOtpStep('enter-code');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    done(await verifyOtp({ phone: phone.replace(/[^\d+]/g, ''), code: code.trim() }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <BrandLogo size={32} withBackground containerClassName="shadow-sm shadow-fox-200 group-hover:scale-105 transition-transform" />
            <span className="text-xl font-semibold"><span className="text-warm-900">stack</span><span className="text-fox-500">fox</span></span>
          </Link>
          <h1 className="text-display-sm text-warm-900">Welcome back</h1>
          <p className="text-sm text-warm-500 mt-1">Log in to your StackFox account</p>
        </div>

        <div className="card-fx p-6">
          {notice && (
            <div role="alert" className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/5 px-4 py-3 text-sm text-danger-700">
              {notice}
            </div>
          )}

          <div className="space-y-4">
            <GoogleButton label="Continue with Google" />
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-warm-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs uppercase tracking-wide text-warm-400">or</span></div>
            </div>
          </div>

          {/* mode switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-warm-100 mt-4 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`py-2 rounded-lg transition ${mode === 'password' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500'}`}
            >
              Email &amp; password
            </button>
            <button
              type="button"
              onClick={() => { setMode('otp'); setOtpStep('enter-phone'); }}
              className={`py-2 rounded-lg transition ${mode === 'otp' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500'}`}
            >
              Phone OTP
            </button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePassword} className="space-y-4 mt-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
              <div className="relative">
                <Input label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-9 text-warm-400 hover:text-warm-600">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="flex justify-end -mt-1">
                <Link to="/forgot-password" className="inline-flex min-h-[36px] items-center px-1 text-sm font-medium text-fox-600 hover:text-fox-700 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
                Log in <ArrowRight size={18} />
              </Button>
            </form>
          ) : otpStep === 'enter-phone' ? (
            <form onSubmit={handleSendCode} className="space-y-4 mt-4">
              <Input
                label="Phone number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                helperText="We'll text you a 6-digit code"
                required
                autoFocus
              />
              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
                Send code <ArrowRight size={18} />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4 mt-4">
              <button type="button" onClick={() => setOtpStep('enter-phone')} className="inline-flex items-center gap-1 text-sm text-warm-500 hover:text-warm-800">
                <ArrowLeft size={14} /> {phone}
              </button>
              <Input
                label="Verification code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                required
                autoFocus
              />
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => sendOtp({ phone: phone.replace(/[^\d+]/g, '') })} className="text-sm font-medium text-fox-600 hover:text-fox-700 hover:underline">
                  Resend code
                </button>
              </div>
              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
                Verify &amp; log in <ArrowRight size={18} />
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-warm-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-fox-500 font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

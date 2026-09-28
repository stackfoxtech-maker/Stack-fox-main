import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Input } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';
import GoogleButton from '@components/auth/GoogleButton';
import AuthShell, { Item, OrDivider, SubmitButton } from '@components/auth/AuthShell';
import AuthField, { isEmail } from '@components/auth/AuthField';

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

// Phone/SMS OTP login. Off until MSG91 has a DLT-approved OTP template
// (MSG91_OTP_TEMPLATE_ID on the API) — without it MSG91 accepts the send but
// nothing is delivered, so the tab would be a dead end. Flip on with
// VITE_PHONE_OTP=true once SMS actually works.
const PHONE_OTP_ENABLED = import.meta.env.VITE_PHONE_OTP === 'true';

export default function Login() {
  usePageTitle('Log in');
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpStep, setOtpStep] = useState('enter-phone'); // 'enter-phone' | 'enter-code'
  const { login, sendOtp, verifyOtp, isLoading, getDashboardPath } = useAuthStore();
  const navigate = useNavigate();
  const shake = useAnimationControls();
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
    else shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
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
    <AuthShell
      variant="login"
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="inline-block px-1 py-2 font-medium text-fox-600 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      {notice && (
        <Item>
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/5 px-4 py-3 text-sm text-danger-700"
          >
            {notice}
          </div>
        </Item>
      )}

      <Item className="space-y-4">
        <GoogleButton label="Continue with Google" />
        <OrDivider />
      </Item>

      {/* mode switch — only shown when there's more than one method */}
      {PHONE_OTP_ENABLED && (
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
            onClick={() => {
              setMode('otp');
              setOtpStep('enter-phone');
            }}
            className={`py-2 rounded-lg transition ${mode === 'otp' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500'}`}
          >
            Phone OTP
          </button>
        </div>
      )}

      <Item>
        <motion.div animate={shake}>
          {mode === 'password' || !PHONE_OTP_ENABLED ? (
            <form onSubmit={handlePassword} className="space-y-4 mt-4">
              <AuthField
                label="Email"
                type="email"
                icon={Mail}
                valid={isEmail(email)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
              <AuthField
                password
                icon={Lock}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="current-password"
                required
              />
              <div className="flex justify-end -mt-1">
                <Link
                  to="/forgot-password"
                  className="inline-flex min-h-[36px] items-center px-1 text-sm font-medium text-fox-600 hover:text-fox-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <SubmitButton isLoading={isLoading}>Log in</SubmitButton>
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
              <SubmitButton isLoading={isLoading}>Send code</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4 mt-4">
              <button
                type="button"
                onClick={() => setOtpStep('enter-phone')}
                className="inline-flex items-center gap-1 text-sm text-warm-500 hover:text-warm-800"
              >
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
                <button
                  type="button"
                  onClick={() => sendOtp({ phone: phone.replace(/[^\d+]/g, '') })}
                  className="text-sm font-medium text-fox-600 hover:text-fox-700 hover:underline"
                >
                  Resend code
                </button>
              </div>
              <SubmitButton isLoading={isLoading}>Verify &amp; log in</SubmitButton>
            </form>
          )}
        </motion.div>
      </Item>
    </AuthShell>
  );
}

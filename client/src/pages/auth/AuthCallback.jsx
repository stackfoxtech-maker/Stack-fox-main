/**
 * Landing spot for the Google round-trip.
 *
 * The API hands the session back in the URL fragment — never the query string,
 * which would be written to server access logs and leaked in Referer headers.
 * We read it once, hand it to the store, and scrub it from history so a Back
 * press or a shared URL cannot replay it.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { Spinner } from '@components/ui/Primitives';
import useAuthStore from '@store/authStore';

export default function AuthCallback() {
  usePageTitle('Signing you in');
  const navigate = useNavigate();
  const { completeOAuthLogin, getDashboardPath } = useAuthStore();
  const [error, setError] = useState('');
  // React 18 StrictMode mounts effects twice in dev; the fragment is consumed
  // on the first pass, so the second must not treat its absence as a failure.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const redirect = params.get('redirect');

    window.history.replaceState({}, document.title, '/auth/callback');

    if (!accessToken) {
      setError('That sign-in link was incomplete. Please try again.');
      return;
    }

    completeOAuthLogin({ accessToken, refreshToken }).then((result) => {
      if (!result.success) {
        setError(result.message || 'We could not complete your sign-in.');
        return;
      }
      navigate(redirect || getDashboardPath(), { replace: true });
    });
  }, [completeOAuthLogin, getDashboardPath, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-md text-center">
        {error ? (
          <div className="card-fx p-8">
            <h1 className="text-display-sm text-warm-900 mb-2">Sign-in failed</h1>
            <p className="text-sm text-warm-500 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="btn-fox text-[15px] px-5 py-2.5 rounded-xl"
            >
              Back to login
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-warm-500">Signing you in…</p>
          </div>
        )}
      </div>
    </div>
  );
}

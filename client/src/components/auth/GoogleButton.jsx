/**
 * Kicks off Google sign-in.
 *
 * A full-page navigation rather than an XHR: the API answers with a 302 to
 * Google's consent screen, which only the browser's address bar can follow.
 * Nothing Google-specific is bundled here — the client id and secret live on
 * the server, so this button works as soon as the API is configured.
 */
import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function GoogleButton({ label = 'Continue with Google', redirect }) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const start = () => {
    setIsRedirecting(true);
    const url = new URL(`${API_BASE}/auth/google`, window.location.origin);
    if (redirect) url.searchParams.set('redirect', redirect);
    window.location.href = url.toString();
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={isRedirecting}
      className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-warm-200 bg-white px-5 py-3 text-[15px] font-medium text-warm-800 transition-all duration-150 hover:bg-warm-50 hover:border-warm-300 focus:outline-none focus:ring-2 focus:ring-fox-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <GoogleMark />
      {isRedirecting ? 'Redirecting…' : label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

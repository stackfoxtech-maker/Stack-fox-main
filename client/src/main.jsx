import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { initSentry } from './lib/sentry';

// Adopted incrementally (see client/src/app/admin/Users.jsx for the reference
// pattern) — existing useEffect+useState fetches keep working unmigrated,
// there is no big-bang rewrite.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Before render, so an error thrown during the first paint is reported too.
initSentry();

// PWA shell — production only. In dev a SW just sits in front of Vite's module
// graph and causes "failed to fetch script" noise. Existing dev registrations
// are torn down here so they stop interfering.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster
          position="top-right"
          gutter={12}
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: '14px',
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.08)',
            },
            success: {
              iconTheme: { primary: '#639922', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#E24B4A', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

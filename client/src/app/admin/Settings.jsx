import { useEffect, useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Settings as SettingsIcon, Database, Mail, CreditCard, Shield, RefreshCw, Cloud, Server } from 'lucide-react';
import { Badge, Spinner, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

function ConfigStatus({ ok, label }) {
  return ok ? (
    <Badge variant="success">{label || 'Configured'}</Badge>
  ) : (
    <Badge variant="neutral">{label || 'Not configured'}</Badge>
  );
}

export default function AdminSettings() {
  usePageTitle('Admin Settings');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/settings')
      .then((r) => setConfig(r.data))
      .catch(() => toast.error('Failed to load settings.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (!config) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h2 className="text-lg font-semibold text-warm-900">Settings</h2>
        <EmptyState icon={SettingsIcon} title="Unable to load settings" description="Please try again." action={
          <button onClick={load} className="btn-outline px-4 py-2 rounded-xl text-sm">Retry</button>
        } />
      </div>
    );
  }

  const sections = [
    { icon: Database, title: 'Database', desc: 'PostgreSQL (Supabase) connection status and backup configuration.', status: <ConfigStatus ok /> },
    { icon: Mail, title: 'Email (SMTP)', desc: config.smtpHost ? `SMTP host: ${config.smtpHost}` : 'Configure SendGrid or SMTP for transactional emails.', status: <ConfigStatus ok={config.smtpConfigured} /> },
    { icon: CreditCard, title: 'Razorpay', desc: 'Payment gateway credentials and webhook configuration.', status: <ConfigStatus ok={config.razorpayConfigured} label={config.razorpayConfigured ? 'Configured' : 'Not configured'} /> },
    { icon: CreditCard, title: 'Stripe', desc: 'Stripe payment gateway credentials.', status: <ConfigStatus ok={config.stripeConfigured} label={config.stripeConfigured ? 'Configured' : 'Not configured'} /> },
    { icon: Cloud, title: 'Storage (S3/R2)', desc: 'Object storage for files and assets.', status: <ConfigStatus ok={config.s3Configured} label={config.s3Configured ? 'Configured' : 'Not configured'} /> },
    { icon: Shield, title: 'Security', desc: `JWT secrets, rate limiting, and CORS. Environment: ${config.environment || 'development'}.`, status: <ConfigStatus ok label="Active" /> },
  ];

  const flags = config.featureFlags || {};

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Settings</h2>
        <button onClick={load} className="flex items-center gap-2 text-sm text-warm-500 hover:text-fox-500 transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-warm-200 p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center shrink-0">
              <s.icon size={20} className="text-warm-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-warm-900">{s.title}</h3>
              <p className="text-sm text-warm-500 mt-0.5">{s.desc}</p>
            </div>
            <span className="shrink-0">{s.status}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-warm-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-warm-600" />
          <h3 className="font-semibold text-warm-900">Feature Flags</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between bg-warm-50 rounded-xl px-4 py-3">
            <span className="text-sm text-warm-700">Maintenance Mode</span>
            <Badge variant={flags.maintenanceMode ? 'warning' : 'success'}>{flags.maintenanceMode ? 'On' : 'Off'}</Badge>
          </div>
          <div className="flex items-center justify-between bg-warm-50 rounded-xl px-4 py-3">
            <span className="text-sm text-warm-700">New Registration</span>
            <Badge variant={flags.newRegistration ? 'success' : 'neutral'}>{flags.newRegistration ? 'Enabled' : 'Disabled'}</Badge>
          </div>
          <div className="flex items-center justify-between bg-warm-50 rounded-xl px-4 py-3">
            <span className="text-sm text-warm-700">Referrals</span>
            <Badge variant={flags.referralsEnabled ? 'success' : 'neutral'}>{flags.referralsEnabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>
        </div>
      </div>

      <div className="bg-warm-100 rounded-2xl p-6 text-center">
        <p className="text-sm text-warm-600">All configuration is managed via environment variables in <code className="bg-white px-2 py-0.5 rounded text-fox-500 text-xs font-mono">.env</code></p>
        <p className="text-xs text-warm-400 mt-2">See README.md for the complete list of available settings.</p>
      </div>
    </div>
  );
}

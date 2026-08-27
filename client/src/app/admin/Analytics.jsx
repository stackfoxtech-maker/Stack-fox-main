import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Package, AlertTriangle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatINRShort } from '@lib/utils';
import { Spinner, Badge } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Analytics() {
  usePageTitle('Admin Analytics');
  const [revenue, setRevenue] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setLoading(true);
    setErrors({});
    let cancelled = false;

    Promise.all([
      api.get('/analytics/revenue').catch((err) => {
        if (!cancelled) setErrors((p) => ({ ...p, revenue: err?.response?.data?.message || err?.message || 'Failed' }));
        return { data: { data: [] } };
      }),
      api.get('/analytics/conversion').catch((err) => {
        if (!cancelled) setErrors((p) => ({ ...p, conversion: err?.response?.data?.message || err?.message || 'Failed' }));
        return { data: { data: {} } };
      }),
      api.get('/analytics/services').catch((err) => {
        if (!cancelled) setErrors((p) => ({ ...p, services: err?.response?.data?.message || err?.message || 'Failed' }));
        return { data: { data: [] } };
      }),
    ]).then(([r, c, s]) => {
      if (!cancelled) {
        setRevenue(r.data.data);
        setConversion(c.data.data);
        setServices(s.data.data);
      }
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-warm-900">Analytics</h2>

      {errors.revenue && (
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-danger-600 mt-0.5" size={18} />
          <div>
            <p className="font-bold text-danger-800 text-sm">Revenue data unavailable</p>
            <p className="text-sm text-danger-700 mt-1">{errors.revenue}</p>
          </div>
        </div>
      )}

      {/* Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <div className="text-xs text-warm-500 mb-1">Total revenue</div>
          <div className="text-2xl font-bold font-mono text-warm-900">{formatINR(revenue?.totalRevenue || 0)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <div className="text-xs text-warm-500 mb-1">Pending amount</div>
          <div className="text-2xl font-bold font-mono text-warning-500">{formatINR(revenue?.pendingAmount || 0)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <div className="text-xs text-warm-500 mb-1">Conversion rate</div>
          <div className="text-2xl font-bold font-mono text-success-700">{conversion?.conversionRate || 0}%</div>
          <p className="text-[10px] text-warm-400 mt-1">{conversion?.paidQuotes || 0} of {conversion?.totalQuotes || 0} quotes converted</p>
        </div>
      </div>

      {/* Conversion drill-down */}
      {conversion?.totalQuotes != null && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-4">Conversion breakdown</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-warm-500 mb-1">
                <span>Converted</span>
                <span>{conversion.paidQuotes} / {conversion.totalQuotes}</span>
              </div>
              <div className="h-3 bg-warm-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success-500 rounded-full transition-all"
                  style={{ width: `${conversion.totalQuotes > 0 ? Math.round((conversion.paidQuotes / conversion.totalQuotes) * 100) : 0}%` }}
                />
              </div>
            </div>
            <Badge variant={conversion.conversionRate >= 50 ? 'success' : 'warning'}>{conversion.conversionRate}%</Badge>
          </div>
          <p className="text-xs text-warm-400">
            {conversion.totalQuotes - (conversion.paidQuotes || 0)} quotes did not convert in this period.
          </p>
        </div>
      )}

      {/* Monthly revenue */}
      {revenue?.length > 0 && !errors.revenue && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-4">Monthly revenue</h3>
          <div className="space-y-2">
            {revenue.map((m, i) => {
              const maxRev = Math.max(...revenue.map((x) => x.value));
              const pct = maxRev > 0 ? (m.value / maxRev) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-warm-500 w-24 font-mono">{m.label}</span>
                  <div className="flex-1 h-6 bg-warm-100 rounded-lg overflow-hidden">
                    <div className="h-full bg-fox-500 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono text-warm-700 w-24 text-right">{formatINRShort(m.value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular services */}
      {services?.length > 0 && !errors.services && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-4">Popular services</h3>
          <div className="space-y-2">
            {services.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-mono text-warm-400 w-6">{i + 1}.</span>
                <span className="text-sm text-warm-900 flex-1">{s.serviceName}</span>
                <span className="text-xs text-warm-500">{s.count} orders</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

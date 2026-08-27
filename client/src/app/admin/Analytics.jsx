import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Package } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatINRShort } from '@lib/utils';
import { Spinner } from '@components/ui/Primitives';
import api from '@lib/api';

export default function Analytics() {
  usePageTitle('Admin Analytics');
  const [revenue, setRevenue] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/revenue').catch(() => ({ data: { data: {} } })),
      api.get('/analytics/conversion').catch(() => ({ data: { data: {} } })),
      api.get('/analytics/services').catch(() => ({ data: { data: {} } })),
    ]).then(([r, c, s]) => {
      setRevenue(r.data.data);
      setConversion(c.data.data);
      setServices(s.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-warm-900">Analytics</h2>

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
          <p className="text-[10px] text-warm-400 mt-1">{conversion?.convertedQuotes || 0} of {conversion?.totalQuotes || 0} quotes converted</p>
        </div>
      </div>

      {/* Monthly revenue */}
      {revenue?.monthlyRevenue?.length > 0 && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-4">Monthly revenue</h3>
          <div className="space-y-2">
            {revenue.monthlyRevenue.map((m, i) => {
              const maxRev = Math.max(...revenue.monthlyRevenue.map((x) => x.revenue));
              const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-warm-500 w-16 font-mono">{m.month}/{m.year}</span>
                  <div className="flex-1 h-6 bg-warm-100 rounded-lg overflow-hidden">
                    <div className="h-full bg-fox-500 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono text-warm-700 w-24 text-right">{formatINRShort(m.revenue)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular services */}
      {services?.popularServices?.length > 0 && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-4">Popular services</h3>
          <div className="space-y-2">
            {services.popularServices.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-mono text-warm-400 w-6">{i + 1}.</span>
                <span className="text-sm text-warm-900 flex-1">{s.name}</span>
                <span className="text-xs text-warm-500">{s.count} orders</span>
                <span className="text-xs font-mono text-warm-700">{formatINRShort(s.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { DollarSign, FolderKanban, Users, LifeBuoy, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatINRShort, formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const KPI = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-2xl border border-warm-200 p-5">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={20} /></div>
    </div>
    <div className="text-2xl font-bold font-mono text-warm-900">{value}</div>
    <div className="text-xs text-warm-500 mt-1">{label}</div>
    {sub && <div className="text-[10px] text-warm-400 mt-0.5">{sub}</div>}
  </div>
);

const todayISO = () => new Date().toISOString().slice(0, 10);
const sixMonthsAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export default function Overview() {
  usePageTitle('Admin Overview');
  const [data, setData] = useState(null);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: sixMonthsAgo(), to: todayISO() });
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, revenueRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/revenue', { params: { from: range.from, to: range.to } }),
      ]);
      setData(overviewRes.data.data);
      setRevenueSeries(Array.isArray(revenueRes.data.data) ? revenueRes.data.data : []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load dashboard data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [range.from, range.to]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const calcTrend = () => {
    if (!revenueSeries || revenueSeries.length < 2) return null;
    const last = revenueSeries[revenueSeries.length - 1]?.value || 0;
    const prev = revenueSeries[revenueSeries.length - 2]?.value || 0;
    if (prev === 0) return last > 0 ? { direction: 'up', pct: 100 } : { direction: 'flat', pct: 0 };
    const pct = Math.round(((last - prev) / prev) * 100);
    if (pct > 0) return { direction: 'up', pct };
    if (pct < 0) return { direction: 'down', pct: Math.abs(pct) };
    return { direction: 'flat', pct: 0 };
  };

  const trend = calcTrend();

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (error && !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-display-sm text-warm-900">Dashboard</h2>
        <div className="bg-danger-50 border border-danger-200 rounded-2xl p-6 flex items-start gap-3">
          <div>
            <p className="font-bold text-danger-800 text-sm">Failed to load dashboard</p>
            <p className="text-sm text-danger-700 mt-1">{error}</p>
            <button onClick={handleRefresh} className="mt-3 text-xs font-bold text-danger-800 underline">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const d = data || { totalRevenue: 0, totalProjects: 0, activeClients: 0, pendingInvoices: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-display-sm text-warm-900">Dashboard</h2>
        <div className="flex items-center gap-2">
          <input
            type="date" value={range.from} max={range.to}
            onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-fox-500/30"
          />
          <span className="text-xs text-warm-400">to</span>
          <input
            type="date" value={range.to} min={range.from}
            onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-fox-500/30"
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warm-100 text-warm-700 text-xs font-medium hover:bg-warm-200 disabled:opacity-50 transition"
          >
            {refreshing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 text-sm text-warning-700 flex items-start gap-2">
          <span>Some data may be stale: {error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total revenue" value={formatINRShort(d.totalRevenue)} icon={DollarSign} color="bg-success-50 text-success-700" sub={`This period: ${formatDate(range.from)} - ${formatDate(range.to)}`} />
        <KPI label="Active projects" value={d.totalProjects} icon={FolderKanban} color="bg-info-50 text-info-700" />
        <KPI label="Clients" value={d.activeClients} icon={Users} color="bg-fox-50 text-fox-600" />
        <KPI label="Pending invoices" value={d.pendingInvoices} icon={LifeBuoy} color="bg-warning-50 text-warning-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-1">Pending invoices</h3>
          <div className="text-3xl font-bold font-mono text-fox-500">{d.pendingInvoices}</div>
          <p className="text-xs text-warm-500 mt-1">Awaiting payment</p>
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-1">Revenue trend</h3>
          {trend ? (
            <div className="flex items-center gap-2">
              {trend.direction === 'up' && <TrendingUp size={20} className="text-success-500" />}
              {trend.direction === 'down' && <TrendingDown size={20} className="text-danger-500" />}
              {trend.direction === 'flat' && <Minus size={20} className="text-warm-400" />}
              <span className="text-sm text-warm-600">
                {trend.direction === 'up' && `Up ${trend.pct}% vs previous period`}
                {trend.direction === 'down' && `Down ${trend.pct}% vs previous period`}
                {trend.direction === 'flat' && 'Flat vs previous period'}
              </span>
            </div>
          ) : (
            <p className="text-sm text-warm-400">Insufficient data to calculate trend</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="font-semibold text-warm-900 mb-1">Date range</h3>
          <p className="text-xs text-warm-500">{formatDate(range.from)} - {formatDate(range.to)}</p>
          <p className="text-[10px] text-warm-400 mt-1">KPIs reflect selected period</p>
        </div>
      </div>
    </div>
  );
}

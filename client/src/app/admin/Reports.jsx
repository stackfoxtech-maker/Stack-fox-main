import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { BarChart3, Users, Briefcase, Wrench, Download, Calendar, Loader2 } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Spinner } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

/**
 * Each tab is a distinct server-side report over the selected date range.
 * Previously all four buttons produced the same CSV and the date pickers were
 * decorative.
 */
const REPORTS = [
  { key: 'revenue', label: 'Revenue', icon: BarChart3, color: 'text-success-700 bg-success-50',
    desc: 'Invoiced versus collected, and where revenue is concentrated by client.' },
  { key: 'projects', label: 'Projects', icon: Briefcase, color: 'text-info-700 bg-info-50',
    desc: 'Completion rates, milestone progress and which projects are running late.' },
  { key: 'users', label: 'Users', icon: Users, color: 'text-purple-600 bg-purple-50',
    desc: 'Signups by month, role mix and accounts going cold.' },
  { key: 'services', label: 'Services', icon: Wrench, color: 'text-fox-600 bg-fox-500/10',
    desc: 'Which catalogue items actually sell, and what they earn.' },
];

const CHART_COLOR = '#FF6B35';
const CHART_COLOR_ALT = '#2563EB';

/** Six months back, as YYYY-MM-DD. */
const defaultFrom = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const isoNDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const startOfQuarterISO = () => {
  const d = new Date();
  const qm = d.getMonth() - (d.getMonth() % 3);
  return new Date(d.getFullYear(), qm, 1).toISOString().slice(0, 10);
};

const startOfYearISO = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

const Stat = ({ label, value }) => (
  <div className="bg-white rounded-2xl border border-warm-200 p-5">
    <div className="text-xs text-warm-500">{label}</div>
    <div className="text-xl font-bold font-mono text-warm-900 mt-1">{value}</div>
  </div>
);

const Table = ({ columns, rows, render }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-warm-500 border-b border-warm-200">
          {columns.map((c) => <th key={c} className="py-2 pr-4 font-medium">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-warm-100 last:border-0">{render(r)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Td = ({ children, mono }) => (
  <td className={`py-2 pr-4 text-warm-800 ${mono ? 'font-mono' : ''}`}>{children}</td>
);

export default function Reports() {
  usePageTitle('Admin Reports');
  const [type, setType] = useState('revenue');
  const [range, setRange] = useState({ from: defaultFrom(), to: new Date().toISOString().slice(0, 10) });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/admin/reports/${type}`, { params: { from: range.from, to: range.to } })
      .then((r) => setReport(r.data.data))
      .catch((err) => {
        setReport(null);
        setError(err.response?.data?.message || 'Could not load that report.');
      })
      .finally(() => setLoading(false));
  }, [type, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  // The CSV is rendered server-side so it always matches what is on screen.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/admin/reports/${type}/export`, {
        params: { from: range.from, to: range.to },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `stackfox-${type}-${range.from}_${range.to}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded.');
    } catch {
      toast.error('Could not export that report.');
    } finally {
      setExporting(false);
    }
  };

  const t = report?.totals ?? {};
  const active = REPORTS.find((r) => r.key === type);

  const presets = [
    { label: 'Last 30 days', from: isoNDaysAgo(30), to: todayISO() },
    { label: 'This quarter', from: startOfQuarterISO(), to: todayISO() },
    { label: 'Year to date', from: startOfYearISO(), to: todayISO() },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-warm-900">Business Reports</h2>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-warm-400" />
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
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setRange({ from: p.from, to: p.to })}
              className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 hover:bg-warm-50 transition"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={exportCsv} disabled={exporting || loading || !report}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fox-500 text-white text-xs font-medium hover:bg-fox-600 disabled:opacity-50 transition"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setType(r.key)}
            className={`text-left bg-white rounded-2xl border p-4 transition ${
              type === r.key ? 'border-fox-400 ring-2 ring-fox-500/20' : 'border-warm-200 hover:border-warm-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${r.color}`}>
              <r.icon size={18} />
            </div>
            <div className="font-medium text-warm-900 text-sm">{r.label}</div>
            <div className="text-[11px] text-warm-500 mt-0.5 leading-snug">{r.desc}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      ) : !report ? null : (
        <>
          {type === 'revenue' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Invoiced" value={formatINR(t.invoiced)} />
                <Stat label="Collected" value={formatINR(t.collected)} />
                <Stat label="Outstanding" value={formatINR(t.outstanding)} />
                <Stat label="Collection rate" value={`${t.collectionRatePct}%`} />
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-4">Invoiced vs collected</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={report.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#A8A29E" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#A8A29E" width={70}
                           tickFormatter={(v) => `₹${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v}`} />
                    <Tooltip formatter={(v) => formatINR(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="invoiced" name="Invoiced" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill={CHART_COLOR_ALT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-1">Revenue by client</h3>
                <p className="text-xs text-warm-500 mb-4">
                  {t.topClientSharePct != null
                    ? `Top client is ${t.topClientSharePct}% of revenue in this period.`
                    : 'Top client data unavailable for this period.'}
                </p>
                {report.clients.length === 0 ? (
                  <p className="text-sm text-warm-400 py-4">No invoices in this range.</p>
                ) : (
                  <Table
                    columns={['Client', 'Invoices', 'Revenue', 'Share']}
                    rows={report.clients}
                    render={(c) => (
                      <>
                        <Td>{c.client}</Td>
                        <Td mono>{c.invoices}</Td>
                        <Td mono>{formatINR(c.revenue)}</Td>
                        <Td mono>{c.sharePct}%</Td>
                      </>
                    )}
                  />
                )}
              </div>
            </>
          )}

          {type === 'projects' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Projects" value={t.projects} />
                <Stat label="Completed" value={t.completed} />
                <Stat label="Completion rate" value={`${t.completionRatePct}%`} />
                <Stat label="At risk" value={t.atRisk} />
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-4">Projects started per month</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={report.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#A8A29E" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#A8A29E" allowDecimals={false} width={30} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" name="Projects" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-4">Projects</h3>
                {report.projects.length === 0 ? (
                  <p className="text-sm text-warm-400 py-4">No projects in this range.</p>
                ) : (
                  <Table
                    columns={['Project', 'Client', 'Service', 'Status', 'Complete', 'Late']}
                    rows={report.projects}
                    render={(p) => (
                      <>
                        <Td>{p.project}</Td>
                        <Td>{p.client}</Td>
                        <Td>{p.service}</Td>
                        <Td>{p.status}</Td>
                        <Td mono>{p.completionPct}%</Td>
                        <Td mono>{p.late > 0 ? <span className="text-danger-600">{p.late}</span> : '—'}</Td>
                      </>
                    )}
                  />
                )}
              </div>
            </>
          )}

          {type === 'users' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Signups" value={t.signups} />
                <Stat label="Accounts" value={t.accounts} />
                <Stat label="At risk" value={t.atRisk} />
                <Stat label="Churn rate" value={`${t.churnRatePct}%`} />
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-4">Signups per month</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={report.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#A8A29E" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#A8A29E" allowDecimals={false} width={30} />
                    <Tooltip />
                    <Bar dataKey="value" name="Signups" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-warm-200 p-6">
                  <h3 className="text-sm font-medium text-warm-700 mb-3">By role</h3>
                  {Object.entries(report.byRole).map(([role, n]) => (
                    <div key={role} className="flex justify-between py-1.5 border-b border-warm-100 last:border-0 text-sm">
                      <span className="text-warm-700">{role}</span>
                      <span className="font-mono text-warm-900">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-warm-200 p-6">
                  <h3 className="text-sm font-medium text-warm-700 mb-3">Account health</h3>
                  {Object.entries(report.byHealth).map(([state, n]) => (
                    <div key={state} className="flex justify-between py-1.5 border-b border-warm-100 last:border-0 text-sm">
                      <span className="text-warm-700">{state}</span>
                      <span className="font-mono text-warm-900">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {type === 'services' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Services sold" value={t.distinctServicesSold} />
                <Stat label="Catalogue size" value={t.catalogueSize} />
                <Stat label="Catalogue used" value={`${t.catalogueUtilisationPct}%`} />
                <Stat label="Units sold" value={t.unitsSold} />
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-4">Top services by units sold</h3>
                {report.series.length === 0 ? (
                  <p className="text-sm text-warm-400 py-4">No services sold in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={report.series} layout="vertical" margin={{ left: 90 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#A8A29E" allowDecimals={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} stroke="#A8A29E" width={90} />
                      <Tooltip />
                      <Bar dataKey="value" name="Units sold" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-warm-200 p-6">
                <h3 className="text-sm font-medium text-warm-700 mb-4">Service performance</h3>
                {report.services.length === 0 ? (
                  <p className="text-sm text-warm-400 py-4">No services sold in this range.</p>
                ) : (
                  <Table
                    columns={['Service', 'Category', 'Sold', 'Revenue']}
                    rows={report.services}
                    render={(s) => (
                      <>
                        <Td>{s.service}</Td>
                        <Td>{s.category}</Td>
                        <Td mono>{s.sold}</Td>
                        <Td mono>{formatINR(s.revenue)}</Td>
                      </>
                    )}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

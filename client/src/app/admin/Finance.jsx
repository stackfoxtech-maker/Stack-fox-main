import { useEffect, useState } from 'react';
import { IndianRupee, TrendingUp, Clock, AlertTriangle, Download } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, getStatusBadge } from '@lib/utils';
import { Spinner, Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const MetricCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-2xl border border-warm-200 p-5">
    <div className="flex items-center gap-3 mb-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}><Icon size={18} /></div>
      <span className="text-sm text-warm-500">{label}</span>
    </div>
    <p className="text-2xl font-bold font-mono text-warm-900">{value}</p>
  </div>
);

export default function Finance() {
  usePageTitle('Finance');
  const [invoices, setInvoices] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Downloads GSTR-1 for the most recent completed month as a CSV.
  const exportGstr1 = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-based
      const { data } = await api.get('/finance/gstr1', { params: { month: month, year } });
      const rows = Array.isArray(data) ? data : data?.data ? (Array.isArray(data.data) ? data.data : []) : [];
      const header = ['invoiceId', 'gstin', 'sacCode', 'subtotal', 'igst', 'cgst', 'sgst', 'grandTotal', 'paidAt'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gstr1-${year}-${String(month).padStart(2, '0')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export GSTR-1.');
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/invoices', { params: { limit: 20 } }),
      api.get('/finance/ar-aging').catch(() => ({ data: { data: null } })),
    ]).then(([invRes, arRes]) => {
      setInvoices(invRes.data.data || []);
      const invs = invRes.data.data || [];
      const totalOutstanding = invs.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.grandTotal || 0), 0);
      const overdue = invs.filter(i => i.status === 'overdue').length;
      setMetrics({
        totalInvoices: invs.length,
        outstanding: formatINR(totalOutstanding / 100),
        overdue,
        arAging: arRes.data.data,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-900">Finance</h1>
        <button onClick={exportGstr1}
          className="btn-outline text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
          <Download size={14} /> GSTR-1 Export
        </button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Invoices" value={metrics.totalInvoices} icon={IndianRupee} color="bg-fox-50 text-fox-600" />
          <MetricCard label="Outstanding" value={metrics.outstanding} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
          <MetricCard label="Overdue" value={metrics.overdue} icon={AlertTriangle} color="bg-danger-50 text-danger-600" />
          <MetricCard label="AR Aging Buckets" value={metrics.arAging ? Object.keys(metrics.arAging).length : '–'} icon={Clock} color="bg-amber-50 text-amber-600" />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-warm-100">
          <h2 className="font-semibold text-warm-900">Recent Invoices</h2>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8"><EmptyState icon={IndianRupee} title="No invoices" description="Invoices will appear here as projects progress." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-warm-500 text-left bg-warm-50">
                <th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Due</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-t border-warm-50 hover:bg-warm-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{inv.invoiceNumber || inv.id}</td>
                    <td className="px-5 py-3">{inv.orgId || '–'}</td>
                    <td className="px-5 py-3 font-mono">{formatINR(inv.total ?? 0)}</td>
                    <td className="px-5 py-3"><Badge variant={getStatusBadge(inv.status)?.replace('badge-', '')}>{inv.status}</Badge></td>
                    <td className="px-5 py-3 text-warm-500">{inv.dueDate ? formatDate(inv.dueDate) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

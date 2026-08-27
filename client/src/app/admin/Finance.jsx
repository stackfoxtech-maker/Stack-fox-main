import { useEffect, useState } from 'react';
import { IndianRupee, TrendingUp, Clock, AlertTriangle, Download, Mail, CheckCircle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button, Modal, Input } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const STATUS_TO_VARIANT = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'info',
  paid: 'success',
  'partially-paid': 'warning',
  overdue: 'danger',
};

function statusBadgeVariant(status) {
  return STATUS_TO_VARIANT[status] || 'neutral';
}

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
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [paidModal, setPaidModal] = useState({ open: false, invoice: null });
  const [utr, setUtr] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchInvoices = (pageNum = 1) => {
    setLoading(true);
    setError(null);
    api.get('/invoices', { params: { page: pageNum, limit } })
      .then((r) => {
        const data = r.data.data || [];
        setInvoices(data);
        const pagination = r.data.meta?.pagination;
        if (pagination) {
          setPage(pagination.page);
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.error || 'Failed to load invoices');
        setInvoices([]);
      })
      .finally(() => setLoading(false));
  };

  const fetchMetrics = () => {
    return api.get('/finance/ar-aging').catch(() => ({ data: { data: null } }));
  };

  useEffect(() => {
    Promise.all([
      fetchInvoices(1),
      fetchMetrics(),
    ]).then(([invRes, arRes]) => {
      const invs = invRes.data.data || [];
      const totalOutstanding = invs.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.grandTotal || 0), 0);
      const overdue = invs.filter(i => i.status === 'overdue').length;
      setMetrics({
        totalInvoices: invs.length,
        outstanding: formatINR(totalOutstanding / 100),
        overdue,
        arAging: arRes.data.data,
      });
    }).catch(() => {});
  }, []);

  const exportGstr1 = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
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

  const openPaidModal = (inv) => {
    setPaidModal({ open: true, invoice: inv });
    setUtr('');
    setPaidAt('');
  };

  const closePaidModal = () => {
    setPaidModal({ open: false, invoice: null });
    setUtr('');
    setPaidAt('');
  };

  const handleMarkPaid = async () => {
    if (!utr.trim()) {
      toast.error('UTR is required');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/invoices/${paidModal.invoice.id}/utr`, { utr: utr.trim(), paidAt: paidAt || undefined });
      toast.success('Invoice marked as paid');
      closePaidModal();
      fetchInvoices(page);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to mark as paid');
    } finally {
      setSaving(false);
    }
  };

  const sendReminder = (inv) => {
    const orgEmail = inv.org?.contactEmail || '';
    const subject = encodeURIComponent(`Payment Reminder: ${inv.invoiceNumber}`);
    const body = encodeURIComponent(`Dear ${inv.org?.name || 'Client'},\n\nThis is a gentle reminder that invoice ${inv.invoiceNumber} is currently ${inv.status}. Please arrange payment at your earliest convenience.\n\nThank you.`);
    window.open(`mailto:${orgEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  if (loading && invoices.length === 0) return <div className="flex justify-center py-20"><Spinner /></div>;

  const arAgingBuckets = [
    { label: 'Current', key: 'current', color: 'text-emerald-600 bg-emerald-50' },
    { label: '1-30 Days', key: 'd30', color: 'text-amber-600 bg-amber-50' },
    { label: '31-60 Days', key: 'd60', color: 'text-orange-600 bg-orange-50' },
    { label: '61-90 Days', key: 'd90', color: 'text-danger-600 bg-danger-50' },
    { label: '90+ Days', key: 'd90plus', color: 'text-danger-700 bg-danger-100' },
  ];

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

      {metrics?.arAging && (
        <div className="bg-white rounded-2xl border border-warm-200 p-5">
          <h3 className="text-sm font-bold text-warm-900 mb-4">AR Aging Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {arAgingBuckets.map((bucket) => {
              const amount = metrics.arAging[bucket.key] || 0;
              return (
                <div key={bucket.key} className={`rounded-xl p-3 border ${bucket.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">{bucket.label}</p>
                  <p className="text-lg font-black font-mono">{formatINR(amount / 100)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-warm-100">
          <h2 className="font-semibold text-warm-900">Recent Invoices</h2>
        </div>
        {error ? (
          <div className="p-8 flex items-start gap-3">
            <AlertTriangle className="text-danger-600 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-danger-800 text-sm">Failed to load invoices</p>
              <p className="text-sm text-danger-700 mt-1">{error}</p>
              <button onClick={() => fetchInvoices(1)} className="mt-3 text-xs font-bold text-danger-800 underline">Retry</button>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8"><EmptyState icon={IndianRupee} title="No invoices" description="Invoices will appear here as projects progress." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-warm-500 text-left bg-warm-50">
                <th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Due</th><th className="px-5 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-t border-warm-50 hover:bg-warm-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{inv.invoiceNumber || inv.id}</td>
                    <td className="px-5 py-3">{inv.org?.name || '–'}</td>
                    <td className="px-5 py-3 font-mono">{formatINR((inv.total ?? 0) / 100)}</td>
                    <td className="px-5 py-3"><Badge variant={statusBadgeVariant(inv.status)}>{inv.status}</Badge></td>
                    <td className="px-5 py-3 text-warm-500">{inv.dueDate ? formatDate(inv.dueDate) : '–'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => openPaidModal(inv)}>
                          <CheckCircle size={12} className="text-emerald-600" /> Mark Paid
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => sendReminder(inv)}>
                          <Mail size={12} /> Remind
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && invoices.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-warm-100">
            <p className="text-xs text-warm-500">Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, invoices.length)} of {invoices.length}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchInvoices(page - 1)}>Prev</Button>
              <span className="text-xs text-warm-500 self-center">{page}</span>
              <Button variant="outline" size="sm" disabled={invoices.length < limit} onClick={() => fetchInvoices(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={paidModal.open} onClose={closePaidModal} title="Mark Invoice as Paid" size="sm">
        <div className="space-y-4">
          <div className="bg-warm-50 rounded-xl p-3">
            <p className="text-xs text-warm-500">Invoice</p>
            <p className="font-mono font-bold text-sm">{paidModal.invoice?.invoiceNumber || paidModal.invoice?.id}</p>
            <p className="text-xs text-warm-500 mt-1">Client: {paidModal.invoice?.org?.name || '–'}</p>
          </div>
          <Input
            label="UTR Number"
            placeholder="Enter UTR / Transaction ID"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
          />
          <Input
            label="Paid At (optional)"
            type="datetime-local"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closePaidModal}>Cancel</Button>
            <Button variant="primary" onClick={handleMarkPaid} isLoading={saving}>Confirm Paid</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

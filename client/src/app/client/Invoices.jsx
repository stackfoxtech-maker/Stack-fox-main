import { useEffect, useState } from 'react';
import { Receipt, CreditCard } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, formatDate, capitalize, getStatusBadge, cn } from '@lib/utils';
import { Spinner, Badge, EmptyState, Button } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Invoices() {
  usePageTitle('Invoices');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handlePay = async (invoice) => {
    setPaying(invoice._id);
    try {
      const { data } = await api.post('/payments/create-order', { invoiceId: invoice._id });
      const order = data.data;

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'StackFox',
        description: `Payment for ${order.invoiceNumber}`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: order.paymentId,
            });
            toast.success('Payment successful!');
            const res = await api.get('/invoices');
            setInvoices(res.data.data || []);
          } catch {
            toast.error('Payment verification failed.');
          }
        },
        prefill: { email: invoice.clientDetails?.email || '' },
        theme: { color: '#FF4D00' },
      };

      if (window.Razorpay) {
        new window.Razorpay(options).open();
      } else {
        toast.error('Razorpay SDK not loaded. Add the script to index.html.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create payment order.');
    }
    setPaying(null);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-warm-900">Invoices</h2>

      {invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Invoices will appear here when your project milestones are billed." />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const balance = inv.total - (inv.paidAmount || 0);
            const canPay = ['sent', 'viewed', 'partially-paid', 'overdue'].includes(inv.status) && balance > 0;

            return (
              <div key={inv._id} className="bg-white rounded-2xl border border-warm-200 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-medium text-warm-900">{inv.invoiceNumber}</h3>
                    <p className="text-xs text-warm-500 mt-0.5">
                      {inv.clientDetails?.name || inv.org?.name || '—'} &middot; {formatDate(inv.createdAt)} &middot; Due {formatDate(inv.dueDate)}
                      {inv.project?.projectNumber && ` &middot; ${inv.project.projectNumber}`}
                    </p>
                  </div>
                  <Badge variant={getStatusBadge(inv.status)?.replace('badge-', '')}>{capitalize(inv.status)}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-warm-50 rounded-xl p-3 text-center mb-3">
                  <div>
                    <div className="text-xs text-warm-500">Total</div>
                    <div className="font-mono text-sm font-bold text-warm-900">{formatINR(inv.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-warm-500">Paid</div>
                    <div className="font-mono text-sm text-success-700">{formatINR(inv.paidAmount || 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-warm-500">Balance</div>
                    <div className={cn('font-mono text-sm font-semibold', balance > 0 ? 'text-danger-500' : 'text-success-700')}>
                      {formatINR(balance)}
                    </div>
                  </div>
                </div>

                {inv.gst && (
                  <div className="text-xs text-warm-400 mb-3">
                    GST: {inv.gst.isInterState ? `IGST ${formatINR(inv.gst.igst)}` : `CGST ${formatINR(inv.gst.cgst)} + SGST ${formatINR(inv.gst.sgst)}`}
                  </div>
                )}

                {canPay && (
                  <Button variant="primary" size="sm" isLoading={paying === inv._id} onClick={() => handlePay(inv)}>
                    <CreditCard size={16} /> Pay {formatINR(balance)}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

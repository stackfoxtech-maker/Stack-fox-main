import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Download, AlertCircle } from 'lucide-react';
import { apiGet } from '@lib/api';

export default function PaymentConfirmation() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('Missing order reference.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await apiGet(`/checkout/express/confirmation/${orderId}`);
        setOrder(res.data.confirmation);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not find that order.');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4 py-10">
        <p className="text-warm-500">Loading your confirmation…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full bg-white rounded-2xl border border-warm-200 p-8 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={36} />
          <h1 className="text-xl font-bold text-warm-900 mb-2">Order not found</h1>
          <p className="text-warm-500 text-sm mb-6">{error || 'Something went wrong loading this confirmation.'}</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-fox-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-fox-600 transition">
            Back to homepage <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl border border-warm-200 p-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
            <div className="relative w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600 animate-bounce" size={36} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-warm-900 mb-1">Payment Successful!</h1>
          <p className="text-warm-500 text-sm mb-6">
            {order.customerName ? `Thank you, ${order.customerName}` : 'Thank you for your order'}
          </p>

          <div className="bg-warm-50 rounded-xl p-5 text-left space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-warm-500">Order Number</span>
              <span className="font-semibold text-warm-900">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">Subtotal</span>
              <span className="font-medium text-warm-900">₹{order.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">GST (18%)</span>
              <span className="font-medium text-warm-900">₹{order.gst.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">Amount Paid</span>
              <span className="font-semibold text-fox-500">₹{order.total.toLocaleString('en-IN')}</span>
            </div>
            {order.paidAt && (
              <div className="flex justify-between">
                <span className="text-warm-500">Date</span>
                <span className="font-medium text-warm-900">
                  {new Date(order.paidAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {order.items?.length > 0 && (
            <div className="mt-4 bg-warm-50 rounded-xl p-4 text-left">
              <p className="text-xs font-semibold text-warm-500 uppercase mb-2">Items</p>
              <ul className="space-y-1">
                {order.items.map((item, i) => (
                  <li key={i} className="text-sm text-warm-700">• {item.name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Link to="/login" className="flex items-center justify-center gap-2 w-full bg-fox-500 text-white py-3 rounded-xl font-semibold hover:bg-fox-600 transition">
              Sign in to track your project <ArrowRight size={18} />
            </Link>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 w-full border border-warm-200 text-warm-700 py-3 rounded-xl font-medium hover:bg-warm-50 transition"
            >
              <Download size={18} /> Download Receipt
            </button>
          </div>
          <p className="text-xs text-warm-400 mt-4">
            We've sent a confirmation to your email. Use it to sign in and track your project's progress.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }
        .animate-ping { animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .animate-bounce { animation: bounce 1s ease-in-out 3; }
      `}</style>
    </div>
  );
}

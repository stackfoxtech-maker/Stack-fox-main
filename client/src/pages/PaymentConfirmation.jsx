import { CheckCircle, ArrowRight, Download } from 'lucide-react';

const order = {
  number: 'SF-2026-00847',
  amount: 82600,
  date: 'August 20, 2026',
  delivery: 'September 5, 2026',
  method: 'UPI',
  items: ['Website Development', 'SEO Optimization', 'Logo Design (x2)'],
};

export default function PaymentConfirmation() {
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
          <p className="text-warm-500 text-sm mb-6">Thank you for your order</p>

          <div className="bg-warm-50 rounded-xl p-5 text-left space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-warm-500">Order Number</span>
              <span className="font-semibold text-warm-900">{order.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">Amount Paid</span>
              <span className="font-semibold text-fox-500">₹{order.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">Payment Method</span>
              <span className="font-medium text-warm-900">{order.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">Date</span>
              <span className="font-medium text-warm-900">{order.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">Est. Delivery</span>
              <span className="font-medium text-warm-900">{order.delivery}</span>
            </div>
          </div>

          <div className="mt-4 bg-warm-50 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-warm-500 uppercase mb-2">Items</p>
            <ul className="space-y-1">
              {order.items.map((item, i) => (
                <li key={i} className="text-sm text-warm-700">• {item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 space-y-3">
            <a href="/dashboard" className="flex items-center justify-center gap-2 w-full bg-fox-500 text-white py-3 rounded-xl font-semibold hover:bg-fox-600 transition">
              Go to Dashboard <ArrowRight size={18} />
            </a>
            <button className="flex items-center justify-center gap-2 w-full border border-warm-200 text-warm-700 py-3 rounded-xl font-medium hover:bg-warm-50 transition">
              <Download size={18} /> Download Receipt
            </button>
          </div>
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

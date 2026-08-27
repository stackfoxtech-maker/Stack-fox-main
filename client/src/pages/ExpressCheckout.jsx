import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPost } from '@lib/api';
import data from '@data/stackfox-data.json';

const { services, packages, addons } = data;

export default function ExpressCheckout() {
  const [params] = useSearchParams();
  const serviceId = params.get('service');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  const service = services.find((s) => s.id === serviceId || (s.slug || s.id) === serviceId) || services[0];
  const basePrice = service?.price ?? 0;

  const toggleAddon = (id) => {
    setSelectedAddons((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const addonTotal = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((s, a) => s + (a.price ?? 0), 0);

  const total = basePrice + addonTotal;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/checkout/express', {
        name,
        phone,
        email,
        packageId: serviceId,
        addOns: selectedAddons,
      });
      setPaymentLink(res.data.razorpayOrderId ? `/payment-confirmation?order=${res.data.razorpayOrderId}` : '/payment-confirmation');
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Starter Tier · Express Checkout</p>
      <h1 className="text-3xl font-bold mb-2">Almost done!</h1>
      <p className="text-gray-600 mb-8">3 fields. No account needed. Your agreement is generated automatically.</p>

      <form onSubmit={submit} className="bg-white border rounded-2xl p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Your name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Phone (OTP verified)</label>
          <input
            required
            type="tel"
            pattern="[0-9]{10}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between mb-1">
            <span className="font-medium">{service?.name}</span>
            <span className="font-bold">₹{basePrice.toLocaleString('en-IN')}</span>
          </div>
          <div className="text-xs text-gray-500 mb-3">{service?.est}</div>

          <div className="text-sm font-semibold mb-2">Optional add-ons</div>
          <div className="space-y-2">
            {addons.slice(0, 6).map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAddons.includes(a.id)}
                  onChange={() => toggleAddon(a.id)}
                  className="w-4 h-4"
                />
                <span className="flex-1">{a.name}</span>
                <span className="text-gray-600">₹{(a.price ?? 0).toLocaleString('en-IN')}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-between mt-3 pt-3 border-t font-bold">
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">+ GST 18% at payment</div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Processing…' : 'Pay & Start Project'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <p className="text-xs text-gray-400 text-center">
        By paying, you accept the{' '}
        <Link to="/legal" className="text-orange-600 underline">StackFox Service Agreement</Link>. Click-accept with phone OTP.
      </p>
    </div>
  );
}
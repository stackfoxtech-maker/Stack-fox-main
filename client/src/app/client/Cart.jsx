import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Button, EmptyState } from '@components/ui/Primitives';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import api from '@lib/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function Cart() {
  usePageTitle('Cart');
  const { items, subtotal, gstAmount, total, itemCount, removeItem, updateQuantity, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleCheckout = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setCreating(true);
    try {
      const res = await api.post('/quotes');
      toast.success(`Quote ${res.data.data.quote.quoteNumber} created!`);
      clearCart(isAuthenticated);
      navigate('/app/client/quotes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create quote.');
    }
    setCreating(false);
  };

  if (itemCount === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-warm-900">Cart</h2>
        <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Add services from the Service Builder to get started." action={<Link to="/builder" className="btn-fox text-sm px-4 py-2">Browse Services</Link>} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Cart ({itemCount} items)</h2>
        <Button variant="ghost" size="sm" onClick={() => clearCart(isAuthenticated)} className="text-danger-500">
          <Trash2 size={14} /> Clear all
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Items */}
        <div className="flex-1 space-y-3">
          {items.map((item) => (
            <div key={item._id} className="bg-white rounded-xl border border-warm-200 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900">{item.name}</p>
                <p className="text-xs text-warm-500 mt-0.5 capitalize">{item.itemType}</p>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item._id, item.quantity - 1, isAuthenticated)} className="w-7 h-7 rounded-lg border border-warm-200 flex items-center justify-center hover:bg-warm-50 transition-colors">
                  <Minus size={12} />
                </button>
                <span className="w-8 text-center text-sm font-mono font-medium">{item.quantity}</span>
                <button onClick={() => updateQuantity(item._id, item.quantity + 1, isAuthenticated)} className="w-7 h-7 rounded-lg border border-warm-200 flex items-center justify-center hover:bg-warm-50 transition-colors">
                  <Plus size={12} />
                </button>
              </div>

              <div className="text-right min-w-[100px]">
                <p className="text-sm font-mono font-semibold text-warm-900">{formatINR(item.price * item.quantity)}</p>
                {item.quantity > 1 && <p className="text-[10px] text-warm-400">{formatINR(item.price)} each</p>}
              </div>

              <button onClick={() => removeItem(item._id, isAuthenticated)} className="p-1.5 hover:bg-danger-50 rounded-lg text-warm-400 hover:text-danger-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl border border-warm-200 p-5 sticky top-24">
            <h3 className="font-semibold text-warm-900 mb-4">Order summary</h3>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-warm-500">Subtotal</span><span className="font-mono text-warm-900">{formatINR(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-warm-500">GST (18%)</span><span className="font-mono text-warm-700">{formatINR(gstAmount)}</span></div>
              <div className="flex justify-between pt-3 border-t border-warm-200 text-base font-semibold">
                <span className="text-warm-900">Total</span>
                <span className="font-mono text-fox-500">{formatINR(total)}</span>
              </div>
            </div>

            <p className="text-[10px] text-warm-400 mb-4">All prices are indicative. Final quote may vary based on project complexity.</p>

            <Button variant="primary" size="lg" className="w-full" onClick={handleCheckout} isLoading={creating}>
              {isAuthenticated ? 'Get Quote' : 'Log in to Checkout'} <ArrowRight size={18} />
            </Button>

            <Link to="/builder" className="block text-center text-xs text-fox-500 hover:underline mt-3">
              Continue browsing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

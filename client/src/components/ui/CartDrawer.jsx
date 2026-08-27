import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, X, Trash2, Plus, Minus, ArrowRight, Package,
  FileText, AlertTriangle, TrendingUp, Download, MessageSquare
} from 'lucide-react';
import { CURRENCIES } from '@lib/constants';
import { applyTierMultiplier, computeEstimateRange, TIERS, TIER_LABELS } from '@lib/estimate';
import { exportQuotePDF } from '@lib/pdfExport';
import { Button, Spinner } from '@components/ui/Primitives';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import api from '@lib/api';
import toast from 'react-hot-toast';
import { useState, useMemo } from 'react';

export default function CartDrawer() {
  const {
    isOpen, setOpen, items, subtotal, gstAmount, total,
    itemCount, removeItem, updateQuantity, clearCart, isLoading,
    curIdx, warnings, roiItems
  } = useCartStore();

  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [tier, setTier] = useState('GROWTH');
  const overlayRef = useRef(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setOpen(false);
      navigate('/login');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/quotes', { items, tier });
      const payload = res.data.data;
      const quote = payload.quote || payload;
      toast.success(`Quote ${quote.quoteNumber} created!`);
      clearCart(isAuthenticated);
      setOpen(false);
      navigate(`/checkout/${quote._id || quote.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create quote.');
    }
    setCreating(false);
  };

  const handleWhatsAppCheckout = () => {
    const itemList = items.map(i => `- ${i.name} (${i.quantity}x)`).join('\n');
    const msg = `Hi StackFox! I'd like a quote for:\n\n${itemList}\n\nTotal: ${fmt(grandTotal)}\n\nPlease get in touch!`;
    window.open(`https://wa.me/918209395894?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const cur = CURRENCIES[curIdx];

  const fmt = (n) => {
    const val = n * cur.rate;
    return new Intl.NumberFormat(cur.locale, {
      style: 'currency', currency: cur.code, minimumFractionDigits: 0
    }).format(val);
  };

  const rawSub = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const sub = applyTierMultiplier(rawSub, tier);
  const tx = Math.round(sub * (cur.tax / 100));
  const grandTotal = sub + tx;
  const estimateRange = useMemo(() => computeEstimateRange(sub, tier), [sub, tier]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[70] bg-warm-900/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-[70] bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-fox-500" />
            <h2 className="text-base font-semibold text-warm-900">
              Cart {itemCount > 0 && <span className="text-warm-400 font-normal">({itemCount} items)</span>}
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-warm-100 transition-colors text-warm-400 hover:text-warm-800"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner size="lg" />
            </div>
          ) : itemCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-warm-100 flex items-center justify-center mb-4">
                <Package size={28} className="text-warm-400" />
              </div>
              <h3 className="text-base font-medium text-warm-800 mb-1">Your cart is empty</h3>
              <p className="text-sm text-warm-500 mb-5">
                Add services from the builder to get started.
              </p>
              <Link
                to="/builder"
                onClick={() => setOpen(false)}
                className="btn-fox text-sm px-5 py-2.5"
              >
                Browse Services
              </Link>
            </div>
          ) : (
            <div className="px-4 pt-4 pb-2 space-y-3">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-3 bg-warm-50 rounded-xl p-3 border border-warm-100"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-warm-900 leading-tight truncate">{item.name}</p>
                    <p className="text-xs text-warm-400 mt-0.5 capitalize">{item.itemType}</p>
                    <p className="text-sm font-mono font-semibold text-fox-600 mt-1">
                      {fmt(item.price * item.quantity)}
                      {item.quantity > 1 && (
                        <span className="text-[10px] text-warm-400 font-normal ml-1">({fmt(item.price)} × {item.quantity})</span>
                      )}
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity - 1, isAuthenticated)}
                      className="w-7 h-7 rounded-lg border border-warm-200 bg-white flex items-center justify-center hover:border-fox-300 hover:text-fox-600 transition-colors"
                      disabled={item.quantity <= 1}
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-6 text-center text-sm font-mono font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity + 1, isAuthenticated)}
                      className="w-7 h-7 rounded-lg border border-warm-200 bg-white flex items-center justify-center hover:border-fox-300 hover:text-fox-600 transition-colors"
                      disabled={item.quantity >= 99}
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item._id, isAuthenticated)}
                    className="p-1.5 rounded-lg hover:bg-danger-50 text-warm-300 hover:text-danger-500 transition-colors shrink-0"
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer summary + CTA */}
        {itemCount > 0 && (
          <div className="border-t border-warm-100 px-5 py-4 space-y-3 bg-white">
            {/* Tier selector — drives the Instant Estimate range + checkout steps */}
            <div>
              <div className="grid grid-cols-3 gap-1.5 bg-warm-50 rounded-xl p-1">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={`text-xs font-bold py-1.5 rounded-lg transition-colors ${tier === t ? 'bg-fox-500 text-white' : 'text-warm-500 hover:text-warm-800'}`}
                  >
                    {TIER_LABELS[t]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-warm-500 mt-1.5 font-mono">
                {estimateRange.format === 'flat'
                  ? `Fixed: ${fmt(estimateRange.mid)}`
                  : `Estimate: ${fmt(estimateRange.low)} – ${fmt(estimateRange.high)}`}
              </p>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-warm-500">
                <span>Subtotal</span>
                <span className="font-mono text-warm-800">{fmt(sub)}</span>
              </div>
              {cur.tax > 0 && (
                <div className="flex justify-between text-warm-500">
                  <span>{cur.taxName} ({cur.tax}%)</span>
                  <span className="font-mono text-warm-700">{fmt(tx)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-warm-100 text-base font-semibold">
                <span className="text-warm-900">Total</span>
                <span className="font-mono text-fox-500">{fmt(grandTotal)}</span>
              </div>
            </div>

            {/* Validation Warnings */}
            {warnings.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} /> Configuration Alerts
                </div>
                <div className="space-y-1">
                  {warnings.map((w, idx) => (
                    <div key={idx} className="text-[11px] text-amber-800 leading-tight">• {w.msg}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ROI Summary */}
            {roiItems.length > 0 && (
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <TrendingUp size={14} /> Value Projection
                </div>
                <div className="space-y-1">
                  {roiItems.map((r, idx) => (
                    <div key={idx} className="text-[11px] text-emerald-800 leading-tight">
                      <strong>{r.n}</strong>: {r.value} {r.metric}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-warm-400">
              Prices converted via {cur.code}. Final billing details in the official agreement.
            </p>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="md"
                className="font-bold gap-2"
                onClick={() => exportQuotePDF(items, curIdx, warnings, roiItems)}
              >
                <FileText size={16} /> Export PDF
              </Button>
              <Button
                variant="primary"
                size="md"
                className="font-bold gap-2"
                onClick={handleCheckout}
                isLoading={creating}
              >
                Next Step <ArrowRight size={16} />
              </Button>
            </div>

            <Button
              variant="outline"
              size="md"
              className="w-full font-bold gap-2 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
              onClick={handleWhatsAppCheckout}
            >
              <MessageSquare size={16} /> Send to WhatsApp
            </Button>


            <div className="flex items-center justify-between">
              <button
                onClick={() => clearCart(isAuthenticated)}
                className="text-xs text-warm-400 hover:text-danger-500 transition-colors flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear all
              </button>
              <Link
                to="/builder"
                onClick={() => setOpen(false)}
                className="text-xs text-fox-500 hover:underline"
              >
                Continue browsing →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

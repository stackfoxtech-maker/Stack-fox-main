import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { useMediaQuery } from '@lib/hooks';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Package,
  FileText,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { CURRENCIES } from '@lib/constants';
import { applyTierMultiplier, computeEstimateRange, TIERS, TIER_LABELS } from '@lib/estimate';
// jsPDF (~150 KB gz) is loaded on demand — see pdfExport / PERF_AUDIT P0-3.
const exportQuotePDF = (...args) => import('@lib/pdfExport').then((m) => m.exportQuotePDF(...args));
import { Spinner } from '@components/ui/Primitives';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import api from '@lib/api';
import toast from 'react-hot-toast';
import { useState, useMemo } from 'react';

export default function CartDrawer() {
  const {
    isOpen,
    setOpen,
    items,
    subtotal,
    gstAmount,
    total,
    itemCount,
    removeItem,
    updateQuantity,
    clearCart,
    isLoading,
    curIdx,
    warnings,
    roiItems,
  } = useCartStore();

  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [tier, setTier] = useState('GROWTH');
  const overlayRef = useRef(null);
  const [details, setDetails] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const dragControls = useDragControls();

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
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
    const itemList = items.map((i) => `- ${i.name} (${i.quantity}x)`).join('\n');
    const msg = `Hi StackFox! I'd like a quote for:\n\n${itemList}\n\nTotal: ${fmt(grandTotal)}\n\nPlease get in touch!`;
    window.open(`https://wa.me/918209395894?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const cur = CURRENCIES[curIdx];

  const fmt = (n) => {
    const val = n * cur.rate;
    return new Intl.NumberFormat(cur.locale, {
      style: 'currency',
      currency: cur.code,
      minimumFractionDigits: 0,
    }).format(val);
  };

  const rawSub = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const sub = applyTierMultiplier(rawSub, tier);
  const tx = Math.round(sub * (cur.tax / 100));
  const grandTotal = sub + tx;
  const estimateRange = useMemo(() => computeEstimateRange(sub, tier), [sub, tier]);

  const shut = () => setOpen(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            ref={overlayRef}
            className="fixed inset-0 z-[70] bg-warm-900/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={shut}
          />

          {/* Phones: a bottom sheet you can drag down to close. Wider screens: the side drawer. */}
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Cart"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[92dvh] flex-col rounded-t-[1.75rem] bg-white shadow-2xl md:inset-x-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-full md:max-w-md md:rounded-none"
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={{ x: 0, y: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag={isMobile ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) shut();
            }}
          >
            {/* Header (also the drag handle on phones) */}
            <div
              className="touch-none px-5 pb-3 pt-2.5 md:touch-auto md:py-4"
              onPointerDown={(e) => isMobile && dragControls.start(e)}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-warm-200 md:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-fox-50 text-fox-600">
                    <ShoppingCart size={18} />
                  </span>
                  <div>
                    <h2 className="text-[17px] font-semibold leading-tight text-warm-900">
                      Your cart
                    </h2>
                    {itemCount > 0 && (
                      <p className="text-xs text-warm-500">
                        {itemCount} item{itemCount > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={shut}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="grid h-10 w-10 place-items-center rounded-full bg-warm-50 text-warm-600 transition-colors active:bg-warm-100"
                  aria-label="Close cart"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : itemCount === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center md:h-full">
                  <div className="mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-fox-50">
                    <Package size={34} className="text-fox-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-warm-900">Your cart is empty</h3>
                  <p className="mb-6 mt-1 max-w-[16rem] text-sm text-warm-500">
                    Add services or a ready-made package and watch the total build up.
                  </p>
                  <div className="flex w-full max-w-xs flex-col gap-2.5">
                    <Link
                      to="/builder"
                      onClick={shut}
                      className="btn-fox min-h-12 w-full justify-center"
                    >
                      Browse services
                    </Link>
                    <Link
                      to="/packages"
                      onClick={shut}
                      className="btn-outline min-h-12 w-full justify-center"
                    >
                      See packages
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2.5 px-4 pb-3 pt-1">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item._id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
                        className="rounded-2xl border border-warm-100 bg-warm-50/70 p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-fox-500 shadow-sm">
                            <Package size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-warm-900">
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-xs capitalize text-warm-500">
                              {item.itemType}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item._id, isAuthenticated)}
                            className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-warm-400 transition-colors active:bg-danger-50 active:text-danger-500"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-full border border-warm-200 bg-white">
                            <button
                              onClick={() =>
                                updateQuantity(item._id, item.quantity - 1, isAuthenticated)
                              }
                              disabled={item.quantity <= 1}
                              className="grid h-10 w-10 place-items-center rounded-full text-warm-700 transition-colors active:bg-warm-100 disabled:opacity-30"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={15} />
                            </button>
                            <span className="w-7 text-center text-[15px] font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item._id, item.quantity + 1, isAuthenticated)
                              }
                              disabled={item.quantity >= 99}
                              className="grid h-10 w-10 place-items-center rounded-full text-warm-700 transition-colors active:bg-warm-100 disabled:opacity-30"
                              aria-label="Increase quantity"
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold tabular-nums text-warm-900">
                              {fmt(item.price * item.quantity)}
                            </p>
                            {item.quantity > 1 && (
                              <p className="text-[11px] text-warm-500">{fmt(item.price)} each</p>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer: tier, total, one big action. Detail lives behind a toggle. */}
            {itemCount > 0 && (
              <div
                className="border-t border-warm-100 bg-white px-4 pt-3 shadow-[0_-8px_24px_-16px_rgba(26,25,24,0.25)]"
                style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
              >
                {/* Tier selector: drives the estimate range and the checkout steps */}
                <div className="relative grid grid-cols-3 rounded-2xl bg-warm-100 p-1">
                  {TIERS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      className={`relative z-10 min-h-10 rounded-xl text-[13px] font-bold transition-colors ${
                        tier === t ? 'text-white' : 'text-warm-600'
                      }`}
                    >
                      {tier === t && (
                        <motion.span
                          layoutId="cart-tier"
                          className="absolute inset-0 -z-10 rounded-xl bg-fox-500 shadow-sm"
                          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        />
                      )}
                      {TIER_LABELS[t]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-center text-xs text-warm-500">
                  {estimateRange.format === 'flat'
                    ? `Fixed price: ${fmt(estimateRange.mid)}`
                    : `Estimated range: ${fmt(estimateRange.low)} to ${fmt(estimateRange.high)}`}
                </p>

                <button
                  type="button"
                  onClick={() => setDetails((d) => !d)}
                  aria-expanded={details}
                  className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-left"
                >
                  <span className="text-sm text-warm-500">
                    Total <span className="text-xs">(incl. {cur.taxName})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <motion.span
                      key={grandTotal}
                      initial={{ scale: 1.07 }}
                      animate={{ scale: 1 }}
                      className="text-[1.6rem] font-bold tabular-nums leading-none text-fox-600"
                    >
                      {fmt(grandTotal)}
                    </motion.span>
                    <ChevronDown
                      size={18}
                      className={`text-warm-400 transition-transform ${details ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {details && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 border-t border-warm-100 py-2.5 text-sm">
                        <div className="flex justify-between text-warm-500">
                          <span>Subtotal</span>
                          <span className="tabular-nums text-warm-800">{fmt(sub)}</span>
                        </div>
                        {cur.tax > 0 && (
                          <div className="flex justify-between text-warm-500">
                            <span>
                              {cur.taxName} ({cur.tax}%)
                            </span>
                            <span className="tabular-nums text-warm-800">{fmt(tx)}</span>
                          </div>
                        )}
                      </div>

                      {warnings.length > 0 && (
                        <div className="mb-2 rounded-xl border border-amber-100 bg-amber-50 p-3">
                          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                            <AlertTriangle size={14} /> Heads up
                          </div>
                          {warnings.map((w, idx) => (
                            <div key={idx} className="text-xs leading-snug text-amber-800">
                              • {w.msg}
                            </div>
                          ))}
                        </div>
                      )}

                      {roiItems.length > 0 && (
                        <div className="mb-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                            <TrendingUp size={14} /> Value projection
                          </div>
                          {roiItems.map((r, idx) => (
                            <div key={idx} className="text-xs leading-snug text-emerald-800">
                              <strong>{r.n}</strong>: {r.value} {r.metric}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pb-2">
                        <button
                          onClick={() => exportQuotePDF(items, curIdx, warnings, roiItems)}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-warm-200 text-sm font-semibold text-warm-700 active:bg-warm-50"
                        >
                          <FileText size={16} /> Export PDF
                        </button>
                        <button
                          onClick={handleWhatsAppCheckout}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 text-sm font-semibold text-emerald-700 active:bg-emerald-50"
                        >
                          <MessageSquare size={16} /> WhatsApp
                        </button>
                      </div>
                      <div className="flex items-center justify-between pb-2">
                        <button
                          onClick={() => clearCart(isAuthenticated)}
                          className="flex min-h-10 items-center gap-1 text-xs text-warm-500 active:text-danger-500"
                        >
                          <Trash2 size={13} /> Clear all
                        </button>
                        <Link
                          to="/builder"
                          onClick={shut}
                          className="flex min-h-10 items-center text-xs font-medium text-fox-600"
                        >
                          Continue browsing
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  onClick={handleCheckout}
                  disabled={creating}
                  whileTap={{ scale: 0.98 }}
                  className="mt-1 flex min-h-[3.4rem] w-full items-center justify-center gap-2 rounded-2xl bg-fox-500 text-base font-bold text-white shadow-[0_8px_20px_-8px_rgba(255,77,0,0.55)] transition-colors active:bg-fox-600 disabled:opacity-70"
                >
                  {creating ? (
                    'Creating your quote…'
                  ) : (
                    <>
                      Continue to checkout <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

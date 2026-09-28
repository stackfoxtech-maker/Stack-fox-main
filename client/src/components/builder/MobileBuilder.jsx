import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Clock, Plus, ShoppingCart, Sparkles, X } from 'lucide-react';
import { cn } from '@lib/utils';
import BottomSheet from './BottomSheet';

// Tiny tactile tick on Android; a no-op elsewhere (iOS Safari has no vibrate).
export const haptic = () => navigator.vibrate?.(8);

/* One service as a full-width row: name, one-line blurb, price · timing, and a
   44px add/remove control. Tapping the row opens the details sheet. */
export const ServiceRow = memo(function ServiceRow({
  svc,
  price,
  inCart,
  onToggle,
  onOpen,
  highlighted,
}) {
  return (
    <div
      id={`service-${svc.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(svc)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(svc)}
      className={cn(
        'flex min-h-[76px] items-center gap-3 rounded-2xl border bg-white py-2.5 pl-4 pr-2.5 transition-colors active:bg-warm-50',
        inCart ? 'border-sage-300 bg-sage-50/50' : 'border-warm-200',
        highlighted && 'ring-2 ring-fox-500/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-warm-900">
          {svc.name}
        </p>
        {svc.lay && <p className="mt-0.5 line-clamp-1 text-[13px] text-warm-500">{svc.lay}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-warm-600">
          <span className="price-tag text-warm-900">{price}</span>
          <span aria-hidden className="text-warm-300">
            ·
          </span>
          <span className="truncate">{svc.estimatedTime || svc.est || '3-5 days'}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          haptic();
          onToggle(svc);
        }}
        aria-label={inCart ? `Remove ${svc.name}` : `Add ${svc.name}`}
        aria-pressed={inCart}
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-all active:scale-90',
          inCart ? 'bg-sage-500 text-white' : 'bg-fox-50 text-fox-600',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={inCart ? 'in' : 'out'}
            initial={{ scale: 0.4, rotate: -45, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="grid place-items-center"
          >
            {inCart ? <Check size={20} strokeWidth={2.6} /> : <Plus size={20} strokeWidth={2.4} />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
});

/* Full details for one service, with the add/remove action as the sheet's
   primary button so the decision happens in one place. */
export function ServiceSheet({ svc, catName, price, inCart, nameOf, onToggle, onClose }) {
  return (
    <BottomSheet open={!!svc} onClose={onClose} label={svc?.name || 'Service details'}>
      {svc && (
        <div className="px-5 pb-2 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {catName && (
                <p className="text-xs font-medium uppercase tracking-wide text-fox-600">
                  {catName}
                </p>
              )}
              <h2 className="mt-1 text-xl font-semibold leading-snug text-warm-900">{svc.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-warm-500 active:bg-warm-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-50 px-3 py-1.5 text-sm font-medium text-warm-700">
              <Clock size={14} /> {svc.estimatedTime || svc.est || '3-5 days'}
            </span>
            <span className="inline-flex items-center rounded-full bg-warm-50 px-3 py-1.5 text-sm font-medium capitalize text-warm-700">
              Per {svc.unit || 'project'}
            </span>
          </div>

          <p className="mt-4 text-body-md leading-relaxed text-warm-600">
            {svc.lay || 'A single, individually priced piece of your build.'}
          </p>

          {(svc.requires?.length > 0 || svc.conflicts?.length > 0) && (
            <div className="mt-4 space-y-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
              {svc.requires?.length > 0 && (
                <p>Works best with: {svc.requires.map(nameOf).join(', ')}</p>
              )}
              {svc.conflicts?.length > 0 && <p>Not with: {svc.conflicts.map(nameOf).join(', ')}</p>}
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-warm-500">Starting</p>
              <p className="price-tag text-2xl text-warm-900">{price}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic();
                onToggle(svc);
              }}
              className={cn(
                'flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition-all active:scale-[0.98]',
                inCart ? 'bg-warm-100 text-warm-800' : 'bg-fox-500 text-white shadow-md',
              )}
            >
              {inCart ? (
                <>
                  <Check size={18} /> In project · Remove
                </>
              ) : (
                <>
                  <Plus size={18} /> Add to project
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

/* Sticky "review" bar above the phone tab bar: count + running subtotal. */
export function CartBar({ count, total, onOpen }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          type="button"
          onClick={onOpen}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          className="fixed inset-x-3 z-30 flex items-center gap-3 rounded-2xl bg-warm-900 py-2.5 pl-3 pr-4 text-left text-white shadow-modal active:scale-[0.99] md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <ShoppingCart size={20} />
            <motion.span
              key={count}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-fox-500 px-1 text-[11px] font-bold"
            >
              {count}
            </motion.span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-warm-300">Your project · subtotal</span>
            <motion.span
              key={total}
              initial={{ y: 6, opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              className="price-tag block text-lg leading-tight"
            >
              {total}
            </motion.span>
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-fox-300">
            Review <ArrowRight size={16} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* Horizontal "often added together" pills — sits right under the toolbar once
   the cart has something in it, instead of 8000px down the page. */
export function SuggestionStrip({ suggestions, fmt, onAdd }) {
  if (!suggestions.length) return null;
  return (
    <div className="mb-4 md:hidden">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-warm-700">
        <Sparkles size={14} className="text-fox-500" /> Often added together
      </p>
      <div className="hide-scrollbar -mx-6 flex snap-x scroll-px-6 gap-2 overflow-x-auto px-6">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              haptic();
              onAdd(s);
            }}
            className="flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border border-warm-200 bg-white py-2 pl-4 pr-3 text-left active:bg-fox-50"
          >
            <span className="max-w-[10rem] truncate text-[13px] font-medium text-warm-800">
              {s.name}
            </span>
            <span className="price-tag text-[13px] text-warm-500">{fmt(s.price)}</span>
            <Plus size={16} className="text-fox-500" />
          </button>
        ))}
      </div>
    </div>
  );
}

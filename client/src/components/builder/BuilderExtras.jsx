import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Boxes,
  Brain,
  Check,
  Cloud,
  Code2,
  Globe,
  MessageCircle,
  Palette,
  Server,
  Share2,
  Shield,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useCountUp } from '@lib/hooks';
import { cn } from '@lib/utils';

const EASE = [0.2, 0.7, 0.2, 1];

/** Icon for a catalogue category (the JSON stores lucide-style names). */
const ICONS = {
  globe: Globe,
  smartphone: Smartphone,
  brain: Brain,
  zap: Zap,
  'shopping-cart': ShoppingCart,
  palette: Palette,
  server: Server,
  cloud: Cloud,
  shield: Shield,
  'trending-up': TrendingUp,
  'message-circle': MessageCircle,
  box: Boxes,
  wrench: Wrench,
  code: Code2,
};
export const categoryIcon = (name) => ICONS[name] || Sparkles;

/** "What are you building?" — one tap narrows the catalogue to that part of it. */
export const QUICK_STARTS = [
  { cat: 'web-dev', label: 'Website', blurb: 'Pages, blog, CMS', icon: Globe },
  { cat: 'ecommerce', label: 'Online store', blurb: 'Catalogue, checkout', icon: ShoppingCart },
  { cat: 'mobile-dev', label: 'Mobile app', blurb: 'iOS and Android', icon: Smartphone },
  { cat: 'ai-genai', label: 'AI & chatbots', blurb: 'Assistants, automation', icon: Brain },
  { cat: 'ui-ux', label: 'Design & brand', blurb: 'Logo, UI, identity', icon: Palette },
  { cat: 'seo-marketing', label: 'Growth & SEO', blurb: 'Traffic and ads', icon: TrendingUp },
];

export function QuickStart({ active, onPick }) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-warm-500">
        What are you building?
      </p>
      <div className="no-scrollbar -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-6 md:overflow-visible">
        {QUICK_STARTS.map(({ cat, label, blurb, icon: Icon }, i) => {
          const on = active === cat;
          return (
            <motion.button
              key={cat}
              type="button"
              onClick={() => onPick(on ? 'all' : cat)}
              aria-pressed={on}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.35, ease: EASE }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                'group relative flex min-w-[8.5rem] shrink-0 snap-start flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-colors md:min-w-0',
                on
                  ? 'border-fox-500 bg-fox-500 text-white shadow-lg shadow-fox-500/25'
                  : 'border-warm-200 bg-white/90 hover:border-fox-300',
              )}
            >
              <span
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-xl transition-transform group-hover:-rotate-6 group-hover:scale-110',
                  on ? 'bg-white/20 text-white' : 'bg-fox-50 text-fox-600',
                )}
              >
                <Icon size={18} />
              </span>
              <span>
                <span className="block text-[14px] font-semibold leading-tight">{label}</span>
                <span
                  className={cn('mt-0.5 block text-xs', on ? 'text-white/80' : 'text-warm-500')}
                >
                  {blurb}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export const SORTS = [
  { id: 'popular', label: 'Popular' },
  { id: 'low', label: 'Price ↑', full: 'Price: low to high' },
  { id: 'high', label: 'Price ↓', full: 'Price: high to low' },
  { id: 'fast', label: 'Fastest' },
];

/** Sort and quick filters, one calm row above the results. */
export function SortBar({ sort, onSort, cheap, onCheap, count }) {
  return (
    <div className="no-scrollbar -mx-6 mb-5 flex items-center gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      <span className="mr-1 shrink-0 whitespace-nowrap text-body-sm text-warm-500">
        <span className="font-semibold text-warm-800">{count}</span> pieces
      </span>
      <div className="relative flex shrink-0 gap-1 rounded-full bg-warm-100 p-1">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSort(s.id)}
            aria-label={s.full || s.label}
            className={cn(
              'relative min-h-9 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors',
              sort === s.id ? 'text-warm-900' : 'text-warm-500 hover:text-warm-800',
            )}
          >
            {sort === s.id && (
              <motion.span
                layoutId="sort-pill"
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              />
            )}
            <span className="relative">{s.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onCheap(!cheap)}
        aria-pressed={cheap}
        className={cn(
          'min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
          cheap
            ? 'border-sage-500 bg-sage-500 text-white'
            : 'border-warm-200 bg-white text-warm-600 hover:border-sage-300',
        )}
      >
        Under ₹10,000
      </button>
    </div>
  );
}

/** Small ring showing how many of the catalogue's areas the plan touches. */
function CoverageRing({ covered, total }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-warm-100" />
      <motion.circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        className="stroke-fox-500"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, covered / Math.max(total, 1))) }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </svg>
  );
}

/**
 * The live plan: what you have picked, what it adds up to, and one button to move on.
 * It grows as you add, so the effect of every tap is visible without opening the cart.
 */
export function PlanPanel({
  items,
  catalog,
  fmt,
  subtotal,
  onRemove,
  onCheckout,
  onShare,
  onClear,
  onBrowse,
}) {
  const [all, setAll] = useState(false);
  const gst = Math.round(subtotal * 0.18);
  const { value: shownTotal } = useCountUp(subtotal + gst, { duration: 600 });

  const covered = useMemo(() => {
    const ids = new Set(
      items.map((i) => catalog.services.find((s) => s.id === i.itemId)?.catId).filter(Boolean),
    );
    return [...ids];
  }, [items, catalog.services]);

  const shown = all ? items : items.slice(0, 5);

  if (items.length === 0)
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-warm-300 bg-white/60 p-6 text-center">
        <motion.span
          className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-fox-50 text-fox-500"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShoppingCart size={22} />
        </motion.span>
        <h3 className="text-title text-warm-900">Your plan starts here</h3>
        <p className="mx-auto mt-1 max-w-[15rem] text-body-sm text-warm-600">
          Add a piece and this fills in with a live total, GST included.
        </p>
        {onBrowse && (
          <button
            type="button"
            onClick={onBrowse}
            className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-fox-600"
          >
            Pick a starting point <ArrowRight size={14} />
          </button>
        )}
      </div>
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-warm-200 bg-white p-5 shadow-lg shadow-warm-900/5"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <CoverageRing covered={covered.length} total={catalog.categories.length} />
          <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-warm-900">
            {covered.length}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-title leading-tight text-warm-900">Your plan</h3>
          <p className="text-xs text-warm-500">
            {items.length} piece{items.length > 1 ? 's' : ''} across {covered.length} of{' '}
            {catalog.categories.length} areas
          </p>
        </div>
        <button
          type="button"
          onClick={onShare}
          aria-label="Copy a shareable link"
          className="grid h-9 w-9 place-items-center rounded-full text-warm-500 transition-colors hover:bg-warm-100 hover:text-warm-800"
        >
          <Share2 size={16} />
        </button>
      </div>

      <ul className="mt-4 space-y-1.5">
        <AnimatePresence initial={false}>
          {shown.map((it) => (
            <motion.li
              key={it._id || it.itemId}
              layout
              initial={{ opacity: 0, x: 16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: -16, height: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="group flex items-center gap-2 overflow-hidden rounded-xl bg-warm-50 px-3 py-2"
            >
              <Check size={14} className="shrink-0 text-sage-600" />
              <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-warm-800">
                {it.name}
                {it.quantity > 1 && <span className="text-warm-500"> × {it.quantity}</span>}
              </span>
              <span className="price-tag text-body-sm text-warm-700">
                {fmt(it.price * it.quantity)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(it)}
                aria-label={`Remove ${it.name}`}
                className="grid h-6 w-6 place-items-center rounded-full text-warm-400 opacity-60 transition hover:bg-danger-50 hover:text-danger-500 group-hover:opacity-100"
              >
                <X size={13} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 text-xs font-semibold text-fox-600"
        >
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}

      <div className="mt-4 space-y-1 border-t border-warm-100 pt-3 text-body-sm text-warm-600">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="price-tag">{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST 18%</span>
          <span className="price-tag">{fmt(gst)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t-2 border-warm-900 pt-3">
        <span className="text-title text-warm-900">Total</span>
        <motion.span
          key={subtotal}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          className="inline-block origin-right font-display text-2xl font-bold tabular-nums tracking-tight text-fox-600"
        >
          {fmt(shownTotal)}
        </motion.span>
      </div>

      <button type="button" onClick={onCheckout} className="btn-fox group mt-4 w-full">
        Review &amp; checkout{' '}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </button>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-warm-500 transition-colors hover:text-danger-500"
      >
        <Trash2 size={12} /> Clear plan
      </button>
    </motion.div>
  );
}

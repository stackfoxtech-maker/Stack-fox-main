import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  Brain,
  Check,
  Cloud,
  Globe,
  Palette,
  ShoppingCart,
  TrendingUp,
  X,
} from 'lucide-react';
import { Reveal } from '@components/Reveal';

// `bar` = the piece's colour on the timeline, the row's accent bar and the receipt dot.
const PIECES = [
  {
    id: 'web',
    label: 'Custom website, 5 pages',
    price: 35000,
    weeks: 2,
    Icon: Globe,
    bar: 'bg-fox-500',
  },
  {
    id: 'brand',
    label: 'Logo + brand kit',
    price: 18000,
    weeks: 1,
    Icon: Palette,
    bar: 'bg-sage-500',
  },
  {
    id: 'checkout',
    label: 'Razorpay checkout',
    price: 12000,
    weeks: 0.5,
    Icon: ShoppingCart,
    bar: 'bg-warm-300',
  },
  { id: 'chatbot', label: 'AI chatbot', price: 35000, weeks: 2, Icon: Brain, bar: 'bg-fox-300' },
  {
    id: 'seo',
    label: 'SEO starter pack',
    price: 15000,
    weeks: 1,
    Icon: TrendingUp,
    bar: 'bg-sage-300',
  },
  {
    id: 'hosting',
    label: 'Cloud hosting, 1 year',
    price: 8000,
    weeks: 0,
    Icon: Cloud,
    bar: 'bg-warm-200',
  },
];

const PRESETS = [
  { id: 'starter', label: 'Starter site', ids: ['web', 'seo', 'hosting'] },
  { id: 'store', label: 'Online store', ids: ['web', 'brand', 'checkout', 'seo', 'hosting'] },
  { id: 'ai', label: 'App + AI', ids: ['web', 'chatbot', 'checkout', 'hosting'] },
];

const TIERS = [
  { id: 'starter', label: 'Starter', mult: 1 },
  { id: 'growth', label: 'Growth', mult: 1.4 },
  { id: 'premium', label: 'Premium', mult: 1.9 },
];

const GST = 0.18;
const BUNDLE_MIN = 3; // pieces needed before the bundle line appears
const BUNDLE_OFF = 0.08;
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupees = (n) => `₹${inr.format(Math.round(n))}`;
const weeksLabel = (w) => `${w} ${w === 1 ? 'week' : 'weeks'}`;
const spring = { type: 'spring', stiffness: 500, damping: 30 };
const pillSpring = { type: 'spring', stiffness: 420, damping: 32 };

// Jagged bottom edge so the receipt reads as torn paper. Mask, not clip-path, so layout is untouched.
const TORN_MASK =
  'linear-gradient(#000 0 0) top / 100% calc(100% - 9px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 18px 9px repeat-x';

const EASE = [0.2, 0.7, 0.2, 1];
const MAX_FLYERS = 3;
const DIGITS = '0123456789'.split('');

// One reel of 0-9; translating it by -d * 1.1em lands digit d in the window.
function Digit({ d, delay, reduce }) {
  return (
    <span className="relative block h-[1.1em] overflow-hidden text-center">
      <motion.span
        className="flex flex-col"
        initial={false}
        animate={{ y: `${-d * 10}%` }}
        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE, delay }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="block h-[1.1em] text-center">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Per-digit rolling number. Symbols stay put; digits are keyed from the right so they roll in place. */
function Odometer({ text, className = '', sr = false }) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  const last = chars.length - 1;
  return (
    <>
      {sr && <span className="sr-only">{text}</span>}
      <span className={`inline-flex leading-[1.1] ${className}`} aria-hidden>
        {chars.map((c, i) => {
          const r = last - i;
          return /\d/.test(c) ? (
            <Digit key={`d${r}`} d={Number(c)} delay={r * 0.03} reduce={reduce} />
          ) : (
            <span key={`s${r}`} className="block h-[1.1em]">
              {c}
            </span>
          );
        })}
      </span>
    </>
  );
}

/** Sliding pill shared by the chip row and the tier control (one layoutId per group). */
function Pill({ id, reduce, className = 'bg-warm-900' }) {
  return (
    <motion.span
      layoutId={id}
      className={`absolute inset-0 rounded-pill ${className}`}
      transition={reduce ? { duration: 0 } : pillSpring}
      aria-hidden
    />
  );
}

export function TryEstimator() {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState(() => new Set(['web', 'brand', 'checkout']));
  const [tierId, setTierId] = useState('starter');
  // Shared hover id: a list row, its receipt line and its timeline segment light up together.
  const [hoveredId, setHoveredId] = useState(null);
  const [flyers, setFlyers] = useState([]); // chips in flight from a ticked row to the receipt
  const [lastAdded, setLastAdded] = useState([]); // rows that just landed on the receipt (flash)
  const [pulse, setPulse] = useState(0); // bumps the phone bar when the list changes
  const [focusIdx, setFocusIdx] = useState(0); // roving tabindex: one Tab stop for the whole list
  const listRef = useRef(null);
  const receiptRef = useRef(null);
  const timers = useRef([]);
  const flyKey = useRef(0);
  const listInView = useInView(listRef, { margin: '-30% 0px -30% 0px' });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // Desktop only: the receipt sits beside the list. Transform-only, capped, removed on finish.
  const flyChip = (piece) => {
    if (reduce || !window.matchMedia('(min-width: 1024px)').matches) return;
    const from = listRef.current
      ?.querySelector(`[data-check="${piece.id}"]`)
      ?.getBoundingClientRect();
    const to = receiptRef.current?.getBoundingClientRect();
    if (!from || !to) return;
    setFlyers((f) => {
      if (f.length >= MAX_FLYERS) return f;
      flyKey.current += 1;
      return [
        ...f,
        {
          key: flyKey.current,
          Icon: piece.Icon,
          price: rupees(priceOf(piece)),
          x0: from.left + from.width / 2,
          y0: from.top + from.height / 2,
          x1: to.left + 48,
          y1: Math.min(Math.max(to.top + 96, 24), window.innerHeight - 48),
        },
      ];
    });
  };

  const toggle = (id) => {
    if (!picked.has(id)) {
      flyChip(PIECES.find((p) => p.id === id));
      setLastAdded([id]);
    }
    setPulse((n) => n + 1);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Receipt-side removal (button or swipe): the row unmounts under the cursor, so clear the shared hover.
  const removeFromReceipt = (id) => {
    setHoveredId(null);
    toggle(id);
  };

  // Cursor spotlight on the receipt: CSS vars only, so no React state per pointer move.
  const onReceiptMove = (e) => {
    if (reduce || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // Drops what is unwanted at once, then ticks the rest in one by one, 70ms apart.
  const applyPreset = (ids) => {
    clearTimers();
    const want = new Set(ids);
    setPulse((n) => n + 1);
    if (reduce) {
      setLastAdded([]);
      setPicked(want);
      return;
    }
    const added = PIECES.map((p) => p.id).filter((i) => want.has(i) && !picked.has(i));
    setLastAdded(added);
    setPicked((prev) => new Set([...prev].filter((i) => want.has(i))));
    added.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => setPicked((prev) => new Set(prev).add(id)), 70 * (i + 1)),
      );
    });
  };

  // Arrows / Home / End move between rows; Space already toggles the native checkbox.
  const onRowKey = (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1, Home: -99, End: 99 }[e.key];
    if (!step) return;
    const boxes = [...listRef.current.querySelectorAll('input[type="checkbox"]')];
    const at = boxes.indexOf(e.currentTarget);
    e.preventDefault();
    boxes[Math.min(Math.max(at + step, 0), boxes.length - 1)]?.focus();
  };

  const tier = TIERS.find((t) => t.id === tierId);
  const priceOf = (p) => p.price * tier.mult;
  const selected = PIECES.filter((p) => picked.has(p.id));
  const empty = selected.length === 0;
  const listTotal = selected.reduce((s, p) => s + priceOf(p), 0);
  const bundled = selected.length >= BUNDLE_MIN;
  // Whole rupees at each step so the lines on the receipt always add up exactly.
  const saving = bundled ? Math.round(listTotal * BUNDLE_OFF) : 0;
  const subtotal = Math.round(listTotal) - saving;
  const gst = Math.round(subtotal * GST);
  const total = subtotal + gst;
  const rawWeeks = selected.reduce((s, p) => s + p.weeks, 0);
  const weeks = Math.max(1, Math.ceil(rawWeeks));
  const activePreset = PRESETS.find(
    (pr) => pr.ids.length === picked.size && pr.ids.every((i) => picked.has(i)),
  )?.id;

  const rowMotion = reduce
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, height: 0, x: 12 },
        animate: { opacity: 1, height: 'auto', x: 0 },
        exit: { opacity: 0, height: 0, x: -12 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      };

  const jumpToReceipt = () =>
    receiptRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
      <div className="lg:col-span-7">
        {/* Controls: presets on the left, tier on the right; they wrap on narrow screens. */}
        <div className="flex flex-col gap-3">
          <LayoutGroup id="est-presets">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Start from a preset"
            >
              {PRESETS.map((pr) => {
                const active = activePreset === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(pr.ids)}
                    data-preset={pr.id}
                    className={`relative inline-flex min-h-11 items-center rounded-pill border px-4 text-body-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.97] ${
                      active
                        ? 'border-transparent text-white'
                        : 'border-warm-900/25 text-warm-900 hover:border-warm-900/50 hover:bg-warm-50'
                    }`}
                  >
                    {active && <Pill id="est-preset-pill" reduce={reduce} />}
                    <span className="relative">{pr.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => applyPreset([])}
                disabled={empty}
                data-preset="clear"
                className="inline-flex min-h-11 items-center rounded-pill px-3 text-body-sm font-medium text-warm-800 underline decoration-warm-300 underline-offset-4 transition-colors duration-200 hover:text-fox-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 disabled:pointer-events-none disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </LayoutGroup>

          <LayoutGroup id="est-tiers">
            <div
              role="radiogroup"
              aria-label="Build tier"
              className="inline-flex shrink-0 self-start rounded-pill bg-warm-100 p-1"
            >
              {TIERS.map((t) => {
                const active = t.id === tierId;
                return (
                  <label
                    key={t.id}
                    className={`relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-body-sm font-medium transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fox-500 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-warm-100 ${
                      active ? 'text-white' : 'text-warm-900 hover:text-fox-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="estimator-tier"
                      className="sr-only"
                      checked={active}
                      onChange={() => setTierId(t.id)}
                    />
                    {active && <Pill id="est-tier-pill" reduce={reduce} />}
                    <span className="relative">{t.label}</span>
                    <span
                      className={`relative text-caption tabular-nums ${active ? 'text-warm-200' : ''}`}
                    >
                      ×{t.mult}
                    </span>
                  </label>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        <div ref={listRef} className="mt-5">
          <Reveal stagger as="ul" className="space-y-2" aria-label="Pieces to include">
            {PIECES.map((p, idx) => {
              const { id, label, Icon } = p;
              const on = picked.has(id);
              const hot = hoveredId === id;
              return (
                <Reveal.Item as="li" key={id}>
                  <label
                    data-piece={id}
                    onMouseEnter={() => setHoveredId(id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`group relative flex min-h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-md py-3.5 pl-5 pr-4 transition-[background-color,box-shadow,transform] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fox-500 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white active:scale-[0.985] sm:gap-4 md:pr-5 ${
                      on
                        ? `bg-white shadow-md ring-1 ${hot ? 'ring-fox-500/50' : 'ring-warm-900/10'}`
                        : 'border border-warm-200/70 hover:-translate-y-px hover:bg-white/60'
                    }`}
                  >
                    {/* Accent bar in the piece's timeline colour; only when ticked. */}
                    <span
                      className={`absolute inset-y-0 left-0 w-1.5 origin-top transition-transform duration-300 ${p.bar} ${
                        on ? 'scale-y-100' : 'scale-y-0'
                      }`}
                      aria-hidden
                    />
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggle(id)}
                      onKeyDown={onRowKey}
                      tabIndex={focusIdx === idx ? 0 : -1}
                      onFocus={() => {
                        setFocusIdx(idx);
                        setHoveredId(id);
                      }}
                      onBlur={() => setHoveredId((h) => (h === id ? null : h))}
                    />
                    <span
                      data-check={id}
                      className={`grid size-5 shrink-0 place-items-center rounded-sm border transition-colors duration-200 ${
                        on ? 'border-sage-600 bg-sage-600' : 'border-warm-300 bg-white'
                      }`}
                      aria-hidden
                    >
                      <AnimatePresence initial={false}>
                        {on && (
                          <motion.span
                            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                            transition={reduce ? { duration: 0 } : spring}
                          >
                            <Check className="size-3.5 text-white" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <Icon className="size-5 shrink-0 text-fox-500" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body leading-snug text-warm-900">{label}</span>
                      <span className="mt-0.5 block text-caption text-warm-700">
                        {p.weeks === 0 ? 'Runs alongside the build' : weeksLabel(p.weeks)}
                      </span>
                    </span>
                    <span
                      className={`text-body tabular-nums transition-colors duration-200 ${
                        hot ? 'text-fox-600' : 'text-warm-900'
                      }`}
                      data-price={id}
                    >
                      <Odometer text={rupees(priceOf(p))} sr />
                    </span>
                  </label>
                </Reveal.Item>
              );
            })}
          </Reveal>
        </div>

        {/* Shows the rules behind the maths so nothing about the total is hidden. */}
        <dl className="mt-5 grid gap-px overflow-hidden rounded-md bg-warm-200/70 text-body-sm sm:grid-cols-3">
          {[
            ['Tier', `Starter ×1, Growth ×1.4, Premium ×1.9 on every piece`],
            ['Bundle', `${BUNDLE_OFF * 100}% off once you pick ${BUNDLE_MIN} or more`],
            ['Tax', `GST ${GST * 100}% added after the discount`],
          ].map(([k, v]) => (
            <div key={k} className="bg-warm-50 px-4 py-3">
              <dt className="text-caption font-medium uppercase tracking-wide text-warm-700">
                {k}
              </dt>
              <dd className="mt-1 text-warm-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div ref={receiptRef} className="scroll-mt-28 lg:sticky lg:top-28 lg:col-span-5">
        {/* Mask clips box-shadow, so the depth comes from a drop-shadow on the wrapper. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="drop-shadow-[0_24px_32px_rgba(28,24,20,0.22)]"
          data-receipt
        >
          <div
            className="group relative rounded-t-lg bg-warm-900 p-6 pb-10 text-white md:p-7 md:pb-12"
            style={{ WebkitMask: TORN_MASK, mask: TORN_MASK }}
            onPointerMove={onReceiptMove}
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100"
              style={{
                background:
                  'radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,0.07), transparent 70%)',
              }}
              aria-hidden
            />
            <div className="flex items-baseline justify-between text-caption uppercase tracking-wide text-warm-200">
              <span>Your estimate</span>
              <span className="tabular-nums normal-case tracking-normal">
                {selected.length} {selected.length === 1 ? 'piece' : 'pieces'} · {tier.label}
              </span>
            </div>

            <ul className="mt-4 border-t border-white/10">
              <AnimatePresence initial={false}>
                {selected.map((p) => (
                  <motion.li
                    key={p.id}
                    layout={!reduce}
                    className="relative overflow-hidden"
                    data-receipt-row={p.id}
                    {...rowMotion}
                  >
                    <motion.div
                      onMouseEnter={() => setHoveredId(p.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      // Swipe left to remove on touch; the X button covers mouse and keyboard.
                      drag={reduce ? false : 'x'}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={{ left: 0.5, right: 0 }}
                      dragSnapToOrigin
                      onDragEnd={(_, info) => info.offset.x < -80 && removeFromReceipt(p.id)}
                      style={{ touchAction: 'pan-y' }}
                      className={`flex items-center justify-between gap-2 border-b border-white/10 py-3 text-body-sm transition-colors duration-200 ${
                        hoveredId === p.id ? 'bg-white/5' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-warm-100">
                        <span className={`size-2 shrink-0 rounded-full ${p.bar}`} aria-hidden />
                        {p.label}
                      </span>
                      <span className="ml-auto tabular-nums text-white">
                        <Odometer text={rupees(priceOf(p))} sr />
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromReceipt(p.id)}
                        aria-label={`Remove ${p.label}`}
                        data-remove={p.id}
                        className="-my-3 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-warm-200 transition-colors duration-200 hover:text-fox-300 focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-400 active:scale-90"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </motion.div>
                    {/* Fox wash as a piece lands, timed to the chip arriving. */}
                    {!reduce && lastAdded.includes(p.id) && (
                      <motion.span
                        className="pointer-events-none absolute inset-0 bg-fox-500/25"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.5, delay: flyers.length ? 0.4 : 0.1 }}
                        aria-hidden
                      />
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <AnimatePresence initial={false} mode="popLayout">
              {empty && (
                <motion.p
                  key="empty"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6 text-body-sm text-warm-200"
                >
                  Pick a piece to see the total
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div layout={!reduce} className="mt-4 space-y-1.5 text-body-sm text-warm-100">
              <AnimatePresence initial={false}>
                {bundled && (
                  <motion.div
                    key="bundle"
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    className="overflow-hidden"
                    data-bundle-line
                  >
                    <div className="flex justify-between pb-1.5 text-sage-300">
                      <span>Bundle discount {BUNDLE_OFF * 100}%</span>
                      <span className="flex tabular-nums">
                        <span className="leading-[1.1]">−</span>
                        <Odometer text={rupees(saving)} sr />
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <Odometer text={rupees(subtotal)} className="tabular-nums" sr />
              </div>
              <div className="flex justify-between">
                <span>GST {GST * 100}%</span>
                <Odometer text={rupees(gst)} className="tabular-nums" sr />
              </div>
            </motion.div>

            {/* Mini gantt: one coloured segment per piece, width in proportion to its weeks. */}
            <motion.div layout={!reduce} className="mt-5" data-gantt>
              <div className="flex items-baseline justify-between text-caption text-warm-200">
                <span className="truncate pr-2">
                  {hoveredId ? PIECES.find((p) => p.id === hoveredId)?.label : 'Timeline'}
                </span>
                {empty ? (
                  <span>No timeline yet</span>
                ) : (
                  <span className="flex items-center gap-1 tabular-nums">
                    <span className="sr-only">About {weeksLabel(weeks)}</span>
                    <span aria-hidden>About</span>
                    <Odometer text={String(weeks)} />
                    <span aria-hidden>{weeks === 1 ? 'week' : 'weeks'}</span>
                  </span>
                )}
              </div>
              <div
                className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-pill bg-white/10"
                role="img"
                aria-label={
                  empty
                    ? 'No pieces selected'
                    : `Delivery timeline: ${selected.map((p) => p.label).join(', ')}, about ${weeksLabel(weeks)}`
                }
              >
                {selected.map((p, i) => (
                  <motion.span
                    key={p.id}
                    data-gantt-seg={p.id}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    initial={reduce ? false : { scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: hoveredId && hoveredId !== p.id ? 0.45 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.35,
                            ease: EASE,
                            scaleX: { duration: 0.35, ease: EASE, delay: i * 0.06 },
                          }
                    }
                    style={{
                      flexGrow: Math.max(p.weeks, 0.3),
                      flexBasis: 0,
                      transformOrigin: 'left',
                    }}
                    className={`block h-full ${p.bar}`}
                  />
                ))}
              </div>
              <div
                className="mt-1.5 hidden justify-between text-caption tabular-nums text-warm-200 sm:flex"
                aria-hidden
              >
                <span>Week 1</span>
                <span>{empty ? '' : `Week ${weeks}`}</span>
              </div>
            </motion.div>

            <motion.div layout={!reduce} className="mt-5 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-caption text-warm-200">Estimated total</p>
                <AnimatePresence initial={false}>
                  {bundled && (
                    <motion.p
                      key="saved"
                      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                      transition={reduce ? { duration: 0 } : spring}
                      className="rounded-pill bg-sage-600 px-3 py-1 text-caption font-medium text-white"
                      data-saved-badge
                    >
                      You save {rupees(saving)} vs buying separately
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-1" aria-live="polite">
                <Odometer
                  text={rupees(total)}
                  className="font-display text-4xl tabular-nums tracking-tight text-white md:text-5xl"
                />
                <span className="sr-only">
                  {rupees(total)}
                  {bundled ? `, includes a ${BUNDLE_OFF * 100}% bundle discount` : ''}
                </span>
              </p>
            </motion.div>

            <Link to="/builder" className="btn-fox mt-6 w-full">
              Build this for real
            </Link>
            <p className="mt-3 text-caption text-warm-200">
              Sample prices. Your final quote comes after a free scope call.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Phone only: keeps the total on screen while the list is being ticked. Portalled (fixed breaks inside
          transformed ancestors) and lifted above the floating tab bar. */}
      {createPortal(
        <AnimatePresence>
          {listInView && (
            <motion.div
              initial={reduce ? false : { y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: 80, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              className="fixed inset-x-0 z-30 px-4 lg:hidden"
              style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
              data-estimator-bar
            >
              <motion.div
                key={pulse}
                initial={reduce || pulse === 0 ? false : { scale: 1.04 }}
                animate={{ scale: 1 }}
                transition={reduce ? { duration: 0 } : spring}
                className="mx-auto flex max-w-md items-center gap-3 rounded-lg bg-warm-900 py-2.5 pl-4 pr-2.5 text-white shadow-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-caption text-warm-200">
                    {selected.length} {selected.length === 1 ? 'piece' : 'pieces'}
                    {empty ? '' : ` · ${weeksLabel(weeks)}`}
                  </p>
                  <p className="font-display text-xl tabular-nums leading-tight">{rupees(total)}</p>
                </div>
                <button
                  type="button"
                  onClick={jumpToReceipt}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-white px-4 text-body-sm font-medium text-warm-900 transition-colors duration-200 hover:bg-fox-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 active:scale-[0.97]"
                >
                  See receipt
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Chips in flight: portalled so no transformed ancestor can offset the fixed coordinates. */}
      {createPortal(
        flyers.map((f) => (
          <motion.div
            key={f.key}
            initial={{ x: f.x0, y: f.y0, scale: 1, opacity: 1 }}
            animate={{ x: f.x1, y: f.y1, scale: 0.7, opacity: [1, 1, 0] }}
            transition={{ duration: 0.42, ease: EASE }}
            onAnimationComplete={() => setFlyers((cur) => cur.filter((c) => c.key !== f.key))}
            className="pointer-events-none fixed left-0 top-0 z-50 -ml-3.5 -mt-3.5 flex h-7 items-center gap-1.5 rounded-pill bg-fox-500 px-2.5 text-caption font-medium tabular-nums text-white shadow-md"
            aria-hidden
          >
            <f.Icon className="size-3.5" />
            {f.price}
          </motion.div>
        )),
        document.body,
      )}
    </div>
  );
}

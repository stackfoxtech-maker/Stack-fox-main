import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  Check,
  FileSignature,
  LayoutGrid,
  ReceiptText,
  Search,
  ShoppingCart,
  Activity,
  Bell,
  Pause,
  Play,
} from 'lucide-react';

const EASE = [0.2, 0.7, 0.2, 1];
const CHAPTER_S = 3.4;
// Scroll mode: where the pinned track starts and how much of it the 4 chapters share.
const P0 = 0.04;
const PSPAN = 0.84;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

const inr = (n) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n));

const PIECES = [
  { name: 'Business website, 5 pages', meta: 'Web · 2 weeks', price: 35000 },
  { name: 'Logo + brand kit', meta: 'Design · 5 days', price: 18000 },
  { name: 'Razorpay checkout', meta: 'Payments · 3 days', price: 12000 },
  { name: 'SEO starter pack', meta: 'Growth · 1 week', price: 15000 },
];
const SUBTOTAL = PIECES.reduce((s, p) => s + p.price, 0);
const GST = SUBTOTAL * 0.18;
const TOTAL = SUBTOTAL + GST;
const FIRST_MILESTONE = TOTAL * 0.3;

const CHAPTERS = [
  {
    key: 'pick',
    label: 'Pick services',
    nav: 'Catalogue',
    icon: LayoutGrid,
    line: 'Browse 255 services and add what your business needs. Nothing to install, no call first.',
  },
  {
    key: 'price',
    label: 'See the price',
    nav: 'Your plan',
    icon: ReceiptText,
    line: 'Every piece itemised, GST included, before you commit to anything.',
  },
  {
    key: 'sign',
    label: 'Sign & pay',
    nav: 'Checkout',
    icon: FileSignature,
    line: 'Sign the statement of work online and pay the first milestone by UPI.',
  },
  {
    key: 'track',
    label: 'Track delivery',
    nav: 'Dashboard',
    icon: Activity,
    line: 'Milestones, checks and invoices in one place, updated as the team ships.',
  },
];

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Rupee amount whose digits roll like an odometer. Columns are keyed from the right so a new digit rolls up from 0. */
function Roll({ value, delay = 0, still = false, className = '' }) {
  const text = inr(value);
  return (
    <span className={`inline-flex ${className}`}>
      <span className="sr-only">{text}</span>
      <span className="inline-flex" aria-hidden>
        {[...text].map((ch, i) => {
          const fromRight = text.length - 1 - i;
          return (
            <span
              key={fromRight}
              className="inline-block h-[1.1em] overflow-hidden leading-[1.1em]"
            >
              {/\d/.test(ch) ? (
                <motion.span
                  className="flex flex-col"
                  initial={still ? false : { y: '0%' }}
                  animate={{ y: `${-Number(ch) * 10}%` }}
                  transition={{ duration: 0.4, ease: EASE, delay: delay + fromRight * 0.03 }}
                >
                  {DIGITS.map((d) => (
                    <span key={d} className="block h-[1.1em] leading-[1.1em]">
                      {d}
                    </span>
                  ))}
                </motion.span>
              ) : (
                ch
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/* A cursor glides to each row and clicks "Add", the way a visitor would. */
const CLICK_AT = (i) => 0.45 + i * 0.5;

function Cursor() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden>
      <path
        d="M1 1l15 9.5-6.6 1.4L13 20l-3 1.3-3.6-8.1L1 17.5z"
        fill="#1a1918"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScenePick({ still, onAdd }) {
  const box = useRef(null);
  const btns = useRef([]);
  const [points, setPoints] = useState(null);
  const [on, setOn] = useState(() => PIECES.map(() => still));
  // Once the visitor clicks, the scripted cursor steps aside.
  const touched = useRef(false);

  useLayoutEffect(() => {
    if (still || !box.current) return;
    const o = box.current.getBoundingClientRect();
    setPoints(
      btns.current.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - o.left + r.width * 0.55, y: r.top - o.top + r.height * 0.6 };
      }),
    );
  }, [still]);

  useEffect(() => {
    if (still) return undefined;
    const timers = PIECES.map((_, i) =>
      setTimeout(
        () => {
          if (!touched.current) setOn((a) => a.map((v, j) => v || j === i));
        },
        CLICK_AT(i) * 1000,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [still]);

  // Cart badge and total chip in the window chrome follow every add, scripted or real.
  useEffect(() => {
    if (!still) onAdd(on.filter(Boolean).length);
  }, [on, still, onAdd]);

  const toggle = (i) => {
    touched.current = true;
    setPoints(null);
    setOn((a) => a.map((v, j) => (j === i ? !v : v)));
  };

  return (
    <div ref={box} className="relative flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2 rounded-sm border border-warm-200 bg-warm-white px-3 py-2 text-body-sm text-warm-700">
        <Search size={14} /> Search 255 services
      </div>
      <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-warm-700">
        Popular for new businesses
      </p>
      <ul className="space-y-2">
        {PIECES.map((p, i) => {
          const isOn = on[i];
          return (
            <li
              key={p.name}
              className={`group/row flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5 transition-[color,background-color,border-color,box-shadow] duration-300 hover:shadow-sm ${
                isOn
                  ? 'border-sage-200 bg-sage-50/60'
                  : 'border-warm-100 bg-white hover:border-fox-300'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-warm-900">{p.name}</p>
                <p className="text-caption text-warm-700">{p.meta}</p>
              </div>
              <span className="shrink-0 text-body-sm tabular-nums text-warm-900">
                {inr(p.price)}
              </span>
              <motion.button
                type="button"
                ref={(el) => (btns.current[i] = el)}
                onClick={() => toggle(i)}
                aria-pressed={isOn}
                aria-label={`${isOn ? 'Remove' : 'Add'} ${p.name}`}
                animate={isOn && !still ? { scale: [1, 0.9, 1] } : {}}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.25 }}
                // The extra hit area keeps a 44px touch target without enlarging the pill.
                className={`relative inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-pill text-caption font-semibold outline-none transition-colors before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-fox-500 focus-visible:ring-offset-2 ${
                  isOn
                    ? 'bg-sage-500 text-white hover:bg-sage-600'
                    : 'bg-warm-900 text-white group-hover/row:bg-fox-500'
                }`}
              >
                {isOn ? (
                  <>
                    <Check size={12} /> Added
                  </>
                ) : (
                  '+ Add'
                )}
              </motion.button>
            </li>
          );
        })}
      </ul>
      {points && (
        <>
          {/* Click ripple: confirms the press landed on the button. */}
          {points.map((pt, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 -ml-3 -mt-3 h-6 w-6 rounded-full border-2 border-fox-500"
              style={{ x: pt.x, y: pt.y }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.7], opacity: [0.7, 0] }}
              transition={{ delay: CLICK_AT(i), duration: 0.5, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-10"
            initial={false}
            animate={{
              x: [points[0].x + 140, ...points.map((pt) => pt.x), points.at(-1).x + 40],
              y: [points[0].y + 180, ...points.map((pt) => pt.y), points.at(-1).y + 70],
              opacity: [0, 1, 1, 1, 1, 0],
            }}
            transition={{
              duration: CLICK_AT(PIECES.length - 1) + 0.8,
              times: [
                0,
                ...PIECES.map((_, i) => CLICK_AT(i) / (CLICK_AT(PIECES.length - 1) + 0.8)),
                1,
              ],
              ease: 'easeInOut',
            }}
          >
            <Cursor />
          </motion.div>
        </>
      )}
    </div>
  );
}

function ScenePrice({ still }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-title text-warm-900">Your plan, itemised</p>
        <p className="text-caption text-warm-700">Indicative · confirmed on a free call</p>
      </div>
      <ul className="divide-y divide-warm-100 rounded-sm border border-warm-100 bg-white">
        {PIECES.map((p, i) => (
          <motion.li
            key={p.name}
            // Rows slide into the receipt one after another.
            initial={still ? false : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.02 + i * 0.045, duration: 0.25, ease: EASE }}
            className="group/line flex justify-between px-3 py-2 text-body-sm transition-colors hover:bg-fox-50"
          >
            <span className="text-warm-700 transition-colors group-hover/line:text-warm-900">
              {p.name}
            </span>
            <span className="tabular-nums text-warm-900">{inr(p.price)}</span>
          </motion.li>
        ))}
      </ul>
      <motion.div
        initial={still ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.25, ease: EASE }}
        className="mt-3 space-y-1 text-body-sm text-warm-700"
      >
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{inr(SUBTOTAL)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST 18%</span>
          <span className="tabular-nums">{inr(GST)}</span>
        </div>
      </motion.div>
      <div className="mt-auto flex items-baseline justify-between border-t-2 border-warm-900 pt-3">
        <span className="text-title text-warm-900">Total</span>
        <Roll
          value={TOTAL}
          delay={0.25}
          still={still}
          className="font-display text-3xl font-bold tabular-nums tracking-tight text-fox-600"
        />
      </div>
    </div>
  );
}

/* Signature as an SVG stroke so the pen can be drawn with pathLength. */
const SIGNATURE =
  'M4 38 C 14 8, 22 8, 24 30 S 34 44, 44 20 C 48 8, 56 10, 54 28 S 70 40, 80 18 C 84 10, 90 12, 88 26 S 104 38, 122 22';

// Sign scene beats (seconds): stamp, payment confirmed, paid banner.
const T_STAMP = 0.9;
const T_PAY = 1.3;
const T_PAID = 1.8;

function SceneSign({ still }) {
  return (
    <div className="grid h-full gap-4 sm:grid-cols-2" data-scene="sign">
      <div className="flex flex-col rounded-sm border border-warm-100 bg-white p-4 shadow-sm">
        <p className="text-caption font-medium uppercase tracking-wide text-warm-700">
          Statement of work
        </p>
        <div className="mt-3 space-y-1.5" aria-hidden>
          {[92, 78, 85, 60, 88, 70].map((w, i) => (
            <motion.div
              key={i}
              className="h-1.5 origin-left rounded-pill bg-warm-100"
              style={{ width: `${w}%` }}
              initial={still ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: EASE }}
            />
          ))}
        </div>
        <div className="relative mt-auto pt-6">
          <svg viewBox="0 0 130 50" className="h-12 w-full" aria-hidden data-hook="signature">
            <motion.path
              d={SIGNATURE}
              fill="none"
              stroke="#1a1918"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={still ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 1.1, ease: 'easeInOut' }}
            />
          </svg>
          <p className="border-t border-warm-300 pt-1 text-caption text-warm-700">
            Client signature · Neha Rao
          </p>
          <motion.span
            data-hook="stamp"
            initial={still ? false : { opacity: 0, scale: 1.4, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: -6 }}
            transition={{
              delay: still ? 0 : T_STAMP,
              type: 'spring',
              stiffness: 380,
              damping: 22,
            }}
            className="absolute bottom-7 right-1 inline-flex items-center gap-1 rounded-sm border-2 border-sage-500 bg-white/80 px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-sage-700"
          >
            <Check size={12} strokeWidth={3} /> Signed
          </motion.span>
        </div>
      </div>
      <div className="flex flex-col rounded-sm border border-warm-100 bg-white p-4 shadow-sm">
        <p className="text-caption font-medium uppercase tracking-wide text-warm-700">
          First milestone · 30%
        </p>
        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-warm-900">
          {inr(FIRST_MILESTONE)}
        </p>
        <div className="mt-3 space-y-2 text-body-sm">
          {['UPI', 'Card or netbanking', 'Cash at our office'].map((m, i) => (
            <div
              key={m}
              className={`flex items-center gap-2 rounded-sm border px-3 py-2 ${
                i === 0 ? 'border-fox-300 bg-fox-50 text-warm-900' : 'border-warm-100 text-warm-800'
              }`}
            >
              <span
                data-hook={i === 0 ? 'pay-ring' : undefined}
                className={`relative grid h-4 w-4 place-items-center rounded-full border ${
                  i === 0 ? 'border-fox-500' : 'border-warm-300'
                }`}
              >
                {i === 0 && (
                  <>
                    {/* Disc fills, a ripple leaves it, then the tick draws. */}
                    <motion.span
                      className="absolute -inset-px rounded-full bg-fox-500"
                      initial={still ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: T_PAY, duration: 0.25, ease: EASE }}
                    />
                    {!still && (
                      <motion.span
                        aria-hidden
                        className="absolute -inset-px rounded-full border-2 border-fox-500"
                        initial={{ scale: 1, opacity: 0 }}
                        animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
                        transition={{ delay: T_PAY, duration: 0.6, ease: 'easeOut' }}
                      />
                    )}
                    <svg viewBox="0 0 12 12" className="relative h-2.5 w-2.5" aria-hidden>
                      <motion.path
                        d="M2.2 6.4l2.4 2.4 5-5.4"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={still ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: T_PAY + 0.15, duration: 0.3, ease: EASE }}
                      />
                    </svg>
                  </>
                )}
              </span>
              {m}
            </div>
          ))}
        </div>
        <motion.div
          data-hook="paid"
          initial={still ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: still ? 0 : T_PAID, duration: 0.4, ease: EASE }}
          className="mt-auto flex items-center gap-2 rounded-sm bg-sage-50 px-3 py-2 text-body-sm font-medium text-sage-700"
        >
          <Check size={14} /> Paid. Your project is live.
        </motion.div>
      </div>
    </div>
  );
}

const MILESTONES = [
  { name: 'Design approved', pct: 100, note: 'Approved by you · Mon' },
  { name: 'Build & integrate', pct: 100, note: 'Shipped to staging · Thu' },
  { name: 'Review & QA', pct: 64, note: '12 of 19 checks passed' },
  { name: 'Launch', pct: 0, note: 'Planned for next Friday' },
];
const TOASTS = ['Build shipped to staging', 'QA update: 12 of 19 checks passed'];
// Each milestone bar starts 0.45s after the last and takes 0.7s.
const BAR_AT = (i) => 0.15 + i * 0.28;

function SceneTrack({ still }) {
  // `cur` is the milestone the "Today" marker sits on; it steps on as bars complete.
  const [cur, setCur] = useState(still ? 2 : 0);
  const [toast, setToast] = useState(still ? 1 : -1);

  useEffect(() => {
    if (still) return undefined;
    const timers = [
      setTimeout(() => setCur(1), (BAR_AT(0) + 0.7) * 1000),
      setTimeout(() => setCur(2), (BAR_AT(1) + 0.7) * 1000),
      setTimeout(() => setToast(0), 700),
      setTimeout(() => setToast(1), 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [still]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-title text-warm-900">Neha&apos;s storefront</p>
        <p className="text-caption tabular-nums text-warm-700">Week 4 of 6</p>
      </div>
      <ul className="space-y-3.5">
        {MILESTONES.map((m, i) => {
          const done = m.pct === 100;
          return (
            <li
              key={m.name}
              className="-mx-2 rounded-sm px-2 py-1 transition-colors hover:bg-white"
            >
              <div className="mb-1.5 flex items-center justify-between text-body-sm">
                <span className="flex items-center gap-2 font-medium text-warm-900">
                  <span className="relative grid h-4 w-4 place-items-center rounded-full border border-warm-300">
                    {done && (
                      <motion.span
                        className="absolute -inset-px grid place-items-center rounded-full bg-sage-500 text-white"
                        initial={false}
                        animate={{ scale: cur > i ? 1 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      >
                        <Check size={10} strokeWidth={3} />
                      </motion.span>
                    )}
                  </span>
                  {m.name}
                  {cur === i && (
                    <motion.span
                      layoutId="journey-today"
                      data-hook="today"
                      transition={{ duration: 0.4, ease: EASE }}
                      className="rounded-pill bg-fox-500 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white"
                    >
                      Today
                    </motion.span>
                  )}
                </span>
                <span className="text-caption text-warm-700">{m.note}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-pill bg-warm-100">
                <motion.div
                  className={`h-full origin-left rounded-pill ${done ? 'bg-sage-500' : 'bg-fox-500'}`}
                  initial={still ? false : { scaleX: 0 }}
                  animate={{ scaleX: m.pct / 100 }}
                  transition={{ delay: BAR_AT(i), duration: 0.7, ease: EASE }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mb-2 mt-auto flex min-h-[2rem] justify-end">
        <AnimatePresence mode="wait" initial={false}>
          {toast >= 0 && (
            <motion.div
              key={toast}
              data-hook="toast"
              initial={still ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex items-center gap-2 self-end rounded-sm bg-white px-3 py-2 text-caption text-warm-900 shadow-md ring-1 ring-warm-900/10"
            >
              <Bell size={13} className="text-fox-500" /> {TOASTS[toast]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between rounded-sm bg-warm-50 px-3 py-2.5 text-body-sm">
        <span className="text-warm-800">Paid 2 of 4 milestones</span>
        <span className="font-medium text-warm-900">Next invoice when QA is signed off</span>
      </div>
    </div>
  );
}

const SCENES = [ScenePick, ScenePrice, SceneSign, SceneTrack];

/** One rail segment's fill: scales with the journey position, so scroll and timer share it. */
function RailFill({ s, i }) {
  const scaleX = useTransform(s, (v) => clamp01(v - i));
  return <motion.span className="block h-full origin-left bg-fox-500" style={{ scaleX }} />;
}

// Caption lines slide up out of a mask and the old ones leave upward.
const CAP = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { duration: 0.45, ease: EASE } },
  exit: { y: '-100%', transition: { duration: 0.25, ease: EASE } },
};

/**
 * The homepage hero film: one framed product window that plays the whole
 * customer journey, chapter by chapter. With a `progress` motion value (the
 * pinned scroll track) scrolling drives the chapters; otherwise a timer does,
 * pausing off-screen. Reduced motion holds still and waits for a click.
 */
export function JourneyFilm({ stageClassName = '', progress, onJump }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const visible = useInView(ref, { amount: 0.35 });
  const scrollMode = !!progress && !reduce;
  const [chapter, setChapter] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false); // explicit pause for touch and keyboard
  const [hot, setHot] = useState(null); // chapter under the pointer or focus, shared by rail and sidebar
  const [cart, setCart] = useState(reduce ? PIECES.length : 0);
  const onAdd = useCallback((n) => setCart(n), []);

  // Journey position 0..4: the single source for the rail fill.
  const s = useMotionValue(0);
  const idle = useMotionValue(0);

  const fromScroll = useCallback(
    (v) => {
      const x = clamp01((v - P0) / PSPAN) * CHAPTERS.length;
      s.set(x);
      setChapter(Math.min(CHAPTERS.length - 1, Math.floor(x))); // no-op unless the chapter changes
    },
    [s],
  );
  useMotionValueEvent(progress || idle, 'change', (v) => scrollMode && fromScroll(v));

  useEffect(() => {
    if (scrollMode) fromScroll(progress.get());
    else s.set(chapter);
    // Only when the mode flips; later changes come from scroll or the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMode]);

  useEffect(() => {
    if (scrollMode) return undefined;
    if (reduce) {
      s.set(chapter + 1);
      return undefined;
    }
    if (!visible || paused) return undefined;
    const left = clamp01(chapter + 1 - s.get());
    const run = animate(s, chapter + 1, {
      duration: left * CHAPTER_S,
      ease: 'linear',
      onComplete: () => {
        const next = (chapter + 1) % CHAPTERS.length;
        s.set(next);
        setChapter(next);
      },
    });
    return () => run.stop();
  }, [scrollMode, reduce, visible, paused, chapter, cycle, s]);

  const go = (i) => {
    if (scrollMode) {
      onJump?.(i);
      return;
    }
    s.set(i);
    setChapter(i);
    setCycle((c) => c + 1);
  };
  const Scene = SCENES[chapter];
  const cartCount = chapter === 0 ? cart : PIECES.length;
  const cartSum = PIECES.slice(0, cartCount).reduce((t, p) => t + p.price, 0);

  // Soft light that follows the pointer over the stage (fine pointers only).
  const [lit] = useState(
    () => typeof window !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const lx = useMotionValue(0);
  const ly = useMotionValue(0);
  const lo = useMotionValue(0);
  const lightX = useSpring(lx, { stiffness: 140, damping: 22 });
  const lightY = useSpring(ly, { stiffness: 140, damping: 22 });
  const lightO = useSpring(lo, { stiffness: 120, damping: 20 });
  const light = lit && !reduce;

  return (
    <div ref={ref}>
      <div className={stageClassName}>
        <motion.div className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_1px_0_rgba(26,25,24,0.04),0_40px_80px_-32px_rgba(26,25,24,0.35)] ring-1 ring-warm-900/10">
          {/* Window chrome */}
          <div className="flex items-center gap-3 border-b border-warm-100 bg-warm-50 px-4 py-2.5">
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
            </div>
            <div className="mx-auto rounded-sm bg-white px-3 py-1 font-mono text-[11px] text-warm-700 ring-1 ring-warm-100">
              stackfox.in/{CHAPTERS[chapter].key === 'track' ? 'app/client' : 'builder'}
            </div>
            <span
              data-hook="total-chip"
              className="hidden rounded-pill bg-fox-50 px-2 py-0.5 text-caption font-semibold tabular-nums text-fox-600 sm:inline-flex"
              aria-hidden
            >
              <Roll value={chapter === 0 ? cartSum : TOTAL} still={reduce} />
            </span>
            <span className="relative inline-flex items-center text-warm-700" aria-hidden>
              <ShoppingCart size={16} />
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={reduce ? false : { scale: 1.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 16 }}
                  className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-fox-500 text-[10px] font-bold text-white"
                >
                  {cartCount}
                </motion.span>
              )}
            </span>
          </div>

          <div className="grid md:grid-cols-[13rem_1fr]">
            {/* App sidebar */}
            <nav aria-hidden className="hidden border-r border-warm-100 bg-warm-white p-3 md:block">
              <p className="px-2 pb-3 pt-1 font-display text-body-sm font-bold text-warm-900">
                Stack<span className="text-fox-500">Fox</span>
              </p>
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  tabIndex={-1}
                  data-nav={c.key}
                  onClick={() => go(i)}
                  onPointerEnter={() => setHot(i)}
                  onPointerLeave={() => setHot(null)}
                  className={`relative mb-0.5 flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-body-sm transition-[color,background-color,transform] active:scale-[0.98] ${
                    i === chapter ? 'font-medium text-warm-900' : 'text-warm-700'
                  } ${i === hot && i !== chapter ? 'bg-warm-100/70 text-warm-900' : ''}`}
                >
                  {i === chapter && (
                    <motion.span
                      layoutId="journey-nav-pill"
                      className="absolute inset-0 rounded-sm bg-white shadow-sm ring-1 ring-warm-900/5"
                      transition={{ duration: 0.35, ease: EASE }}
                    />
                  )}
                  <c.icon size={15} className={`relative ${i === chapter ? 'text-fox-500' : ''}`} />
                  <span className="relative">{c.nav}</span>
                </button>
              ))}
            </nav>

            {/* Stage */}
            <div
              className="relative h-[27rem] touch-pan-y overflow-hidden bg-warm-white/60 p-4 sm:h-[25rem] sm:p-6"
              onPointerMove={
                light
                  ? (e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      lx.set(e.clientX - r.left - 224);
                      ly.set(e.clientY - r.top - 224);
                      lo.set(1);
                    }
                  : undefined
              }
              onPointerLeave={light ? () => lo.set(0) : undefined}
            >
              {light && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 h-[28rem] w-[28rem] rounded-full"
                  style={{
                    x: lightX,
                    y: lightY,
                    opacity: lightO,
                    background:
                      'radial-gradient(circle, rgba(255,77,0,0.13) 0%, rgba(255,77,0,0) 65%)',
                  }}
                />
              )}
              {/* Keyed so each chapter fades in fresh. It used to sit inside AnimatePresence
                  mode="wait": when a switch interrupted the exit, the next scene could stay at
                  opacity 0 and the window went blank after the first loop. */}
              <motion.div
                key={`${chapter}-${cycle}`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="relative h-full"
                // Swipe on touch (timer mode) changes chapter.
                onPanEnd={(_, { offset }) => {
                  if (
                    scrollMode ||
                    Math.abs(offset.x) < 60 ||
                    Math.abs(offset.x) < Math.abs(offset.y)
                  )
                    return;
                  go((chapter + (offset.x < 0 ? 1 : CHAPTERS.length - 1)) % CHAPTERS.length);
                }}
              >
                <Scene still={reduce} onAdd={onAdd} />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Caption: what is happening now. */}
      <div className="relative mt-6 min-h-[10.5rem] sm:min-h-[6.5rem]">
        {!scrollMode && !reduce && (
          <button
            type="button"
            data-hook="pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play the journey' : 'Pause the journey'}
            aria-pressed={paused}
            className="absolute right-0 top-0 z-10 grid h-11 w-11 place-items-center rounded-full text-warm-800 outline-none transition-[color,background-color,transform] hover:bg-warm-100 hover:text-warm-900 active:scale-90 focus-visible:ring-2 focus-visible:ring-fox-500"
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}
        <div data-hook="caption" aria-live="polite" className="pr-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={chapter}
              className="flex items-start gap-4"
              initial={reduce ? false : 'hidden'}
              animate="show"
              exit={reduce ? undefined : 'exit'}
              variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            >
              <span className="block shrink-0 overflow-hidden pb-[0.12em]">
                <motion.span
                  variants={CAP}
                  className="block font-display text-display-md font-bold leading-none tabular-nums text-fox-500"
                >
                  {String(chapter + 1).padStart(2, '0')}
                </motion.span>
              </span>
              <div className="max-w-2xl">
                <span className="block overflow-hidden pb-1">
                  <motion.p
                    variants={CAP}
                    className="font-display text-title font-bold text-warm-900"
                  >
                    {CHAPTERS[chapter].label}
                  </motion.p>
                </span>
                <span className="mt-1 block overflow-hidden pb-1">
                  <motion.p variants={CAP} className="text-body text-warm-800">
                    {CHAPTERS[chapter].line}
                  </motion.p>
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Chapter timeline */}
      <div
        className="mt-5 grid grid-cols-4 gap-3"
        role="tablist"
        aria-label="Customer journey"
        data-hook="rail"
        onKeyDown={(e) => {
          const last = CHAPTERS.length - 1;
          const to = {
            ArrowRight: (chapter + 1) % (last + 1),
            ArrowLeft: (chapter + last) % (last + 1),
            Home: 0,
            End: last,
          }[e.key];
          if (to === undefined) return;
          e.preventDefault();
          go(to);
          e.currentTarget.children[to].focus();
        }}
      >
        {CHAPTERS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={i === chapter}
            tabIndex={i === chapter ? 0 : -1}
            onClick={() => go(i)}
            onPointerEnter={() => setHot(i)}
            onPointerLeave={() => setHot(null)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            className="group min-h-[44px] rounded-sm text-left outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-fox-500 focus-visible:ring-offset-4 focus-visible:ring-offset-warm-white"
          >
            <span
              className={`block h-[3px] origin-left overflow-hidden rounded-pill bg-warm-900/10 transition-transform ${
                hot === i ? 'scale-y-[1.7]' : ''
              }`}
            >
              {i < chapter && <span className="block h-full w-full bg-warm-900" />}
              {i === chapter && <RailFill s={s} i={i} />}
            </span>
            <span
              className={`mt-2 block text-body-sm transition-colors ${
                i === chapter
                  ? 'font-medium text-warm-900'
                  : hot === i
                    ? 'text-warm-900'
                    : 'text-warm-700'
              }`}
            >
              <span className="mr-1.5 tabular-nums text-warm-600">{i + 1}</span>
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
  Check,
  FileSignature,
  LayoutGrid,
  ReceiptText,
  Search,
  ShoppingCart,
  Activity,
} from 'lucide-react';

const EASE = [0.2, 0.7, 0.2, 1];
const CHAPTER_MS = 5200;

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
  { key: 'pick', label: 'Pick services', nav: 'Catalogue', icon: LayoutGrid },
  { key: 'price', label: 'See the price', nav: 'Your plan', icon: ReceiptText },
  { key: 'sign', label: 'Sign & pay', nav: 'Checkout', icon: FileSignature },
  { key: 'track', label: 'Track delivery', nav: 'Dashboard', icon: Activity },
];

/** Counts from 0 to `to` once mounted. */
function useTicker(to, { delay = 0, duration = 900, still = false } = {}) {
  const [v, setV] = useState(still ? to : 0);
  useEffect(() => {
    if (still) return setV(to);
    let raf;
    const start = performance.now() + delay;
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setV(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, duration, still]);
  return v;
}

/* A cursor glides to each row and clicks "Add", the way a visitor would. */
const CLICK_AT = (i) => 0.9 + i * 0.85;

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

function ScenePick({ still }) {
  const box = useRef(null);
  const btns = useRef([]);
  const [points, setPoints] = useState(null);
  const [added, setAdded] = useState(still ? PIECES.length : 0);

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
      setTimeout(() => setAdded((n) => Math.max(n, i + 1)), CLICK_AT(i) * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [still]);

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
          const on = i < added;
          return (
            <li
              key={p.name}
              className={`flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5 transition-colors duration-300 ${
                on ? 'border-sage-200 bg-sage-50/60' : 'border-warm-100 bg-white'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-warm-900">{p.name}</p>
                <p className="text-caption text-warm-700">{p.meta}</p>
              </div>
              <span className="shrink-0 text-body-sm tabular-nums text-warm-900">
                {inr(p.price)}
              </span>
              <motion.span
                ref={(el) => (btns.current[i] = el)}
                animate={on && !still ? { scale: [1, 0.9, 1] } : {}}
                transition={{ duration: 0.25 }}
                className={`inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-pill text-caption font-semibold transition-colors ${
                  on ? 'bg-sage-500 text-white' : 'bg-warm-900 text-white'
                }`}
              >
                {on ? (
                  <>
                    <Check size={12} /> Added
                  </>
                ) : (
                  '+ Add'
                )}
              </motion.span>
            </li>
          );
        })}
      </ul>
      {points && (
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
      )}
    </div>
  );
}

function ScenePrice({ still }) {
  const total = useTicker(TOTAL, { delay: 500, duration: 1200, still });
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
            initial={still ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: EASE }}
            className="flex justify-between px-3 py-2 text-body-sm"
          >
            <span className="text-warm-700">{p.name}</span>
            <span className="tabular-nums text-warm-900">{inr(p.price)}</span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-3 space-y-1 text-body-sm text-warm-700">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{inr(SUBTOTAL)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST 18%</span>
          <span className="tabular-nums">{inr(GST)}</span>
        </div>
      </div>
      <div className="mt-auto flex items-baseline justify-between border-t-2 border-warm-900 pt-3">
        <span className="text-title text-warm-900">Total</span>
        <span className="font-display text-3xl font-bold tabular-nums tracking-tight text-fox-600">
          {inr(total)}
        </span>
      </div>
    </div>
  );
}

function SceneSign({ still }) {
  const name = 'Neha Rao';
  const [typed, setTyped] = useState(still ? name.length : 0);
  useEffect(() => {
    if (still) return undefined;
    const t = setInterval(() => setTyped((n) => (n >= name.length ? n : n + 1)), 110);
    return () => clearInterval(t);
  }, [still]);
  return (
    <div className="grid h-full gap-4 sm:grid-cols-2">
      <div className="flex flex-col rounded-sm border border-warm-100 bg-white p-4">
        <p className="text-caption font-medium uppercase tracking-wide text-warm-600">
          Statement of work
        </p>
        <div className="mt-3 space-y-1.5" aria-hidden>
          {[92, 78, 85, 60, 88, 70].map((w, i) => (
            <div key={i} className="h-1.5 rounded-pill bg-warm-100" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="mt-auto pt-6">
          <p className="min-h-[2rem] border-b border-warm-300 font-serif text-2xl italic text-warm-900">
            {name.slice(0, typed)}
            {typed < name.length && <span className="animate-pulse">|</span>}
          </p>
          <p className="mt-1 text-caption text-warm-700">Client signature</p>
        </div>
      </div>
      <div className="flex flex-col rounded-sm border border-warm-100 bg-white p-4">
        <p className="text-caption font-medium uppercase tracking-wide text-warm-600">
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
                className={`h-3.5 w-3.5 rounded-full border ${i === 0 ? 'border-[4px] border-fox-500' : 'border-warm-300'}`}
              />
              {m}
            </div>
          ))}
        </div>
        <motion.div
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: still ? 0 : 2.4, duration: 0.3, ease: EASE }}
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

function SceneTrack({ still }) {
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
            <li key={m.name}>
              <div className="mb-1.5 flex items-center justify-between text-body-sm">
                <span className="flex items-center gap-2 font-medium text-warm-900">
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full ${
                      done ? 'bg-sage-500 text-white' : 'border border-warm-300'
                    }`}
                  >
                    {done && <Check size={10} strokeWidth={3} />}
                  </span>
                  {m.name}
                </span>
                <span className="text-caption text-warm-700">{m.note}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-pill bg-warm-100">
                <motion.div
                  className={`h-full rounded-pill ${done ? 'bg-sage-500' : 'bg-fox-500'}`}
                  initial={still ? false : { width: 0 }}
                  animate={{ width: `${m.pct}%` }}
                  transition={{ delay: 0.2 + i * 0.3, duration: 0.8, ease: EASE }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex items-center justify-between rounded-sm bg-warm-50 px-3 py-2.5 text-body-sm">
        <span className="text-warm-800">Paid 2 of 4 milestones</span>
        <span className="font-medium text-warm-900">Next invoice when QA is signed off</span>
      </div>
    </div>
  );
}

const SCENES = [ScenePick, ScenePrice, SceneSign, SceneTrack];

/**
 * The homepage hero film: one framed product window that plays the whole
 * customer journey, chapter by chapter. Plays only while on screen; with
 * reduced motion it holds still and waits for a click.
 */
export function JourneyFilm({ stageClassName = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const visible = useInView(ref, { amount: 0.35 });
  const [chapter, setChapter] = useState(0);
  const [cycle, setCycle] = useState(0);
  const playing = visible && !reduce;

  useEffect(() => {
    if (!playing) return undefined;
    const t = setTimeout(() => setChapter((c) => (c + 1) % CHAPTERS.length), CHAPTER_MS);
    return () => clearTimeout(t);
  }, [playing, chapter, cycle]);

  const go = (i) => {
    setChapter(i);
    setCycle((c) => c + 1);
  };
  const Scene = SCENES[chapter];
  const cartCount = chapter === 0 ? null : PIECES.length;

  return (
    <div ref={ref}>
      <div className={stageClassName}>
        <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_1px_0_rgba(26,25,24,0.04),0_40px_80px_-32px_rgba(26,25,24,0.35)] ring-1 ring-warm-900/10">
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
            <span className="relative inline-flex items-center text-warm-700" aria-hidden>
              <ShoppingCart size={16} />
              {cartCount && (
                <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-fox-500 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
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
                <div
                  key={c.key}
                  className={`mb-0.5 flex items-center gap-2 rounded-sm px-2 py-2 text-body-sm transition-colors ${
                    i === chapter ? 'bg-white font-medium text-warm-900 shadow-sm' : 'text-warm-700'
                  }`}
                >
                  <c.icon size={15} className={i === chapter ? 'text-fox-500' : ''} />
                  {c.nav}
                </div>
              ))}
            </nav>

            {/* Stage */}
            <div className="relative h-[27rem] overflow-hidden bg-warm-white/60 p-4 sm:h-[25rem] sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${chapter}-${cycle}`}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="h-full"
                >
                  <Scene still={reduce} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter timeline */}
      <div className="mt-5 grid grid-cols-4 gap-3" role="tablist" aria-label="Customer journey">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={i === chapter}
            onClick={() => go(i)}
            className="group text-left"
          >
            <span className="block h-[3px] overflow-hidden rounded-pill bg-warm-900/10">
              {i < chapter && <span className="block h-full w-full bg-warm-900" />}
              {i === chapter && (
                <motion.span
                  key={`${cycle}-${chapter}-${playing}`}
                  className="block h-full bg-fox-500"
                  initial={{ width: playing ? '0%' : '100%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: playing ? CHAPTER_MS / 1000 : 0, ease: 'linear' }}
                />
              )}
            </span>
            <span
              className={`mt-2 block text-body-sm transition-colors ${
                i === chapter
                  ? 'font-medium text-warm-900'
                  : 'text-warm-700 group-hover:text-warm-800'
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

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import { Bell, Check, Home, Search, ShoppingBag, Star, User } from 'lucide-react';

/* Coded previews of what each build looks like when it ships. Product UI, not photos.
   Each one plays a short story when it becomes active (one timeline per preview) and
   rests in its finished state. Reduced motion jumps straight to that finished state. */

const EASE = [0.2, 0.7, 0.2, 1];
const POP = { type: 'spring', stiffness: 420, damping: 24 };
const HOT = 'ring-2 ring-fox-500 ring-offset-2';

/** n = how many of the `marks` (ms from start) have passed. Starts when `start` turns true. */
function useTimeline(marks, start, reduce) {
  const [n, setN] = useState(reduce ? marks.length : 0);
  useEffect(() => {
    if (reduce) {
      setN(marks.length);
      return undefined;
    }
    if (!start) return undefined;
    const ts = marks.map((m, i) => setTimeout(() => setN(i + 1), m));
    return () => ts.forEach(clearTimeout);
  }, [marks, start, reduce]);
  return n;
}

function useTyped(text, on, cps, reduce) {
  const [i, setI] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      setI(text.length);
      return undefined;
    }
    if (!on) return undefined;
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      setI(k);
      if (k >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [text, on, cps, reduce]);
  return text.slice(0, i);
}

/** Types `text` but reserves the full width/height up front so nothing reflows. */
function Typed({ text, on, cps, reduce, caret, className = '' }) {
  const t = useTyped(text, on, cps, reduce);
  return (
    <span className={`relative block ${className}`}>
      <span className="invisible">{text}</span>
      <span className="absolute inset-0">
        {t}
        {caret && t.length > 0 && t.length < text.length && (
          <span className="ml-px inline-block h-[0.85em] w-0.5 translate-y-0.5 bg-fox-500" />
        )}
      </span>
    </span>
  );
}

function useCount(to, on, reduce, { decimals = 0, duration = 1.4, delay = 0 } = {}) {
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setV(to);
      return undefined;
    }
    if (!on) return undefined;
    const c = animate(0, to, { duration, delay, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [to, on, reduce, duration, delay]);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

function Browser({ url, children }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)] ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-warm-100 bg-warm-50 px-3 py-2">
        <div className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-warm-200" />
          <span className="h-2 w-2 rounded-full bg-warm-200" />
          <span className="h-2 w-2 rounded-full bg-warm-200" />
        </div>
        <div className="mx-auto rounded bg-white px-2.5 py-0.5 font-mono text-[10px] text-warm-700 ring-1 ring-warm-100">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

/* Licensed photos for the previews live in public/images/previews and public/images (see CREDITS.md). */
function Pic({ src, w, h, pos = '50% 50%', className = '' }) {
  return (
    <img
      src={src}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      alt=""
      style={{ objectPosition: pos }}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/* Website: headline types in, tiles settle, CTA pulses once, then the page scrolls gently. */
const WEB_MARKS = [250, 1500, 2000, 2500, 3200];
const PULSE = { scale: [1, 1.1, 1] };
const WEB_TILES = [
  { src: '/images/previews/bakery-shelves.webp', w: 640, h: 640, cls: 'aspect-square' },
  { src: '/images/previews/bakery-loaves.webp', w: 640, h: 640, cls: 'aspect-square' },
  {
    src: '/images/previews/bakery-baskets.webp',
    w: 960,
    h: 240,
    cls: 'col-span-2 h-16',
    pos: '50% 60%',
  },
];

function Website({ start, live, reduce, hot }) {
  const n = useTimeline(WEB_MARKS, start, reduce);
  const t = (delay = 0) => (reduce ? { duration: 0 } : { duration: 0.45, ease: EASE, delay });
  return (
    <Browser url="mehtabakery.in">
      <motion.div
        className="px-5 pb-5 pt-4"
        animate={!reduce && live && n >= 5 ? { y: [0, -24, -24, 0] } : { y: 0 }}
        transition={
          !reduce && live && n >= 5
            ? { duration: 7, times: [0, 0.3, 0.7, 1], ease: 'easeInOut', repeat: Infinity }
            : { duration: 0.4 }
        }
      >
        <div className="flex items-center justify-between text-[11px] text-warm-800">
          <span className="font-display text-sm font-bold text-warm-900">Mehta Bakery</span>
          <span className="hidden gap-4 sm:flex">
            <span>Menu</span>
            <span>Catering</span>
            <span>Visit us</span>
          </span>
          <span className="rounded-pill bg-warm-900 px-2.5 py-1 text-[10px] font-semibold text-white">
            Order now
          </span>
        </div>
        <div className="mt-6 grid items-center gap-4 sm:grid-cols-2">
          <div>
            <Typed
              text="Baked fresh every morning in Pune."
              on={n >= 1}
              cps={34}
              reduce={reduce}
              caret
              className="font-display text-2xl font-bold leading-tight text-warm-900"
            />
            <motion.div
              animate={n >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={t()}
            >
              <p className="mt-2 text-[11px] text-warm-700">
                Cakes, breads and catering for 10 to 500 guests.
              </p>
              <div className="mt-3 flex gap-2">
                <motion.span
                  animate={n >= 3 && !reduce ? PULSE : { scale: 1 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="rounded-pill bg-fox-500 px-3 py-1.5 text-[10px] font-semibold text-white"
                >
                  See the menu
                </motion.span>
                <span className="rounded-pill px-3 py-1.5 text-[10px] font-semibold text-warm-700 ring-1 ring-warm-200">
                  Book catering
                </span>
              </div>
            </motion.div>
          </div>
          <div className="grid grid-cols-2 gap-2" aria-hidden>
            {WEB_TILES.map((c, i) => (
              <motion.div
                key={c.src}
                className={`${c.cls} overflow-hidden rounded-lg bg-warm-100`}
                animate={n >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
                transition={t(0.15 + i * 0.12)}
              >
                <Pic src={c.src} w={c.w} h={c.h} pos={c.pos} />
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div
          animate={n >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={t()}
          data-hot="SEO"
          className={`mt-5 flex items-center gap-3 rounded-lg bg-warm-50 px-3 py-2 text-[10px] text-warm-800 transition-shadow ${hot.includes('SEO') ? HOT : ''}`}
        >
          <Star size={12} className="fill-fox-500 text-fox-500" />
          Ranked #1 for “bakery near me” in Kothrud
        </motion.div>
      </motion.div>
    </Browser>
  );
}

/* Store: three products go into the cart (count and total tick up), UPI is chosen, "Paid" lands last. */
const STORE_MARKS = [500, 1000, 1500, 2400, 3300];
const STORE_ITEMS = [
  ['Cold-pressed olive oil, 500 ml', 850, '/images/previews/oil-bottles.webp'],
  ['Extra virgin olive oil, 1 L', 1450, '/images/previews/oil-wood.webp'],
  ['Olive oil gift pair', 1990, '/images/previews/oil-olives.webp'],
];

function Store({ start, reduce, hot }) {
  const n = useTimeline(STORE_MARKS, start, reduce);
  const added = Math.min(n, 3);
  const total = STORE_ITEMS.slice(0, added).reduce((s, p) => s + p[1], 0);
  const upi = n >= 4;
  const paid = n >= 5;
  const bump = reduce ? false : { scale: 1.5 };
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
      <Browser url="greenleaf.store">
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 rounded-md bg-warm-50 px-2.5 py-1.5 text-[10px] text-warm-700">
            <Search size={11} /> <span className="flex-1">Search cold-pressed oils</span>
            <span className="relative">
              <ShoppingBag size={13} className="text-warm-900" />
              {added > 0 && (
                <motion.span
                  key={added}
                  initial={bump}
                  animate={{ scale: 1 }}
                  transition={POP}
                  className="absolute -right-2 -top-2 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-fox-500 px-0.5 text-[8px] font-bold text-white"
                >
                  {added}
                </motion.span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {STORE_ITEMS.map(([name, price, img], i) => (
              <div key={name}>
                <div className="relative">
                  <motion.div
                    className="aspect-[4/5] overflow-hidden rounded-lg bg-warm-100"
                    animate={{ scale: n === i + 1 && !reduce ? 1.06 : 1 }}
                    transition={POP}
                    aria-hidden
                  >
                    <Pic src={img} w={480} h={600} />
                  </motion.div>
                  <motion.span
                    initial={false}
                    animate={i < added ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                    transition={reduce ? { duration: 0 } : POP}
                    className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-pill bg-warm-900 py-0.5 text-[9px] font-semibold text-white"
                  >
                    <Check size={9} strokeWidth={3} /> In cart
                  </motion.span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-warm-700">
                  {name}
                </p>
                <p className="text-[11px] font-semibold text-warm-900">
                  ₹{price.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Browser>
      <div className="flex flex-col rounded-xl bg-white p-3 shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)]">
        <p className="text-[11px] font-semibold text-warm-900">Checkout</p>
        <div className="mt-2 space-y-1.5 text-[10px] tabular-nums text-warm-800">
          <div className="flex justify-between">
            <span>
              {added} item{added === 1 ? '' : 's'}
            </span>
            <motion.span
              key={total}
              initial={reduce ? false : { opacity: 0.4, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              ₹{total.toLocaleString('en-IN')}
            </motion.span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>Free</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {['UPI', 'Card', 'Cash on delivery'].map((m, i) => (
            <div
              key={m}
              data-hot={i === 0 ? 'UPI' : undefined}
              className={`rounded-md px-2 py-1.5 text-[10px] transition-colors duration-300 ${
                i === 0 && upi
                  ? 'bg-fox-50 font-semibold text-warm-900 ring-1 ring-fox-300'
                  : 'text-warm-700 ring-1 ring-warm-100'
              } ${i === 0 && hot.includes('UPI') ? HOT : ''}`}
            >
              {m}
            </div>
          ))}
        </div>
        <motion.div
          initial={false}
          animate={paid ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
          transition={reduce ? { duration: 0 } : POP}
          className="mt-3 flex items-center gap-1.5 rounded-md bg-sage-50 px-2 py-1.5 text-[10px] font-semibold text-sage-700 sm:mt-auto"
        >
          <Check size={11} /> Paid via UPI
        </motion.div>
      </div>
    </div>
  );
}

/* App: phone rises in, a push notification springs down, the first class card swipes to "Join". */
const APP_MARKS = [1000, 2500, 3500];
const CLASSES = [
  ['Physics · Motion', '10:00', 'bg-fox-500'],
  ['Maths · Integrals', '12:30', 'bg-sage-500'],
  ['Chemistry lab', '15:00', 'bg-[#3e7cb1]'],
];

function App({ start, reduce, hot }) {
  const n = useTimeline(APP_MARKS, start, reduce);
  const on = reduce || start;
  const spring = reduce ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 28 };
  return (
    <div className="relative flex items-end justify-center gap-5">
      <motion.div
        initial={false}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE }}
        className="relative w-[13.5rem] rounded-[2rem] bg-warm-900 p-2 shadow-[0_30px_60px_-24px_rgba(90,30,0,0.55)]"
      >
        <div className="overflow-hidden rounded-[1.6rem] bg-warm-white">
          <div className="flex justify-between px-4 pt-2.5 text-[9px] font-semibold text-warm-800">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="px-4 pb-3 pt-3">
            <p className="text-[10px] text-warm-700">Good morning, Aarav</p>
            <p className="font-display text-base font-bold text-warm-900">Today&apos;s classes</p>
            <div className="relative mt-2.5 h-[4.5rem] overflow-hidden rounded-xl bg-warm-100">
              <Pic src="/images/home/industry-education-600.webp" w={600} h={450} pos="50% 30%" />
              <div className="absolute inset-0 bg-gradient-to-t from-warm-900/70 to-transparent" />
              <p className="absolute bottom-1.5 left-2.5 text-[10px] font-semibold text-white">
                Next up · Physics, Motion
              </p>
            </div>
            <div className="mt-2 space-y-2">
              {CLASSES.map(([t, h, c], i) => (
                <div key={t} className="relative overflow-hidden rounded-xl shadow-sm">
                  {i === 0 && (
                    <span className="absolute inset-y-0 right-0 flex w-14 items-center justify-center bg-sage-500 text-[9px] font-semibold text-white">
                      Join
                    </span>
                  )}
                  <motion.div
                    animate={{ x: i === 0 && n === 2 ? -52 : 0 }}
                    transition={spring}
                    className="relative flex items-center gap-2.5 rounded-xl bg-white p-2.5"
                  >
                    <span className={`h-7 w-1 rounded-full ${c}`} />
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold text-warm-900">{t}</p>
                      <p className="text-[9px] text-warm-700">Live · {h}</p>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-warm-900 p-2.5 text-white">
              <p className="text-[9px] text-warm-300">Weekly streak</p>
              <p className="text-sm font-bold">6 of 7 days</p>
            </div>
          </div>
          <div
            className="flex justify-around border-t border-warm-100 bg-white py-2 text-warm-600"
            aria-hidden
          >
            <Home size={14} className="text-fox-500" />
            <Search size={14} />
            <ShoppingBag size={14} />
            <User size={14} />
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={false}
        animate={
          n >= 1
            ? { opacity: 1, y: 0, scale: hot.includes('Push') ? 1.05 : 1 }
            : { opacity: 0, y: -40, scale: 0.96 }
        }
        transition={spring}
        data-hot="Push"
        className={`absolute inset-x-0 top-1 z-10 mx-auto w-56 rounded-xl bg-white/95 p-3 shadow-lg sm:static sm:mx-0 sm:mb-10 sm:w-44 ${hot.includes('Push') ? HOT : ''}`}
      >
        <div className="flex items-center gap-2 text-[10px] font-semibold text-warm-900">
          <Bell size={12} className="text-fox-500" /> Push notification
        </div>
        <p className="mt-1 text-[10px] leading-snug text-warm-800">
          Physics starts in 10 minutes. Tap to join.
        </p>
      </motion.div>
    </div>
  );
}

/* AI: the question types, dots show it thinking, the answer streams, slots pop, the booking confirms. */
const AI_MARKS = [300, 1500, 2300, 3300, 3800, 4300];
const AI_ANSWER = 'Yes, Dr. Iyer sees patients on Saturday from 10am to 1pm. Two slots are left.';

function Assistant({ start, reduce, hot }) {
  const n = useTimeline(AI_MARKS, start, reduce);
  const t = (delay = 0) => (reduce ? { duration: 0 } : { duration: 0.3, ease: EASE, delay });
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)]">
      <div className="flex items-center gap-2 bg-warm-900 px-4 py-3 text-white">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-fox-500 text-[11px] font-bold">
          HF
        </span>
        <div>
          <p className="text-[11px] font-semibold">HealthFirst assistant</p>
          <p className="text-[9px] text-warm-300">Answers from your clinic&apos;s own documents</p>
        </div>
      </div>
      <div className="space-y-2.5 bg-warm-white p-4 text-[11px]">
        <motion.div
          animate={{ opacity: n >= 1 ? 1 : 0 }}
          transition={t()}
          className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-warm-900 px-3 py-2 text-white"
        >
          <Typed text="Is Dr. Iyer available on Saturday?" on={n >= 1} cps={42} reduce={reduce} />
        </motion.div>
        <div className="relative">
          {n === 2 && (
            <span className="absolute left-0 top-0 flex items-center gap-1 rounded-lg rounded-bl-sm bg-white px-3 py-3 shadow-sm">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-warm-700"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.12 }}
                />
              ))}
            </span>
          )}
          <motion.div
            animate={{ opacity: n >= 3 ? 1 : 0 }}
            transition={t()}
            data-hot="FAQ"
            className={`w-fit max-w-[90%] rounded-lg rounded-bl-sm bg-white px-3 py-2 text-warm-800 shadow-sm ${hot.includes('FAQ') ? HOT : ''}`}
          >
            <Typed text={AI_ANSWER} on={n >= 3} cps={110} reduce={reduce} />
            <motion.div
              initial={false}
              animate={n >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
              transition={t()}
              className="mt-2 flex items-center gap-2 rounded-md bg-warm-50 p-1.5"
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-warm-100">
                <Pic
                  src="/images/portfolio/healthcare-telemedicine-600.webp"
                  w={600}
                  h={450}
                  pos="55% 25%"
                />
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-semibold text-warm-900">Dr. Iyer</span>
                <span className="block text-[9px] text-warm-700">
                  General physician · Sat 10am to 1pm
                </span>
              </span>
            </motion.div>
            <div className="mt-2 flex gap-1.5">
              {['10:40', '12:20'].map((s, i) => (
                <motion.span
                  key={s}
                  initial={false}
                  animate={n >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                  transition={reduce ? { duration: 0 } : { ...POP, delay: i * 0.1 }}
                  className="rounded-pill px-2 py-0.5 text-[10px] font-semibold text-fox-600 ring-1 ring-fox-300"
                >
                  {s}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
        <motion.p
          animate={n >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={t()}
          className="ml-auto w-fit rounded-lg rounded-br-sm bg-warm-900 px-3 py-2 text-white"
        >
          12:20 please
        </motion.p>
        <motion.p
          initial={false}
          animate={n >= 6 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
          transition={reduce ? { duration: 0 } : POP}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-sage-50 px-3 py-2 font-medium text-sage-700"
        >
          <Check size={12} /> Booked. Reminder sent on WhatsApp.
        </motion.p>
      </div>
    </div>
  );
}

/* Growth: the line draws, the area fills under it, then every number counts up. */
function Growth({ start, reduce, hot }) {
  const on = reduce || start;
  const visitors = useCount(18420, on, reduce, { duration: 1.5 });
  const pct = useCount(212, on, reduce, { duration: 1.5 });
  const kw = useCount(41, on, reduce, { duration: 1.3, delay: 0.3 });
  const enq = useCount(96, on, reduce, { duration: 1.3, delay: 0.4 });
  const conv = useCount(3.8, on, reduce, { duration: 1.3, delay: 0.5, decimals: 1 });
  const draw = reduce ? { duration: 0 } : { duration: 1.2, ease: EASE, delay: 0.15 };
  const stats = [
    ['Top-3 keywords', kw, 'Keyword'],
    ['Enquiries / month', enq, ''],
    ['Conversion', `${conv}%`, 'Conversion'],
  ];
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-5 shadow-[0_30px_60px_-24px_rgba(90,30,0,0.45)]">
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-warm-50 p-2">
        <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-warm-100">
          <Pic src="/images/previews/bakery-window.webp" w={640} h={400} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] font-semibold text-warm-900">Mehta Bakery</span>
          <span className="block truncate text-[10px] text-warm-700">Bakery · Kothrud, Pune</span>
        </span>
        <span className="shrink-0 rounded-pill bg-sage-50 px-2 py-0.5 text-[9px] font-semibold text-sage-700">
          Top 3 on Maps
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold text-warm-900">Organic visitors</p>
        <p className="text-[10px] text-warm-700">Last 6 months</p>
      </div>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-warm-900">
        {visitors} <span className="text-sm font-semibold text-sage-600">+{pct}%</span>
      </p>
      <svg viewBox="0 0 300 110" className="mt-3 w-full" aria-hidden>
        <defs>
          <linearGradient id="gr-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff4d00" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff4d00" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 50, 80].map((y) => (
          <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#edeae4" strokeWidth="1" />
        ))}
        <motion.path
          d="M0 96 L50 90 L100 84 L150 70 L200 52 L250 34 L300 14 L300 110 L0 110 Z"
          fill="url(#gr-fill)"
          initial={false}
          animate={{ opacity: on ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 1.1 }}
        />
        <motion.path
          d="M0 96 L50 90 L100 84 L150 70 L200 52 L250 34 L300 14"
          fill="none"
          stroke="#ff4d00"
          strokeWidth="2.5"
          strokeLinejoin="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={draw}
        />
        <motion.circle
          cx="300"
          cy="14"
          r="4"
          fill="#ff4d00"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={false}
          animate={on ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : { ...POP, delay: 1.3 }}
        />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-warm-100 pt-3 text-[10px]">
        {stats.map(([k, v, h]) => (
          <div
            key={k}
            data-hot={h || undefined}
            className={`rounded-md transition-shadow ${h && hot.includes(h) ? HOT : ''}`}
          >
            <p className="text-warm-700">{k}</p>
            <p className="text-sm font-bold tabular-nums text-warm-900">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEWS = { website: Website, store: Store, app: App, ai: Assistant, growth: Growth };

/** `replay` remounts the preview so its story plays again; `hot` is the feature the visitor is pointing at. */
export function BuildPreview({ kind, replay = 0, hot = '', reduce = false }) {
  const Preview = PREVIEWS[kind] || Website;
  const ref = useRef(null);
  const live = useInView(ref, { amount: 0.3 });
  // Latch: the story starts the first time it is on screen, ambient loops follow `live`.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (live) setSeen(true);
  }, [live]);
  return (
    <div ref={ref} aria-hidden>
      <Preview key={replay} start={seen} live={live} reduce={reduce} hot={hot} />
    </div>
  );
}

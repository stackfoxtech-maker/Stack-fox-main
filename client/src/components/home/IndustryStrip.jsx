import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGroup, animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import { Reveal } from '@components/Reveal';
import Photo from '@components/Photo';

/* Mirrors shared/stackfox-data.json → industryBundles (first 3 features).
   Hardcoded so the homepage doesn't pull the full catalogue JSON. */
const BUNDLES = [
  {
    id: 'healthcare',
    name: 'Healthcare & Clinics',
    description:
      'HIPAA-aware patient portal, appointment booking, and telemedicine-ready platform.',
    price: 180000,
    features: [
      'Patient portal with appointment booking',
      'Telemedicine video integration ready',
      'Prescription & report upload',
    ],
  },
  {
    id: 'realestate',
    name: 'Real Estate & Property',
    description:
      'Property listing portal with virtual tours, lead management, and agent dashboard.',
    price: 160000,
    features: [
      'Property listing with filters & map view',
      'Virtual tour integration',
      'Lead capture & CRM',
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Business',
    description:
      'Full-featured online store with inventory, shipping, reviews, and marketing automation.',
    price: 200000,
    features: [
      'Custom storefront with advanced filters',
      'Multi-payment gateway (UPI, cards, wallets)',
      'Inventory & warehouse management',
    ],
  },
  {
    id: 'education',
    name: 'Education & EdTech',
    description:
      'Learning management system with courses, quizzes, certificates, and student dashboard.',
    price: 190000,
    features: [
      'Course catalog with video streaming',
      'Quiz & assessment engine',
      'Certificate generation',
    ],
  },
  {
    id: 'food',
    name: 'Food & Restaurant',
    description: 'Online ordering, table reservation, delivery tracking, and kitchen management.',
    price: 140000,
    features: [
      'Online menu with ordering',
      'Table reservation system',
      'Real-time delivery tracking',
    ],
  },
  {
    id: 'events',
    name: 'Events & Ticketing',
    description:
      'Event listing, online ticketing, seat selection, and attendee management platform.',
    price: 170000,
    features: [
      'Event listing with calendar view',
      'Online ticket booking & seat selection',
      'QR code check-in',
    ],
  },
];

const inr = new Intl.NumberFormat('en-IN');

/* Shared white "screen" surface inside each vignette tile. */
const surface = 'rounded-sm bg-white ring-1 ring-warm-900/[0.06] shadow-sm';

const EASE = [0.2, 0.7, 0.2, 1]; // DESIGN.md "enter"
const SPRING = { type: 'spring', stiffness: 420, damping: 32 }; // settles, doesn't bounce
const MOVE = { duration: 0.36, ease: 'easeInOut' };

/* mode: 'idle' (not yet seen) · 'play' (run the sequence) · 'final' (reduced motion).
   Each replay remounts the vignette via `key`, so state restarts from frame 0. */
function usePhase(mode, times) {
  const [phase, setPhase] = useState(mode === 'final' ? times.length : 0);
  useEffect(() => {
    if (mode !== 'play') return undefined;
    const ids = times.map((t, i) => setTimeout(() => setPhase(i + 1), t));
    return () => ids.forEach(clearTimeout);
  }, [mode, times]);
  return phase;
}

function useCount(mode, from, to, duration = 1.2, delay = 0) {
  const [v, setV] = useState(mode === 'final' ? to : from);
  useEffect(() => {
    if (mode !== 'play') return undefined;
    const c = animate(from, to, { duration, delay, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [mode, from, to, duration, delay]);
  return v;
}

/* Status chip that pops in (scale + fade) when it mounts. Static under reduced motion. */
function Chip({ mode, className, children }) {
  return (
    <motion.span
      initial={mode === 'play' ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING}
      className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${className}`}
    >
      {children}
    </motion.span>
  );
}

function DoneChip({ mode, children }) {
  return (
    <Chip mode={mode} className="bg-sage-50 text-sage-700">
      <Check className="h-2.5 w-2.5" aria-hidden /> {children}
    </Chip>
  );
}

const HC_TIMES = [500, 1100];
function Healthcare({ mode }) {
  const slots = ['9:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
  const phase = usePhase(mode, HC_TIMES);
  const selected = phase >= 1 ? 2 : 0;
  return (
    <div className={`${surface} w-full max-w-[220px] p-3`}>
      <div className="flex h-[18px] items-center justify-between text-[11px]">
        <span className="font-medium text-warm-900">Dr. Mehta · Tue 14</span>
        {phase >= 2 ? (
          <DoneChip mode={mode}>Booked</DoneChip>
        ) : (
          <span className="text-warm-700">6 slots</span>
        )}
      </div>
      <LayoutGroup>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {slots.map((s, i) => (
            <span
              key={s}
              className={`relative rounded-[6px] bg-warm-50 py-1 text-center text-[10px] tabular-nums ${
                i === 4 ? 'text-warm-600 line-through' : 'text-warm-700'
              }`}
            >
              {i === selected && (
                <motion.span
                  layoutId="hc-slot"
                  transition={MOVE}
                  className="absolute inset-0 rounded-[6px] bg-warm-900"
                />
              )}
              <span
                className={`relative transition-colors duration-200 ${
                  i === selected ? 'text-white' : ''
                }`}
              >
                {s}
              </span>
            </span>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

function RealEstate({ mode }) {
  const play = mode === 'play';
  const price = useCount(mode, 1.0, 1.2, 1.4, 0.3);
  return (
    <div className={`${surface} w-full max-w-[220px] overflow-hidden`}>
      <div className="relative h-14 overflow-hidden">
        {/* Ken Burns: slow drift + slight push-in on the hatched "photo". */}
        <motion.div
          className="absolute -inset-4 bg-[repeating-linear-gradient(45deg,theme(colors.warm.50)_0_6px,theme(colors.warm.100)_6px_12px)]"
          initial={false}
          animate={mode === 'idle' ? { x: 0, scale: 1 } : { x: -12, scale: 1.08 }}
          transition={{ duration: play ? 6 : 0, ease: 'easeOut' }}
        />
        <motion.span
          initial={play ? { opacity: 0, y: -8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.5 }}
          className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-white px-1.5 py-0.5 text-[10px] text-warm-700 ring-1 ring-warm-900/[0.06]"
        >
          <MapPin className="h-2.5 w-2.5" aria-hidden /> Baner, Pune
        </motion.span>
      </div>
      <div className="flex items-end justify-between p-2.5">
        <div>
          <p className="text-[11px] font-medium text-warm-900">3 BHK · 1,450 sq ft</p>
          <p className="text-[10px] text-warm-700">EMI from ₹68,400/mo</p>
        </div>
        <span className="font-display text-[12px] font-bold tabular-nums text-warm-900">
          ₹{price.toFixed(1)} Cr
        </span>
      </div>
    </div>
  );
}

const EC_TIMES = [1300];
function Ecommerce({ mode }) {
  const paid = usePhase(mode, EC_TIMES) >= 1;
  return (
    <div className={`${surface} w-full max-w-[220px] p-2.5`}>
      <div className="flex items-center gap-2.5">
        <span className="h-9 w-9 shrink-0 rounded-[6px] bg-warm-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-warm-900">Cotton kurta · M</p>
          <p className="text-[10px] text-warm-700">Qty 2 · Ships via Delhivery</p>
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-warm-900">₹1,798</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-warm-100 pt-2">
        <span className="text-[10px] text-warm-700">Order #4821</span>
        {paid ? (
          <DoneChip mode={mode}>Paid via UPI</DoneChip>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-warm-50 px-1.5 py-0.5 text-[10px] text-warm-800">
            Paying…
            <span className="h-[3px] w-8 overflow-hidden rounded-pill bg-warm-200">
              <motion.span
                className="block h-full rounded-pill bg-warm-700"
                initial={{ width: '0%' }}
                animate={{ width: mode === 'play' ? '100%' : '0%' }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function Education({ mode }) {
  const pct = useCount(mode, 0, 68, 1.3, 0.2);
  return (
    <div className={`${surface} w-full max-w-[220px] p-3`}>
      <p className="text-[11px] font-medium text-warm-900">Intro to Data Science</p>
      <p className="text-[10px] text-warm-700">Module 4 of 6 · Quiz next</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-warm-100">
        <div className="h-full rounded-pill bg-sage-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-warm-700">
        <span>{Math.round(pct)}% complete</span>
        <span>Certificate at 100%</span>
      </div>
    </div>
  );
}

const FOOD_TIMES = [700, 1500];
function Food({ mode }) {
  const steps = ['Placed', 'Preparing', 'Out for delivery'];
  const current = usePhase(mode, FOOD_TIMES);
  const eta = useCount(mode, 26, 22, 1.6, 0.2);
  return (
    <div className={`${surface} w-full max-w-[220px] p-3`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-warm-900">Order #218</span>
        <span className="tabular-nums text-warm-700">ETA {Math.round(eta)} min</span>
      </div>
      <LayoutGroup>
        <ol className="mt-2.5 flex items-center">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <span
                className={`relative h-2 w-2 shrink-0 rounded-full transition-colors duration-300 ${
                  i <= current ? 'bg-warm-900' : 'bg-warm-200'
                }`}
              >
                {i === current && (
                  <motion.span
                    layoutId="food-dot"
                    transition={MOVE}
                    className="absolute -inset-1 rounded-full bg-warm-900/10"
                  />
                )}
              </span>
              {i < steps.length - 1 && (
                <span className="relative mx-1 h-px flex-1 bg-warm-200">
                  <span
                    className={`absolute inset-y-0 left-0 bg-warm-900 transition-[width] duration-500 ease-in-out motion-reduce:transition-none ${
                      i < current ? 'w-full' : 'w-0'
                    }`}
                  />
                </span>
              )}
            </li>
          ))}
        </ol>
      </LayoutGroup>
      <div className="mt-1.5 flex justify-between text-[10px]">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`transition-colors duration-300 ${
              i === current ? 'font-medium text-warm-900' : 'text-warm-700'
            }`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Deterministic QR-ish pattern — finder squares in 3 corners, fixed noise elsewhere. */
const QR = Array.from({ length: 49 }, (_, i) => {
  const r = Math.floor(i / 7);
  const c = i % 7;
  const finder = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2);
  return finder || (r * 3 + c * 5) % 4 === 0;
});

const EV_TIMES = [1250];
function Events({ mode }) {
  const checked = usePhase(mode, EV_TIMES) >= 1;
  return (
    <div className={`${surface} flex w-full max-w-[220px] items-stretch`}>
      <div className="flex-1 p-2.5">
        <p className="text-[10px] uppercase tracking-wide text-warm-700">Sat 22 Nov · 7 PM</p>
        <p className="mt-0.5 text-[11px] font-medium text-warm-900">Indie Night Live</p>
        <p className="mt-1.5 text-[10px] tabular-nums text-warm-800">Row F · Seat 12</p>
        <div className="mt-1 h-[18px]">
          {checked && <DoneChip mode={mode}>Checked in</DoneChip>}
        </div>
      </div>
      <div className="flex items-center border-l border-dashed border-warm-200 p-2.5">
        <div className="relative">
          <div className="grid grid-cols-7 gap-px" aria-hidden>
            {QR.map((on, i) => (
              <span
                key={i}
                className={`h-[5px] w-[5px] ${on ? 'bg-warm-900' : 'bg-transparent'}`}
              />
            ))}
          </div>
          {mode === 'play' && !checked && (
            <motion.span
              className="absolute -inset-x-1 h-px bg-fox-500"
              initial={{ top: '0%', opacity: 0 }}
              animate={{ top: '100%', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const VIGNETTES = {
  healthcare: Healthcare,
  realestate: RealEstate,
  ecommerce: Ecommerce,
  education: Education,
  food: Food,
  events: Events,
};

function IndustryCard({ bundle: b }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  const [replays, setReplays] = useState(0);
  const Vignette = VIGNETTES[b.id];
  const mode = reduce ? 'final' : seen ? 'play' : 'idle';
  const replay = () => {
    if (mode === 'play') setReplays((n) => n + 1);
  };
  return (
    <Reveal.Item
      as={Link}
      to="/industries"
      onMouseEnter={replay}
      onFocus={replay}
      className="group relative flex flex-col overflow-hidden rounded-md border border-warm-200 bg-white p-3 transition-colors duration-200 hover:border-warm-400 focus-visible:border-warm-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 focus-visible:ring-offset-2"
    >
      {/* 1px fox top edge on hover/focus. */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-fox-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
      {/* Industry photo with the live UI vignette floating over it. */}
      <div
        ref={ref}
        className="relative aspect-[4/3] overflow-hidden rounded-sm bg-warm-100"
        aria-hidden
      >
        <Photo
          base={`/images/home/industry-${b.id}`}
          widths={[600, 900]}
          width={900}
          height={675}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-warm-900/45 via-warm-900/5 to-transparent" />
        <div className="absolute bottom-3 left-3 w-[min(220px,calc(100%-1.5rem))] rounded-[10px] bg-warm-white/95 p-2.5 shadow-lg ring-1 ring-black/5 backdrop-blur transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          <Vignette key={replays} mode={mode} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-1 pt-4">
        <h3 className="font-display text-title text-warm-900">{b.name}</h3>
        <p className="mt-1 text-body-sm text-warm-800">{b.description}</p>
        <ul className="mb-5 mt-3 space-y-1.5">
          {b.features.map((f) => (
            <li key={f} className="flex gap-2 text-body-sm text-warm-700">
              <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-sage-600" aria-hidden />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-warm-100 pt-4">
          <div>
            <p className="text-caption text-warm-700">from</p>
            <p className="font-display text-title font-bold tabular-nums text-warm-900">
              ₹{inr.format(b.price)}
              <span className="ml-1 align-middle text-caption font-normal text-warm-700">
                + GST
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-body-sm font-medium text-warm-900">
            See the bundle
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Reveal.Item>
  );
}

export function IndustryStrip() {
  return (
    <Reveal stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {BUNDLES.map((b) => (
        <IndustryCard key={b.id} bundle={b} />
      ))}
    </Reveal>
  );
}

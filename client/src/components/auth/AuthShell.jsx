import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  FileText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BrandLogo, Wordmark } from '@components/ui/BrandLogo';
import { Button } from '@components/ui/Primitives';
import { fadeUp, stagger } from '@components/motion';

const ease = [0.2, 0.7, 0.2, 1];

/* ── Floating cards ─────────────────────────────────────────── */

// Outer element takes the mouse-parallax offset, inner one drifts on its own,
// so the two transforms never fight. Decorative only (aria-hidden).
function Float({ px, className, delay = 0, drift = 8, children }) {
  return (
    <motion.div aria-hidden="true" style={{ x: px }} className={`absolute ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: [0, -drift, 0], scale: 1 }}
        transition={{
          opacity: { duration: 0.6, delay: 0.7 + delay },
          scale: { duration: 0.6, delay: 0.7 + delay, ease },
          y: { duration: 6 + delay * 2, delay: 0.7 + delay, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="rounded-2xl border border-white/60 bg-white/85 p-4 shadow-modal backdrop-blur-md"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const NOTIFS = [
  { icon: CheckCircle2, tone: 'text-success-500', title: 'Milestone 2 approved', sub: 'Just now' },
  { icon: FileText, tone: 'text-info-500', title: 'Wireframes v3 uploaded', sub: '4 min ago' },
  { icon: ReceiptText, tone: 'text-fox-500', title: 'Invoice #1042 paid', sub: 'Yesterday' },
];
const RING = 2 * Math.PI * 23;

function LoginCards({ px }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % NOTIFS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const n = NOTIFS[i];
  return (
    <>
      <Float px={px} className="left-0 top-4 w-64">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-warm-400">
          <Bell size={12} /> Latest activity
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.28, ease }}
            className="flex items-center gap-3"
          >
            <n.icon size={22} className={n.tone} />
            <div>
              <p className="text-sm font-semibold text-warm-900">{n.title}</p>
              <p className="text-xs text-warm-400">{n.sub}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </Float>

      <Float px={px} className="right-0 top-28 hidden xl:block" delay={0.5} drift={10}>
        <div className="flex items-center gap-4">
          <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
            <circle
              cx="28"
              cy="28"
              r="23"
              fill="none"
              strokeWidth="6"
              className="stroke-warm-100"
            />
            <motion.circle
              cx="28"
              cy="28"
              r="23"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-fox-500"
              strokeDasharray={RING}
              initial={{ strokeDashoffset: RING }}
              animate={{ strokeDashoffset: RING * 0.28 }}
              transition={{ duration: 1.6, delay: 1.2, ease }}
            />
          </svg>
          <div>
            <p className="font-display text-2xl font-semibold text-warm-900">72%</p>
            <p className="text-xs text-warm-400">Project complete</p>
          </div>
        </div>
      </Float>
    </>
  );
}

const STEPS = ['Describe your idea', 'Get a clear quote', 'Track every milestone'];

function SignupCards({ px }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    // tick steps one by one, hold a beat, then restart
    const t = setInterval(() => setDone((d) => (d >= STEPS.length + 1 ? 0 : d + 1)), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <Float px={px} className="left-0 top-4 w-64">
        <p className="mb-3 text-xs font-medium text-warm-400">Your kickoff plan</p>
        <ul className="space-y-2.5">
          {STEPS.map((s, idx) => {
            const on = done > idx;
            return (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span className="relative h-5 w-5">
                  <Circle size={20} className="absolute inset-0 text-warm-300" />
                  <AnimatePresence>
                    {on && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-success-500 text-white"
                      >
                        <CheckCircle2 size={20} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span
                  className={`transition-colors duration-300 ${on ? 'text-warm-900' : 'text-warm-400'}`}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ul>
      </Float>

      <Float px={px} className="right-0 top-32 hidden xl:block" delay={0.5} drift={10}>
        <p className="flex items-center gap-2 text-sm font-semibold text-warm-900">
          <Sparkles size={16} className="text-fox-500" /> No card needed
        </p>
        <p className="mt-0.5 text-xs text-warm-400">Sign up with email or Google</p>
      </Float>
    </>
  );
}

// Each auth page gets its own photo, headline, perks and floating cards.
const VARIANTS = {
  login: {
    image: '/img/founder-desk.webp',
    position: '60% 30%',
    words: [{ w: 'Good' }, { w: 'to' }, { w: 'see' }, { w: 'you' }, { w: 'again.', hi: true }],
    perks: [
      { icon: CheckCircle2, text: 'Pick up exactly where you left off' },
      { icon: ShieldCheck, text: 'Your files and contracts stay private' },
    ],
    Cards: LoginCards,
  },
  signup: {
    image: '/img/home-blocks.webp',
    position: '75% 50%',
    words: [{ w: 'Your' }, { w: 'build,' }, { w: 'block' }, { w: 'by' }, { w: 'block.', hi: true }],
    perks: [
      { icon: Sparkles, text: 'Scope, price and track a build in one place' },
      { icon: CheckCircle2, text: 'Approve each milestone before the next payment' },
    ],
    Cards: SignupCards,
  },
};

/* ── Brand panel ────────────────────────────────────────────── */

function BrandPanel({ variant }) {
  const v = VARIANTS[variant];
  const mx = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const imgX = useTransform(sx, (n) => n * -28);
  const cardX = useTransform(sx, (n) => n * 36);

  return (
    <aside
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
      }}
      onMouseLeave={() => mx.set(0)}
      className="relative hidden overflow-hidden bg-warm-900 lg:block lg:w-[46%] xl:w-1/2"
    >
      {/* photo: slow Ken Burns zoom + mouse parallax */}
      <motion.div style={{ x: imgX }} className="absolute -inset-8">
        <motion.img
          src={v.image}
          alt=""
          initial={{ opacity: 0, scale: 1.18 }}
          animate={{ opacity: 1, scale: [1.08, 1.16, 1.08] }}
          transition={{
            opacity: { duration: 0.9 },
            scale: { duration: 24, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="h-full w-full object-cover"
          style={{ objectPosition: v.position }}
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-warm-900 via-warm-900/60 to-warm-900/5" />
      <motion.div
        aria-hidden="true"
        className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-fox-500/25 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-2xl bg-white/90 py-1.5 pl-1.5 pr-4 shadow-md backdrop-blur"
          >
            <BrandLogo size={24} withBackground />
            <Wordmark className="text-lg" />
          </Link>
        </motion.div>

        <div className="relative mt-6 flex-1">
          <v.Cards px={cardX} />
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-display-xl text-white xl:text-display-2xl">
            {v.words.map(({ w, hi }, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, delay: 0.25 + i * 0.09, ease }}
                className={`mr-[0.28em] inline-block ${hi ? 'text-fox-400' : ''}`}
              >
                {w}
              </motion.span>
            ))}
          </h2>
          <motion.ul variants={stagger} initial="hidden" animate="show" className="mt-6 space-y-3">
            {v.perks.map(({ icon: Icon, text }) => (
              <motion.li
                key={text}
                variants={fadeUp}
                className="flex items-center gap-3 text-body-md text-warm-200"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fox-500/20 text-fox-300">
                  <Icon size={16} />
                </span>
                {text}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </div>
    </aside>
  );
}

/* ── Frame + form helpers ───────────────────────────────────── */

/**
 * Split-screen frame for the auth pages. `variant` picks the brand panel
 * (photo, headline, floating cards); wrap form pieces in <Item> to stagger them.
 */
export default function AuthShell({ variant = 'login', title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-warm-white">
      <BrandPanel variant={variant} />
      <main className="relative flex flex-1 flex-col lg:items-center lg:justify-center lg:px-10 lg:py-16">
        <Link
          to="/"
          className="absolute left-10 top-5 hidden items-center gap-1.5 text-sm text-warm-500 transition hover:text-warm-900 lg:inline-flex"
        >
          <ArrowLeft size={15} /> Home
        </Link>

        {/* Phones and tablets: a full-bleed photo header with the brand and headline; the
            form then rises over its bottom edge as a sheet, like a native sign-in screen. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative h-[15.5rem] shrink-0 overflow-hidden bg-warm-900 sm:h-[18rem] lg:hidden"
        >
          <motion.img
            src={VARIANTS[variant].image}
            alt=""
            initial={{ scale: 1.18 }}
            animate={{ scale: 1.04 }}
            transition={{ duration: 6, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: VARIANTS[variant].position }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-warm-900 via-warm-900/45 to-warm-900/10" />
          <Link
            to="/"
            className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-2xl bg-white/90 py-1 pl-1 pr-3.5 shadow-md backdrop-blur"
          >
            <BrandLogo size={20} withBackground />
            <Wordmark className="text-[15px]" />
          </Link>
          <p className="absolute inset-x-5 bottom-12 font-display text-[1.7rem] font-semibold leading-tight text-white sm:text-3xl">
            {VARIANTS[variant].words.map(({ w, hi }, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + i * 0.07, ease }}
                className={`mr-[0.25em] inline-block ${hi ? 'text-fox-400' : ''}`}
              >
                {w}
              </motion.span>
            ))}
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 -mt-8 w-full flex-1 rounded-t-[2rem] bg-warm-white px-5 pb-12 pt-8 shadow-[0_-14px_36px_-18px_rgba(26,25,24,0.45)] sm:mx-auto sm:max-w-[30rem] sm:px-8 lg:mt-0 lg:max-w-[26rem] lg:flex-none lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
        >
          <motion.div variants={fadeUp} className="mb-6 lg:mb-8">
            <h1 className="font-display text-display-lg text-warm-900">{title}</h1>
            <p className="mt-2 text-body-md text-warm-500">{subtitle}</p>
          </motion.div>
          {children}
          {footer && (
            <motion.p variants={fadeUp} className="mt-8 text-center text-sm text-warm-500">
              {footer}
            </motion.p>
          )}
        </motion.div>
      </main>
    </div>
  );
}

export function Item({ children, className }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

export function OrDivider() {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-warm-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-warm-white px-3 text-xs uppercase tracking-wide text-warm-400">or</span>
      </div>
    </div>
  );
}

/** Primary submit: arrow nudges on hover, light sweep, press feedback. */
export function SubmitButton({ children, isLoading }) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      isLoading={isLoading}
      className="group relative w-full overflow-hidden active:scale-[0.98]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 -skew-x-12 bg-white/25 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100"
      />
      {children}
      <ArrowRight
        size={18}
        className="transition-transform duration-200 group-hover:translate-x-1"
      />
    </Button>
  );
}

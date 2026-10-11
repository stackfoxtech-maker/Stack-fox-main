import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { Check, CheckCircle2, FileSignature, IndianRupee, ListChecks, Rocket } from 'lucide-react';
import { Reveal } from '@components/Reveal';
import { CountOnView, useSeen } from './HomeMotion';

const EASE = [0.2, 0.7, 0.2, 1];

const MILESTONES = [
  { name: 'Design approved', pct: 100 },
  { name: 'Build & integrate', pct: 100 },
  { name: 'Review & QA', pct: 64 },
  { name: 'Launch', pct: 0 },
];

/** Milestone bars fill in one after another when the tile scrolls into view. */
function MilestoneDemo() {
  const ref = useRef(null);
  const seen = useSeen(ref, 0.4);
  const reduce = useReducedMotion();
  return (
    <ul ref={ref} className="space-y-3">
      {MILESTONES.map((m, i) => {
        const done = m.pct === 100;
        return (
          <li key={m.name}>
            <div className="mb-1 flex items-center justify-between text-caption">
              <span className="flex items-center gap-1.5 font-medium text-warm-800">
                {done ? (
                  <motion.span
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: seen || reduce ? 1 : 0 }}
                    transition={{
                      delay: 0.5 + i * 0.35,
                      type: 'spring',
                      stiffness: 380,
                      damping: 16,
                    }}
                    className="grid h-4 w-4 place-items-center rounded-full bg-sage-500 text-white"
                  >
                    <Check size={10} strokeWidth={3} />
                  </motion.span>
                ) : (
                  <span className="h-4 w-4 rounded-full border border-warm-300" />
                )}
                {m.name}
              </span>
              <span className="tabular-nums text-warm-600">{m.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-warm-100">
              <motion.div
                className={`h-full rounded-pill ${done ? 'bg-sage-500' : 'bg-fox-500'}`}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: seen || reduce ? `${m.pct}%` : 0 }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.35, ease: EASE }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const EVENTS = [
  { icon: CheckCircle2, text: 'Design approved by Neha', meta: '2m' },
  { icon: IndianRupee, text: 'Invoice INV-0142 paid · ₹28,320 · UPI', meta: '18m' },
  { icon: Rocket, text: 'Staging build deployed · v0.8', meta: '1h' },
  { icon: ListChecks, text: 'QA: 12 of 19 checks passed', meta: '3h' },
  { icon: FileSignature, text: 'Contract countersigned', meta: '1d' },
];
const VISIBLE = 4;

/** Activity feed: every ~2.2s the next event slides in on top and the oldest leaves.
 *  Paused while off-screen; static for reduced motion. */
function ActivityFeed({ inView }) {
  const reduce = useReducedMotion();
  const [head, setHead] = useState(0);
  useEffect(() => {
    if (reduce || !inView) return undefined;
    const t = setInterval(() => setHead((h) => h + 1), 2200);
    return () => clearInterval(t);
  }, [reduce, inView]);

  // `head` keeps climbing so each arriving row gets a fresh key and animates in.
  const rows = Array.from({ length: VISIBLE }, (_, i) => {
    const n = head - i;
    return { key: n, ...EVENTS[((n % EVENTS.length) + EVENTS.length) % EVENTS.length] };
  });

  return (
    <ul className="relative space-y-1 overflow-hidden" aria-live="off">
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map(({ key, icon: Icon, text, meta }) => (
          <motion.li
            key={key}
            layout={!reduce}
            initial={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.25 } }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-3 rounded-md py-1.5 text-body-sm"
          >
            <Icon size={15} strokeWidth={1.75} className="shrink-0 text-warm-600" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-warm-800">{text}</span>
            <span className="shrink-0 tabular-nums text-caption text-warm-600">{meta}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

const TABS = ['Milestones', 'Files', 'Invoices'];

function Dashboard() {
  const panelRef = useRef(null);
  const inView = useInView(panelRef, { amount: 0.2 });
  const reduce = useReducedMotion();
  return (
    <div
      ref={panelRef}
      className="rounded-lg bg-white p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] md:p-8"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-body-sm text-warm-700">
          Client dashboard · <span className="font-medium text-warm-900">D2C storefront</span>
        </p>
        <div className="flex items-center gap-3 text-caption">
          <span className="flex items-center gap-1.5 text-sage-700">
            <span className="relative grid h-2 w-2 place-items-center">
              {!reduce && (
                <motion.span
                  className="absolute h-2 w-2 rounded-full bg-sage-500"
                  animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="h-2 w-2 rounded-full bg-sage-500" />
            </span>
            Live
          </span>
          <span className="tabular-nums text-warm-700">Week 4 of 6</span>
        </div>
      </div>

      <div className="mb-6 flex gap-5 border-b border-warm-100 text-body-sm" aria-hidden>
        {TABS.map((t, i) => (
          <span
            key={t}
            className={`relative pb-2.5 ${i === 0 ? 'font-medium text-warm-900' : 'text-warm-600'}`}
          >
            {t}
            {i === 0 && (
              <motion.span
                className="absolute inset-x-0 -bottom-px h-0.5 origin-left rounded-pill bg-warm-900"
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: inView || reduce ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              />
            )}
          </span>
        ))}
      </div>

      <MilestoneDemo />

      <div className="mt-7 border-t border-warm-100 pt-5">
        <p className="mb-2 text-caption font-medium uppercase tracking-wide text-warm-700">
          Activity
        </p>
        <ActivityFeed inView={inView} />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-warm-100 pt-5">
        {[
          ['Paid so far', <CountOnView key="p" end={56640} prefix="₹" />],
          ['On schedule', <CountOnView key="s" end={100} suffix="%" />],
          ['Files shared', <CountOnView key="f" end={18} />],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-caption text-warm-700">{k}</dt>
            <dd className="mt-0.5 font-display text-title tabular-nums text-warm-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const POINTS = [
  {
    title: 'A clear view of progress',
    body: 'Follow milestones, review deliverables and keep conversations in one place.',
  },
  {
    title: 'A real person within a working day',
    body: 'Ask, change scope, add a piece. The plan and the price update with the answer.',
  },
  {
    title: 'Payments tied to progress',
    body: 'Itemised GST invoices, paid milestone by milestone.',
  },
  {
    title: 'A proper handover',
    body: 'Files, signed agreements and project details stay in your workspace.',
  },
  { title: 'You own it', body: 'The code and IP are yours. NDA on request.' },
];

/** A live dashboard view beside the list of what is handled after you sign. Sits on a dark band. */
export function Bento() {
  const stageRef = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start end', 'center center'],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

  return (
    <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-12 lg:gap-16">
      <div ref={stageRef} className="relative lg:col-span-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[8%] bottom-[-6%] top-[30%] rounded-[50%] bg-fox-500/20 blur-3xl"
        />
        <motion.div
          className="relative"
          style={reduce ? undefined : { rotateX, scale, transformPerspective: 1200 }}
        >
          <Dashboard />
        </motion.div>
      </div>

      <Reveal as="dl" stagger className="border-t border-white/10 lg:col-span-5">
        {POINTS.map((p) => (
          <Reveal.Item key={p.title} className="border-b border-white/10 py-5">
            <dt className="font-medium text-white">{p.title}</dt>
            <dd className="mt-1 text-body-sm text-warm-200">{p.body}</dd>
          </Reveal.Item>
        ))}
      </Reveal>
    </div>
  );
}

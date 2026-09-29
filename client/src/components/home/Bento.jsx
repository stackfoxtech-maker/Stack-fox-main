import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, FileText, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
import { Reveal } from '@components/Reveal';
import { CountOnView, SpotlightGlow, spotlightProps, useSeen } from './HomeMotion';

const EASE = [0.2, 0.7, 0.2, 1];

function Tile({ className = '', icon: Icon, title, body, children }) {
  return (
    <Reveal.Item
      {...spotlightProps}
      className={`group relative overflow-hidden rounded-2xl border border-warm-200 bg-white p-5 shadow-sm md:rounded-lg md:p-6 transition-shadow duration-medium hover:shadow-md ${className}`}
    >
      <SpotlightGlow />
      <div className="relative">
        <span className="mb-4 grid h-9 w-9 place-items-center rounded-sm bg-fox-50 text-fox-600">
          <Icon size={17} />
        </span>
        <h3 className="text-title text-warm-900">{title}</h3>
        <p className="mt-1.5 max-w-sm text-body-sm text-warm-600">{body}</p>
        <div className="mt-6">{children}</div>
      </div>
    </Reveal.Item>
  );
}

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
                    initial={{ scale: 0 }}
                    animate={{ scale: seen ? 1 : 0 }}
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
              <span className="tabular-nums text-warm-400">{m.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-warm-100">
              <motion.div
                className={`h-full rounded-pill ${done ? 'bg-sage-500' : 'bg-fox-500'}`}
                initial={{ width: 0 }}
                animate={{ width: seen ? `${m.pct}%` : 0 }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.35, ease: EASE }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A short conversation that plays out: question, typing dots, answer. */
function ChatDemo() {
  const ref = useRef(null);
  const seen = useSeen(ref, 0.4);
  const bubble = (delay) => ({
    initial: { opacity: 0, y: 8, scale: 0.96 },
    animate: seen ? { opacity: 1, y: 0, scale: 1 } : {},
    transition: { delay, duration: 0.35, ease: EASE },
  });
  return (
    <div ref={ref} className="space-y-2.5 text-body-sm">
      <motion.div
        {...bubble(0.3)}
        className="ml-auto w-fit max-w-[85%] rounded-md rounded-br-sm bg-warm-900 px-3.5 py-2 text-white"
      >
        Can we add UPI autopay to the plan?
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={seen ? { opacity: [0, 1, 1, 0] } : {}}
        transition={{ delay: 1.0, duration: 1.1, times: [0, 0.15, 0.85, 1] }}
        className="flex w-fit gap-1 rounded-md bg-warm-50 px-3.5 py-3"
        aria-hidden
      >
        {[0, 1, 2].map((d) => (
          <motion.span
            key={d}
            className="h-1.5 w-1.5 rounded-full bg-warm-400"
            animate={seen ? { y: [0, -4, 0] } : {}}
            transition={{ delay: 1.0 + d * 0.12, duration: 0.5, repeat: 1 }}
          />
        ))}
      </motion.div>
      <motion.div
        {...bubble(2.2)}
        className="w-fit max-w-[90%] rounded-md rounded-bl-sm bg-sage-50 px-3.5 py-2 text-sage-800"
      >
        Yes — adds ₹12,000 and about 3 days. Updated your plan.
      </motion.div>
    </div>
  );
}

/** A tiny GST invoice whose total ticks up when seen. */
function InvoiceDemo() {
  return (
    <div className="rounded-sm border border-dashed border-warm-300 bg-warm-white p-3 font-mono text-[11px] text-warm-600">
      <div className="flex justify-between">
        <span>Build · 5 pages</span>
        <span>₹35,000</span>
      </div>
      <div className="flex justify-between">
        <span>GST 18%</span>
        <span>₹6,300</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-warm-300 pt-2 text-[13px] font-bold text-warm-900">
        <span>Total</span>
        <span className="text-fox-600">
          <CountOnView end={41300} prefix="₹" />
        </span>
      </div>
    </div>
  );
}

/** Ring that sweeps to 60% — the "pay as milestones land" idea. */
function RingDemo() {
  const ref = useRef(null);
  const seen = useSeen(ref, 0.5);
  return (
    <div ref={ref} className="flex items-center gap-4">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-warm-100" />
        <motion.circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-fox-500"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: seen ? 0.6 : 0 }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      </svg>
      <div className="text-body-sm leading-snug text-warm-600">
        <span className="block font-display text-2xl font-semibold text-warm-900">
          <CountOnView end={60} suffix="%" />
        </span>
        released so far
      </div>
    </div>
  );
}

/** Shield that draws itself, then its tick. */
function ShieldDemo() {
  const ref = useRef(null);
  const seen = useSeen(ref, 0.5);
  return (
    <div ref={ref} className="flex items-center gap-4">
      <svg viewBox="0 0 48 56" className="h-16 w-14 text-sage-600" aria-hidden>
        <motion.path
          d="M24 3 L43 10 V27 C43 39 35 49 24 53 C13 49 5 39 5 27 V10 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: seen ? 1 : 0 }}
          transition={{ duration: 1, ease: EASE }}
        />
        <motion.path
          d="M15 28 L22 35 L34 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: seen ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.9, ease: EASE }}
        />
      </svg>
      <p className="text-body-sm leading-snug text-warm-600">
        You own the code and IP. NDA on request.
      </p>
    </div>
  );
}

export function Bento() {
  return (
    <Reveal stagger className="mt-8 grid gap-3.5 md:mt-12 md:gap-4 lg:grid-cols-6">
      <Tile
        className="lg:col-span-3"
        icon={Check}
        title="Delivery you can watch"
        body="Every project is split into milestones. You see each one move from build to review to done."
      >
        <MilestoneDemo />
      </Tile>
      <Tile
        className="lg:col-span-3"
        icon={MessageCircle}
        title="A real person, within a day"
        body="Ask, change scope, add a piece. The plan and price update with the answer."
      >
        <ChatDemo />
      </Tile>
      <Tile
        className="lg:col-span-2"
        icon={FileText}
        title="GST invoices, sorted"
        body="Itemised and compliant from the first quote."
      >
        <InvoiceDemo />
      </Tile>
      <Tile
        className="lg:col-span-2"
        icon={Wallet}
        title="Pay as work lands"
        body="Payments are tied to milestones, not upfront."
      >
        <RingDemo />
      </Tile>
      <Tile
        className="lg:col-span-2"
        icon={ShieldCheck}
        title="Yours, and private"
        body="Signed agreements, in one place."
      >
        <ShieldDemo />
      </Tile>
    </Reveal>
  );
}

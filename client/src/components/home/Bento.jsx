import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Reveal } from '@components/Reveal';
import { useSeen } from './HomeMotion';

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

const POINTS = [
  {
    title: 'Delivery you can watch',
    body: 'Every project is split into milestones. You see each one move from build to review to done.',
  },
  {
    title: 'A real person within a working day',
    body: 'Ask, change scope, add a piece. The plan and the price update with the answer.',
  },
  { title: 'GST invoices', body: 'Itemised and compliant from the first quote.' },
  { title: 'Pay as work lands', body: 'Payments follow milestones, not one large sum upfront.' },
  { title: 'You own it', body: 'The code and IP are yours. NDA on request.' },
];

/** One real dashboard view beside the list of what is handled after you sign. */
export function Bento() {
  return (
    <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-12 lg:gap-16">
      <Reveal className="lg:col-span-7">
        <div className="rounded-lg bg-white p-6 shadow-md md:p-8">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-caption text-warm-500">Client dashboard</p>
              <h3 className="text-title text-warm-900">D2C storefront</h3>
            </div>
            <span className="text-body-sm tabular-nums text-warm-500">Week 4 of 6</span>
          </div>
          <MilestoneDemo />
          <dl className="mt-6 grid gap-4 border-t border-warm-100 pt-5 text-body-sm sm:grid-cols-3">
            {[
              ['Paid so far', '2 of 4 milestones'],
              ['Next invoice', 'When QA is signed off'],
              ['Agreement', 'Signed, NDA in place'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-warm-500">{k}</dt>
                <dd className="mt-0.5 font-medium text-warm-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>

      <Reveal as="dl" stagger className="border-t border-warm-200 lg:col-span-5">
        {POINTS.map((p) => (
          <Reveal.Item key={p.title} className="border-b border-warm-200 py-5">
            <dt className="font-medium text-warm-900">{p.title}</dt>
            <dd className="mt-1 text-body-sm text-warm-600">{p.body}</dd>
          </Reveal.Item>
        ))}
      </Reveal>
    </div>
  );
}

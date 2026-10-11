import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { Brain, Check, Cloud, Globe, Palette, ShoppingCart, TrendingUp } from 'lucide-react';
import { Reveal } from '@components/Reveal';

const PIECES = [
  { id: 'web', label: 'Custom website, 5 pages', price: 35000, weeks: 2, Icon: Globe },
  { id: 'brand', label: 'Logo + brand kit', price: 18000, weeks: 1, Icon: Palette },
  { id: 'checkout', label: 'Razorpay checkout', price: 12000, weeks: 0.5, Icon: ShoppingCart },
  { id: 'chatbot', label: 'AI chatbot', price: 35000, weeks: 2, Icon: Brain },
  { id: 'seo', label: 'SEO starter pack', price: 15000, weeks: 1, Icon: TrendingUp },
  { id: 'hosting', label: 'Cloud hosting, 1 year', price: 8000, weeks: 0, Icon: Cloud },
];

const GST = 0.18;
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupees = (n) => `₹${inr.format(Math.round(n))}`;
const spring = { type: 'spring', stiffness: 500, damping: 30 };

function CountUp({ value, className }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, rupees);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return undefined;
    }
    const controls = animate(mv, value, { duration: 0.5, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return (
    <motion.span className={className} aria-hidden>
      {text}
    </motion.span>
  );
}

export function TryEstimator() {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState(() => new Set(['web', 'brand', 'checkout']));

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selected = PIECES.filter((p) => picked.has(p.id));
  const subtotal = selected.reduce((s, p) => s + p.price, 0);
  const gst = subtotal * GST;
  const total = subtotal + gst;
  const weeks = Math.max(1, Math.ceil(selected.reduce((s, p) => s + p.weeks, 0)));
  const empty = selected.length === 0;

  const rowMotion = reduce
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, height: 0, x: 12 },
        animate: { opacity: 1, height: 'auto', x: 0 },
        exit: { opacity: 0, height: 0, x: -12 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
      <Reveal stagger as="ul" className="space-y-2 lg:col-span-7" aria-label="Pieces to include">
        {PIECES.map(({ id, label, price, Icon }) => {
          const on = picked.has(id);
          return (
            <Reveal.Item as="li" key={id}>
              <label
                className={`flex cursor-pointer items-center gap-4 rounded-md px-4 py-4 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fox-500 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-warm-white md:px-5 ${
                  on
                    ? 'bg-white shadow-sm ring-1 ring-warm-900/10'
                    : 'border border-warm-200/70 hover:bg-white/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => toggle(id)}
                />
                <span
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
                <span className="flex-1 text-body text-warm-900">{label}</span>
                <span className="text-body tabular-nums text-warm-900">{rupees(price)}</span>
              </label>
            </Reveal.Item>
          );
        })}
      </Reveal>

      <div className="lg:sticky lg:top-28 lg:col-span-5">
        <div className="rounded-lg bg-warm-900 p-6 text-white">
          <div className="flex items-baseline justify-between text-caption text-warm-200">
            <span>Your estimate</span>
            <span className="tabular-nums">
              {selected.length} {selected.length === 1 ? 'piece' : 'pieces'}
            </span>
          </div>

          <ul className="mt-4 border-t border-white/10">
            <AnimatePresence initial={false}>
              {selected.map((p) => (
                <motion.li key={p.id} layout={!reduce} className="overflow-hidden" {...rowMotion}>
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 text-body-sm">
                    <span className="text-warm-200">{p.label}</span>
                    <span className="tabular-nums text-white">{rupees(p.price)}</span>
                  </div>
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

          <motion.div layout={!reduce} className="mt-4 space-y-1 text-body-sm text-warm-100">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <CountUp value={subtotal} className="tabular-nums" />
            </div>
            <div className="flex justify-between">
              <span>GST 18%</span>
              <CountUp value={gst} className="tabular-nums" />
            </div>
          </motion.div>

          <motion.div layout={!reduce} className="mt-5 border-t border-white/10 pt-5">
            <p className="text-caption text-warm-200">Estimated total</p>
            <p className="mt-1" aria-live="polite">
              <CountUp
                value={total}
                className="font-display text-4xl tabular-nums tracking-tight text-white"
              />
              <span className="sr-only">{rupees(total)}</span>
            </p>
            <p className="mt-2 text-body-sm text-warm-100">
              {empty ? 'No timeline yet' : `About ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`}
            </p>
          </motion.div>

          <Link to="/builder" className="btn-fox mt-6 w-full">
            Build this for real
          </Link>
          <p className="mt-3 text-caption text-warm-200">
            Sample prices. Your final quote comes after a free scope call.
          </p>
        </div>
      </div>
    </div>
  );
}

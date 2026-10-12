import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Globe,
  Palette,
  ShoppingCart,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { HeroVideo, PREVIEWS, inr } from '@components/home/HeroVideo';
import { Magnetic } from '@components/home/HomeMotion';
import { EASE, MaskWords } from '@components/home/SectionHead';
// ~2 KB summary (names + counts) instead of the full 100 KB catalogue.
import CATALOG from '@data/catalog-summary.json';

/* "What are you building?" shortcuts: land in that part of the Builder. */
const QUICK_STARTS = [
  { label: 'Website', icon: Globe, cat: 'web-dev' },
  { label: 'Online store', icon: ShoppingCart, cat: 'ecommerce' },
  { label: 'Mobile app', icon: Smartphone, cat: 'mobile-dev' },
  { label: 'AI chatbot', icon: Brain, cat: 'ai-genai' },
  { label: 'Logo & design', icon: Palette, cat: 'ui-ux' },
  { label: 'SEO & ads', icon: TrendingUp, cat: 'seo-marketing' },
];

/** Hero: the promise, then the real Builder at work. */
export function Hero() {
  const { serviceCount } = CATALOG;
  const reduce = useReducedMotion();
  const section = useRef(null);
  const sheen = useRef(null);
  // chip under the mouse or keyboard focus: the plan card previews that category
  const [cat, setCat] = useState(null);
  // headline drifts slower than the page: it is gone 40px early by the time the stage arrives
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] });
  const drift = useTransform(scrollYProgress, [0, 0.4], [0, -40]);
  // desktop only: a soft highlight follows the cursor across the gradient line
  const onMove = (e) => {
    const el = sheen.current;
    if (!el || reduce || e.pointerType !== 'mouse') return;
    el.style.setProperty('--mx', `${e.clientX - el.getBoundingClientRect().left}px`);
    el.style.opacity = 1;
  };
  const onLeave = () => sheen.current && (sheen.current.style.opacity = 0);
  return (
    <section
      ref={section}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative overflow-hidden bg-warm-white"
    >
      <div className="container-fx relative pb-16 pt-10 sm:pt-14 lg:pb-24 lg:pt-16">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <motion.h1
            className="text-warm-900 lg:col-span-7"
            style={{
              y: reduce ? 0 : drift,
              fontSize: 'clamp(2.6rem, 5.6vw, 5rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
            }}
          >
            <span className="block">
              <MaskWords text="Build anything." />
            </span>
            <span className="relative block">
              <MaskWords text="Price every piece." delay={0.18} className="text-gradient-fox" />
              <span
                ref={sheen}
                aria-hidden
                className="pointer-events-none absolute inset-0 hidden select-none text-white opacity-0 transition-opacity duration-medium lg:block"
                style={{
                  WebkitMaskImage:
                    'radial-gradient(130px 100px at var(--mx, -200px) 50%, #000 0%, transparent 100%)',
                  maskImage:
                    'radial-gradient(130px 100px at var(--mx, -200px) 50%, #000 0%, transparent 100%)',
                }}
              >
                Price every piece.
              </span>
            </span>
          </motion.h1>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
            className="lg:col-span-5 lg:pb-2"
          >
            <p className="max-w-md text-body-lg text-warm-800">
              Your idea. The right expertise. A clear price. Pick from {serviceCount}+ priced
              services and watch your total build up, line by line.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Magnetic className="w-full sm:w-auto">
                <Link
                  to="/builder"
                  className="btn-fox group w-full transition-transform duration-[80ms] active:scale-[0.97] sm:w-auto"
                >
                  Start building
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-short group-hover:translate-x-1"
                  />
                </Link>
              </Magnetic>
              <Link
                to="/catalog"
                className="group inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-warm-900 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 focus-visible:ring-offset-2 decoration-warm-300 underline-offset-4 hover:text-fox-600 hover:decoration-fox-300"
              >
                Explore services
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-short group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            <p className="mt-4 text-body-sm text-warm-700">
              Explore first. Talk to us when you&rsquo;re ready.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
          className="relative z-20 mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <span className="hidden shrink-0 text-body-sm font-medium text-warm-800 sm:block">
            What are you building?
          </span>
          <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {QUICK_STARTS.map(({ label, icon: Icon, cat: key }, i) => (
              <motion.span
                key={key}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.05, ease: EASE }}
                className="shrink-0"
              >
                <Link
                  to={`/builder?category=${key}`}
                  data-cat={key}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setCat(key)}
                  onPointerLeave={() => setCat(null)}
                  onFocus={(e) => e.currentTarget.matches(':focus-visible') && setCat(key)}
                  onBlur={() => setCat(null)}
                  className="group relative inline-flex min-h-11 items-center gap-2 overflow-hidden rounded-pill bg-white px-4 py-2 text-body-sm font-medium text-warm-900 ring-1 ring-warm-200 transition-all hover:-translate-y-0.5 hover:shadow-sm hover:ring-fox-300 active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 sm:min-h-0 sm:px-3.5"
                >
                  {/* fill sweeps in from the left on hover/focus */}
                  <span
                    aria-hidden
                    className="absolute inset-0 origin-left scale-x-0 bg-fox-50 transition-transform duration-[180ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  />
                  <Icon size={15} className="relative text-fox-500" />
                  <span className="relative">{label}</span>
                </Link>
              </motion.span>
            ))}
          </div>
          {/* the plan card sits below the fold, so the preview also appears right under the chips */}
          <AnimatePresence>
            {cat && (
              <motion.div
                key={cat}
                aria-hidden
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: EASE }}
                className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[300px] rounded-md bg-white p-3 text-body-sm text-warm-900 shadow-lg ring-1 ring-warm-900/10 lg:block sm:left-[11.5rem]"
              >
                <p className="text-caption font-medium text-fox-600">
                  Preview: {PREVIEWS[cat].label}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {PREVIEWS[cat].rows.map(([name, price]) => (
                    <li key={name} className="flex justify-between gap-3">
                      <span className="truncate">{name}</span>
                      <span className="font-medium tabular-nums">{inr(price)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-warm-200 pt-2 font-semibold">
                  <span>Total incl. GST</span>
                  <span className="tabular-nums text-fox-500">
                    {inr(Math.round(PREVIEWS[cat].rows.reduce((n, r) => n + r[1], 0) * 1.18))}
                  </span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="sr-only">
          The plan builds up as services are added, ending at a total of 76,700 rupees including
          GST.
        </p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
          className="mt-10 lg:mt-12 lg:pb-12"
        >
          <HeroVideo preview={cat} />
        </motion.div>
      </div>
    </section>
  );
}

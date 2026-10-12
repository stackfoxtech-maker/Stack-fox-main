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
import { motion, useReducedMotion } from 'framer-motion';
import { HeroVideo } from '@components/home/HeroVideo';
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
  return (
    <section className="relative overflow-hidden bg-warm-white">
      <div className="container-fx relative pb-16 pt-10 sm:pt-14 lg:pb-24 lg:pt-16">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <h1
            className="text-warm-900 lg:col-span-7"
            style={{
              fontSize: 'clamp(2.6rem, 5.6vw, 5rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
            }}
          >
            <span className="block">
              <MaskWords text="Build anything." />
            </span>
            <span className="block">
              <MaskWords text="Price every piece." delay={0.18} className="text-gradient-fox" />
            </span>
          </h1>
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
              <Link to="/builder" className="btn-fox group w-full sm:w-auto">
                Start building
                <ArrowRight
                  size={16}
                  className="transition-transform duration-short group-hover:translate-x-1"
                />
              </Link>
              <Link
                to="/catalog"
                className="group inline-flex items-center gap-1 text-body-sm font-medium text-warm-900 underline decoration-warm-300 underline-offset-4 hover:text-fox-600 hover:decoration-fox-300"
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
          className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <span className="hidden shrink-0 text-body-sm font-medium text-warm-800 sm:block">
            What are you building?
          </span>
          <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {QUICK_STARTS.map(({ label, icon: Icon, cat }, i) => (
              <motion.span
                key={cat}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.05, ease: EASE }}
                className="shrink-0"
              >
                <Link
                  to={`/builder?category=${cat}`}
                  className="inline-flex items-center gap-2 rounded-pill bg-white px-3.5 py-2 text-body-sm font-medium text-warm-900 ring-1 ring-warm-200 transition-all hover:-translate-y-0.5 hover:shadow-sm hover:ring-fox-300"
                >
                  <Icon size={15} className="text-fox-500" /> {label}
                </Link>
              </motion.span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
          className="mt-10 lg:mt-12"
        >
          <HeroVideo />
        </motion.div>
      </div>
    </section>
  );
}

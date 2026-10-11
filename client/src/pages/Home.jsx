import { useRef } from 'react';
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
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { usePageTitle } from '@lib/hooks';
import { Reveal } from '@components/Reveal';
import { CountOnView } from '@components/home/HomeMotion';
import { JourneyFilm } from '@components/home/JourneyFilm';
import { BuildShowcase } from '@components/home/BuildShowcase';
import { TryEstimator } from '@components/home/TryEstimator';
import { Bento } from '@components/home/Bento';
import { IndustryStrip } from '@components/home/IndustryStrip';
import { Studio } from '@components/home/Studio';
import { Proof } from '@components/home/Proof';
import { Faq } from '@components/home/Faq';
// ~2 KB summary (names + counts) instead of the full 100 KB catalogue — keeps
// the landing page off the big JSON. Regenerate: scripts/gen-catalog-summary.mjs
import CATALOG from '@data/catalog-summary.json';

const EASE = [0.2, 0.7, 0.2, 1];

/* "What are you building?" shortcuts: land in that part of the Builder. */
const QUICK_STARTS = [
  { label: 'Website', icon: Globe, cat: 'web-dev' },
  { label: 'Online store', icon: ShoppingCart, cat: 'ecommerce' },
  { label: 'Mobile app', icon: Smartphone, cat: 'mobile-dev' },
  { label: 'AI chatbot', icon: Brain, cat: 'ai-genai' },
  { label: 'Logo & design', icon: Palette, cat: 'ui-ux' },
  { label: 'SEO & ads', icon: TrendingUp, cat: 'seo-marketing' },
];

/** Words rise out of a mask one after another. */
function MaskWords({ text, delay = 0, className = '' }) {
  const reduce = useReducedMotion();
  return text.split(' ').map((w, i) => (
    <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
      <motion.span
        className={`inline-block ${className}`}
        initial={reduce ? false : { y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, delay: delay + i * 0.07, ease: EASE }}
      >
        {w}
        {' '}
      </motion.span>
    </span>
  ));
}

/** Section heading whose lines slide up out of a mask as it scrolls in. */
function SectionHead({ title, sub, action, tone = 'light' }) {
  const dark = tone === 'dark';
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <h2
          className={`text-[2rem] leading-[1.08] tracking-tight md:text-[2.875rem] ${dark ? 'text-white' : 'text-warm-900'}`}
        >
          {title.split('\n').map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={reduce ? false : { y: '105%' }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.75, delay: i * 0.1, ease: EASE }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h2>
        {sub && (
          <Reveal>
            <p className={`mt-5 text-body-lg ${dark ? 'text-warm-200' : 'text-warm-700'}`}>{sub}</p>
          </Reveal>
        )}
      </div>
      {action && <Reveal>{action}</Reveal>}
    </div>
  );
}

export default function Home() {
  usePageTitle(null);
  const { categories, serviceCount } = CATALOG;
  const reduce = useReducedMotion();

  // The product stage tilts up from the page as it scrolls into view.
  const stageRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'start 25%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.92, 1]);

  return (
    <>
      {/* ── Hero: promise, shortcuts, then the product film on the brand stage ── */}
      <section className="relative overflow-hidden bg-warm-white">
        <div className="container-fx relative pb-16 pt-10 sm:pt-16 lg:pb-24 lg:pt-20">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
            <h1
              className="text-warm-900 lg:col-span-7"
              style={{
                fontSize: 'clamp(2.6rem, 6.4vw, 5.25rem)',
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
            className="mt-10 flex items-center gap-3"
          >
            <span className="hidden shrink-0 text-body-sm font-medium text-warm-800 sm:block">
              What are you building?
            </span>
            <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:px-0">
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

          <div ref={stageRef} className="mt-10 [perspective:1400px] lg:mt-14">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
              style={{ rotateX, scale, transformOrigin: 'center top' }}
            >
              <JourneyFilm stageClassName="brand-stage p-3 sm:p-6 lg:p-12" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Facts strip ─────────────────────────────────────── */}
      <section className="border-y border-warm-200 bg-white">
        <Reveal stagger className="container-fx grid grid-cols-2 gap-y-6 py-9 md:grid-cols-4">
          {[
            [<CountOnView key="n" end={serviceCount} suffix="+" />, 'services, each with a price'],
            [<CountOnView key="g" end={18} suffix="% GST" />, 'itemised on every invoice'],
            ['By milestone', 'pay as each phase lands'],
            [<CountOnView key="d" end={30} suffix=" days" />, 'of free fixes after launch'],
          ].map(([k, v]) => (
            <Reveal.Item
              key={v}
              className="md:border-l md:border-warm-200 md:pl-6 md:first:border-l-0 md:first:pl-0"
            >
              <p className="font-display text-3xl font-bold tracking-tight text-warm-900">{k}</p>
              <p className="mt-1 text-body-sm text-warm-700">{v}</p>
            </Reveal.Item>
          ))}
        </Reveal>
      </section>

      {/* ── Proven builds ───────────────────────────────────── */}
      <section className="section-padding bg-warm-white">
        <div className="container-fx">
          <SectionHead
            title={'A big idea.\nA straightforward start.'}
            sub="Each package is a set of priced pieces we ship often. Take it as is, or open it in the Builder and change anything."
          />
          <div className="mt-12">
            <BuildShowcase />
          </div>
        </div>
      </section>

      {/* ── Try it ──────────────────────────────────────────── */}
      <section className="section-padding bg-white">
        <div className="container-fx">
          <SectionHead
            title={'A little of this.\nA lot of possibility.'}
            sub="Tick a few pieces and watch the estimate move. This is exactly how the Builder works."
          />
          <div className="mt-12">
            <TryEstimator />
          </div>
        </div>
      </section>

      {/* ── After you sign (dark band) ──────────────────────── */}
      <section className="section-padding relative overflow-hidden bg-warm-900">
        <div className="container-fx">
          <SectionHead
            tone="dark"
            title={'Clarity doesn’t\nstop at the quote.'}
            sub="A shared workspace keeps you connected to the work, from kickoff to launch."
          />
          <Bento />
        </div>
      </section>

      {/* ── Industries ──────────────────────────────────────── */}
      <section className="section-padding bg-warm-white">
        <div className="container-fx">
          <SectionHead
            title={'Bundles for how\nyour industry runs.'}
            sub="Pre-assembled for the software each kind of business needs most, priced up front."
            action={
              <Link to="/industries" className="btn-outline self-start md:self-auto">
                All industries <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="mt-12">
            <IndustryStrip />
          </div>
        </div>
      </section>

      {/* ── Catalogue index ─────────────────────────────────── */}
      <section className="section-padding bg-white" id="services">
        <div className="container-fx">
          <SectionHead
            title={'The pieces of\nyour next big thing.'}
            sub={`${serviceCount} services. ${categories.length} domains. One place to put them together.`}
            action={
              <Link to="/catalog" className="btn-outline self-start md:self-auto">
                View all services <ArrowUpRight size={15} />
              </Link>
            }
          />
          <Reveal as="ul" stagger className="mt-12 grid gap-x-12 md:grid-cols-2">
            {categories.map((cat, i) => (
              <Reveal.Item key={cat.id} as="li" className="border-t border-warm-200">
                <Link
                  to={`/builder?category=${cat.id}`}
                  className="group relative flex items-baseline gap-5 py-5"
                >
                  <span className="w-6 shrink-0 font-display text-body-sm font-semibold tabular-nums text-fox-500">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-title text-warm-900 transition-transform duration-medium group-hover:translate-x-1">
                      {cat.name}
                    </span>
                    <span className="mt-1 block truncate text-body-sm text-warm-700">
                      {cat.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-body-sm tabular-nums text-warm-800">
                    {cat.count} pieces
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="shrink-0 self-center text-warm-400 transition-all duration-medium group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fox-500"
                  />
                  <span className="absolute inset-x-0 -top-px h-px origin-left scale-x-0 bg-fox-500 transition-transform duration-medium group-hover:scale-x-100" />
                </Link>
              </Reveal.Item>
            ))}
          </Reveal>
        </div>
      </section>

      <Studio />
      <Proof />
      <Faq />
      {/* Closing CTA is the Footer's own band. */}
    </>
  );
}

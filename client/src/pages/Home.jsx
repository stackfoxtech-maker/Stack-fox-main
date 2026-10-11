import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShoppingCart,
  Globe,
  Smartphone,
  Brain,
  Zap,
  Palette,
  Cloud,
  TrendingUp,
  Check,
  Shield,
  Quote,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePageTitle, useCountUp } from '@lib/hooks';
import CdnImage from '@components/CdnImage';
import { Reveal } from '@components/Reveal';
import { fadeUp } from '@components/motion';
import { BrandLogo } from '@components/ui/BrandLogo';
import { ScrollProgress } from '@components/home/HomeMotion';
import { Bento } from '@components/home/Bento';
// ~2 KB summary (names + counts) instead of the full 100 KB catalogue — keeps
// the landing page off the big JSON. Regenerate: scripts/gen-catalog-summary.mjs
import CATALOG from '@data/catalog-summary.json';

const EASE = [0.2, 0.7, 0.2, 1];
/* Hero left column — headline lines and copy rise in sequence. */
const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};
const heroLine = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
/* Quote card — line items cascade in after the card settles, then the total ticks. */
const cardList = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.42 } },
};
const cardRow = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.34, ease: EASE } },
};

const inr = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n);

/* Phone-only shortcuts under the hero: tap what you are building, land in that part of the Builder. */
const QUICK_STARTS = [
  { label: 'Website', icon: Globe, cat: 'web-dev' },
  { label: 'Mobile app', icon: Smartphone, cat: 'mobile-dev' },
  { label: 'Online store', icon: ShoppingCart, cat: 'ecommerce' },
  { label: 'AI chatbot', icon: Brain, cat: 'ai-genai' },
  { label: 'Logo & design', icon: Palette, cat: 'ui-ux' },
  { label: 'SEO & ads', icon: TrendingUp, cat: 'seo-marketing' },
];

const CALL_NUMBER = '+91 82093 95894';

const STEPS = [
  {
    title: 'Browse',
    to: '/catalog',
    cta: 'Browse the catalog',
    body: `${CATALOG.serviceCount}+ services across 13 domains, each with a real price. No "contact us" walls.`,
  },
  {
    title: 'Assemble',
    to: '/builder',
    cta: 'Open the Builder',
    body: 'Add the pieces you need. Your total updates live — GST and all.',
  },
  {
    title: 'Book a call',
    // Opens the phone dialler on a phone; on a desktop the browser hands it to the
    // default calling app.
    href: `tel:${CALL_NUMBER.replace(/\s/g, '')}`,
    cta: `Call ${CALL_NUMBER}`,
    body: 'Send us the itemised plan. We confirm scope on a free call and start.',
  },
];

export default function Home() {
  usePageTitle(null);

  const chips = useMemo(
    () => [
      { id: 'c1', icon: Globe, label: 'Custom website, 5 pages', price: 35000 },
      { id: 'c2', icon: Palette, label: 'Logo + brand kit', price: 18000 },
      { id: 'c3', icon: ShoppingCart, label: 'Razorpay checkout', price: 12000 },
      { id: 'c4', icon: () => <BrandLogo size={16} />, label: 'AI chatbot (FoxBot)', price: 35000 },
      { id: 'c5', icon: TrendingUp, label: 'SEO starter pack', price: 15000 },
      { id: 'c6', icon: Cloud, label: 'Cloud hosting, 1 year', price: 8000 },
    ],
    [],
  );

  const [picked, setPicked] = useState(['c1', 'c2', 'c3']);
  const touched = useRef(false);
  const toggle = (id) => {
    touched.current = true;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  // Until the visitor touches the card, it plays itself: pieces get added and dropped so
  // the live total is seen changing. Stops the moment they interact; skipped for reduced motion.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const script = ['c4', 'c5', 'c6', 'c6', 'c5', 'c4'];
    let i = 0;
    const t = setInterval(() => {
      if (touched.current || i >= script.length) {
        clearInterval(t);
        return;
      }
      const id = script[i++];
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    }, 2200);
    return () => {
      clearInterval(t);
    };
  }, []);
  const subtotal = chips.filter((c) => picked.includes(c.id)).reduce((s, c) => s + c.price, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  // Signature moment (DESIGN.md): the running total counts up as pieces change.
  // startDelay lets the first tick land just after the line items cascade in.
  const { ref: totalRef, value: shownTotal } = useCountUp(total, {
    duration: 700,
    startDelay: 900,
  });

  const categories = CATALOG.categories;
  const serviceCount = CATALOG.serviceCount;

  return (
    <>
      <ScrollProgress />
      {/* ── 1 · Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-warm-white">
        <div className="container-fx relative py-8 sm:py-16 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <motion.div
              variants={heroStagger}
              initial="hidden"
              animate="show"
              className="min-w-0 lg:col-span-6 xl:col-span-7"
            >
              <h1
                className="text-warm-900"
                style={{
                  fontSize: 'clamp(2.35rem, 6vw, 3.5rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.025em',
                }}
              >
                <motion.span variants={heroLine} className="block">
                  Build anything.
                </motion.span>
                <motion.span variants={heroLine} className="block">
                  Price every piece.
                </motion.span>
              </h1>
              <motion.p variants={fadeUp} className="mt-5 max-w-md text-body-lg text-warm-600">
                Browse services, add what you need, and watch your total update as you go. Talk to
                us only when you're ready.
              </motion.p>
              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
              >
                <Link to="/builder" className="btn-fox group w-full sm:w-auto">
                  Start building{' '}
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-short group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  to="/pricing"
                  className="text-body-sm font-medium text-warm-600 underline decoration-warm-300 underline-offset-4 hover:text-fox-600"
                >
                  See how pricing works
                </Link>
              </motion.div>
              <motion.p
                variants={fadeUp}
                className="mt-10 hidden border-t border-warm-200 pt-5 text-body-sm text-warm-500 sm:block"
              >
                GST invoice on every order · Pay by milestone · Reply within a working day
              </motion.p>

              <motion.div variants={fadeUp} className="mt-7 sm:hidden">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-warm-500">
                  What are you building?
                </p>
                <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
                  {QUICK_STARTS.map(({ label, icon: Icon, cat }) => (
                    <Link
                      key={cat}
                      to={`/builder?category=${cat}`}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-warm-200 bg-white px-4 py-3 text-sm font-semibold text-warm-800 shadow-sm transition-transform active:scale-95"
                    >
                      <Icon size={16} className="text-fox-500" /> {label}
                    </Link>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Itemised quote card — assembles itself on load: rows cascade in, then the total ticks up. */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.18, ease: EASE }}
              className="relative min-w-0 lg:col-span-6 xl:col-span-5"
            >
              <div className="rounded-md border border-warm-200 bg-white p-5 shadow-lg sm:p-6">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-title text-warm-900">Your project, itemised</h2>
                  <span className="rounded-sm bg-warm-50 px-2 py-1 font-mono text-[11px] text-warm-400">
                    stackfox.in/builder
                  </span>
                </div>
                <p className="mb-4 text-caption text-warm-500">
                  Indicative pricing · final quote after a free call
                </p>

                <motion.div
                  variants={cardList}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {chips.map((c) => {
                    const on = picked.includes(c.id);
                    const Icon = c.icon;
                    return (
                      <motion.button
                        key={c.id}
                        variants={cardRow}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => toggle(c.id)}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors duration-short ${
                          on
                            ? 'border-sage-200 bg-sage-50'
                            : 'border-warm-200 bg-warm-white hover:border-warm-300'
                        }`}
                      >
                        <span
                          className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-sm ${on ? 'bg-sage-100 text-sage-700' : 'bg-white text-warm-400'}`}
                        >
                          <motion.span
                            key={on ? 'on' : 'off'}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.16, ease: EASE }}
                            className="grid place-items-center"
                          >
                            {on ? <Check size={13} /> : <Icon size={13} />}
                          </motion.span>
                        </span>
                        <span className="flex-1 text-body-sm font-medium text-warm-800">
                          {c.label}
                        </span>
                        <span
                          className={`price-tag text-body-sm ${on ? 'text-warm-900' : 'text-warm-400'}`}
                        >
                          {inr(c.price)}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>

                <div className="mt-4 space-y-1.5 border-t border-warm-200 pt-4 text-body-sm text-warm-500">
                  <div className="flex justify-between">
                    <span>Subtotal · {picked.length} pieces</span>
                    <span className="price-tag">{inr(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST 18%</span>
                    <span className="price-tag">{inr(gst)}</span>
                  </div>
                </div>
                <div
                  ref={totalRef}
                  className="mt-3 flex items-baseline justify-between border-t-2 border-warm-900 pt-3"
                >
                  <span className="text-title text-warm-900">Total</span>
                  <motion.span
                    key={total}
                    initial={{ scale: 1.08 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                    className="inline-block origin-right font-display text-2xl font-bold tabular-nums tracking-tight text-fox-600"
                  >
                    {inr(shownTotal)}
                  </motion.span>
                </div>

                <Link to="/builder" className="btn-fox mt-5 w-full">
                  Build the real thing <ArrowRight size={15} />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 2 · How it works ─────────────────────────────────── */}
      <section className="section-padding bg-white">
        <div className="container-fx grid gap-8 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-4">
            <h2 className="text-3xl text-warm-900 md:text-display-lg">How it works</h2>
            <p className="mt-4 text-body-lg text-warm-600">
              No proposals to wade through. You see the price before anyone calls you.
            </p>
          </Reveal>

          <Reveal as="ol" stagger className="border-t border-warm-200 lg:col-span-8">
            {STEPS.map((s, i) => {
              const Anchor = s.to ? Link : 'a';
              const anchorProps = s.to ? { to: s.to } : { href: s.href };
              return (
                <Reveal.Item
                  key={s.title}
                  as="li"
                  className="grid grid-cols-[2rem_1fr] gap-x-4 border-b border-warm-200 py-6 md:grid-cols-[2.5rem_1fr_auto] md:items-baseline md:gap-x-8"
                >
                  <span className="text-body-sm font-medium tabular-nums text-warm-400">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-title text-warm-900">{s.title}</h3>
                    <p className="mt-1 max-w-md text-body text-warm-600">{s.body}</p>
                  </div>
                  <Anchor
                    {...anchorProps}
                    className="col-start-2 mt-3 inline-flex items-center gap-1.5 justify-self-start text-body-sm font-semibold text-warm-900 underline decoration-warm-300 underline-offset-4 transition-colors hover:text-fox-600 hover:decoration-fox-300 md:col-start-auto md:mt-0"
                  >
                    {s.cta}
                    <ArrowRight size={14} />
                  </Anchor>
                </Reveal.Item>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ── 3 · Browse the catalog ───────────────────────────── */}
      <section className="section-padding bg-warm-white" id="services">
        <div className="container-fx">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <h2 className="text-3xl text-warm-900 md:text-display-lg">
                13 domains, {serviceCount}+ priced pieces
              </h2>
              <p className="mt-4 text-body-lg text-warm-600">
                Every service is split into pieces with their own price. Take what you need.
              </p>
            </div>
            <Link to="/catalog" className="btn-outline self-start md:self-auto">
              Browse everything <ArrowRight size={15} />
            </Link>
          </Reveal>

          <Reveal
            as="ul"
            stagger
            className="mt-10 grid gap-x-10 md:mt-14 md:grid-cols-2 lg:grid-cols-3"
          >
            {categories.map((cat) => (
              <Reveal.Item key={cat.id} as="li" className="border-t border-warm-200">
                <Link
                  to={`/builder?category=${cat.id}`}
                  className="group flex items-baseline justify-between gap-4 py-4"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-warm-900 transition-colors group-hover:text-fox-600">
                      {cat.name}
                    </span>
                    <span className="mt-0.5 hidden truncate text-body-sm text-warm-500 sm:block">
                      {cat.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-body-sm tabular-nums text-warm-400">
                    {cat.count} pieces
                  </span>
                </Link>
              </Reveal.Item>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Everything included ──────────────────────────────── */}
      <section className="section-padding bg-warm-50">
        <div className="container-fx">
          <Reveal className="max-w-xl">
            <h2 className="text-3xl text-warm-900 md:text-display-lg">
              The boring parts are handled
            </h2>
            <p className="mt-4 text-body-lg text-warm-600">
              Progress, invoices, payments and agreements live in one dashboard.
            </p>
          </Reveal>
          <Bento />
        </div>
      </section>

      {/* ── 4 · Proof ────────────────────────────────────────── */}
      <section className="bg-white section-padding">
        <div className="container-fx">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <Reveal variant="fade" className="lg:col-span-5">
              <div className="img-frame aspect-[4/3]">
                <CdnImage
                  name="founder-desk"
                  w={900}
                  widths={[480, 720, 900, 1200]}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  width={1200}
                  height={900}
                  alt="A StackFox client working through her itemised project plan"
                />
              </div>
            </Reveal>

            <Reveal className="lg:col-span-7">
              <span className="eyebrow mb-4">Why teams pick us</span>
              <Quote size={28} className="mb-3 text-fox-500" aria-hidden />
              <blockquote className="font-display text-display-sm text-warm-900">
                "I priced the whole build in an afternoon, sent the list, and had a call booked by
                the next morning. No back-and-forth, no guessing."
              </blockquote>
              <p className="mt-4 text-body-sm text-warm-600">
                Neha R. · founder, D2C skincare · shipped a storefront + subscriptions in 6 weeks
              </p>

              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-warm-200 pt-6 text-body-sm text-warm-600">
                <span className="inline-flex items-center gap-2">
                  <Shield size={15} className="text-sage-600" /> GST registered
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={15} className="text-sage-600" /> NDA on request
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={15} className="text-sage-600" /> ISO 27001 aligned
                </span>
                <span className="inline-flex items-center gap-2">
                  <Zap size={15} className="text-fox-500" /> 24-hour response
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Closing CTA is the Footer's own band. */}
    </>
  );
}

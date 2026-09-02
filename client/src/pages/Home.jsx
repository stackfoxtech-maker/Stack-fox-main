import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ShoppingCart, Globe, Smartphone, Brain, Zap, Palette, Server,
  Cloud, TrendingUp, MessageCircle, Box, Wrench, Code2, Check, Star, Shield,
  Search, Layers, PhoneCall, Quote,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePageTitle, useCountUp } from '@lib/hooks';
import { cdnImg } from '@lib/img';
import CdnImage from '@components/CdnImage';
import { Reveal } from '@components/Reveal';
import { fadeUp } from '@components/motion';
import { BrandLogo } from '@components/ui/BrandLogo';
import { FoxBot } from '@components/ui/FoxBot';
// ~2 KB summary (names + counts) instead of the full 100 KB catalogue — keeps
// the landing page off the big JSON. Regenerate: scripts/gen-catalog-summary.mjs
import CATALOG from '@data/catalog-summary.json';

const EASE = [0.2, 0.7, 0.2, 1];
/* Hero left column — headline lines and copy rise in sequence. */
const heroStagger = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } } };
const heroLine = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE } },
};
/* Quote card — line items cascade in after the card settles, then the total ticks. */
const cardList = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.42 } } };
const cardRow = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.34, ease: EASE } },
};

const iconMap = {
  globe: Globe, smartphone: Smartphone, brain: Brain, zap: Zap,
  'shopping-cart': ShoppingCart, palette: Palette, server: Server, cloud: Cloud,
  shield: Shield, 'trending-up': TrendingUp, 'message-circle': MessageCircle,
  box: Box, wrench: Wrench, code: Code2,
};

const inr = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n);

const STEPS = [
  { icon: Search, title: 'Browse', body: '240+ services across 13 domains, each with a real price. No "contact us" walls.' },
  { icon: Layers, title: 'Assemble', body: 'Add the pieces you need. Your total updates live — GST and all.' },
  { icon: PhoneCall, title: 'Book a call', body: 'Send us the itemised plan. We confirm scope on a free call and start.' },
];

/* Soft warm wash behind the hero — replaces the old decorative circles.
   The two washes drift slowly so the ground feels alive, not static.
   MotionConfig reducedMotion="user" freezes the drift for those who ask. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,77,0,0.10), transparent 70%)' }}
        animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle at 60% 40%, rgba(91,138,114,0.10), transparent 70%)' }}
        animate={{ x: [0, -20, 0], y: [0, 16, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-grain opacity-60" />
    </div>
  );
}

export default function Home() {
  usePageTitle(null);

  const chips = useMemo(() => [
    { id: 'c1', icon: Globe, label: 'Custom website, 5 pages', price: 35000 },
    { id: 'c2', icon: Palette, label: 'Logo + brand kit', price: 18000 },
    { id: 'c3', icon: ShoppingCart, label: 'Razorpay checkout', price: 12000 },
    { id: 'c4', icon: () => <BrandLogo size={16} />, label: 'AI chatbot (FoxBot)', price: 35000 },
    { id: 'c5', icon: TrendingUp, label: 'SEO starter pack', price: 15000 },
    { id: 'c6', icon: Cloud, label: 'Cloud hosting, 1 year', price: 8000 },
  ], []);

  const [picked, setPicked] = useState(['c1', 'c2', 'c3']);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const subtotal = chips.filter((c) => picked.includes(c.id)).reduce((s, c) => s + c.price, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  // Signature moment (DESIGN.md): the running total counts up as pieces change.
  // startDelay lets the first tick land just after the line items cascade in.
  const { ref: totalRef, value: shownTotal } = useCountUp(total, { duration: 700, startDelay: 900 });

  const categories = CATALOG.categories;
  const serviceCount = CATALOG.serviceCount;

  return (
    <>
      {/* ── 1 · Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-warm-white">
        <HeroBackdrop />
        <div className="container-fx relative py-12 sm:py-16 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <motion.div variants={heroStagger} initial="hidden" animate="show" className="lg:col-span-6 xl:col-span-7">
              <motion.span variants={fadeUp} className="chip-sage mb-6">
                <Zap size={14} className="text-sage-600" /> 240 services · one live total
              </motion.span>
              <h1 className="text-warm-900"
                style={{ fontSize: 'clamp(2.35rem, 6vw, 3.5rem)', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                <motion.span variants={heroLine} className="block">Build anything.</motion.span>
                <motion.span variants={heroLine} className="block">Price every piece.</motion.span>
              </h1>
              <motion.p variants={fadeUp} className="mt-5 max-w-md text-body-lg text-warm-600">
                Browse services, add what you need, and watch your total update as you go.
                Talk to us only when you're ready.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link to="/builder" className="btn-fox">
                  Start building <ArrowRight size={16} />
                </Link>
                <Link to="/pricing" className="text-body-sm font-medium text-warm-600 underline decoration-warm-300 underline-offset-4 hover:text-fox-600">
                  See how pricing works
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-warm-200 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {[
                      ['MK', 'bg-fox-100 text-fox-700'],
                      ['AR', 'bg-sage-100 text-sage-700'],
                      ['SP', 'bg-info-50 text-info-700'],
                      ['RB', 'bg-warm-200 text-warm-700'],
                    ].map(([ini, tone]) => (
                      <span key={ini} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-warm-white text-[11px] font-semibold ${tone}`}>
                        {ini}
                      </span>
                    ))}
                    <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-warm-white bg-warm-900 text-[10px] font-bold text-white">120</span>
                  </div>
                  <div className="text-body-sm">
                    <span className="font-semibold text-warm-900">120+ teams shipped</span>
                    <span className="ml-2 inline-flex items-center gap-1 text-warm-500">
                      <Star size={12} className="fill-fox-500 text-fox-500" /> 4.9/5
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Itemised quote card — assembles itself on load: rows cascade in, then the total ticks up. */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.18, ease: EASE }}
              className="lg:col-span-6 xl:col-span-5"
            >
              <div className="rounded-md border border-warm-200 bg-white p-5 shadow-lg sm:p-6">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-title text-warm-900">Your project, itemised</h2>
                  <span className="rounded-sm bg-warm-50 px-2 py-1 font-mono text-[11px] text-warm-400">stackfox.in/builder</span>
                </div>
                <p className="mb-4 text-caption text-warm-500">Indicative pricing · final quote after a free call</p>

                <motion.div variants={cardList} initial="hidden" animate="show" className="space-y-2">
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
                          on ? 'border-sage-200 bg-sage-50' : 'border-warm-200 bg-warm-white hover:border-warm-300'
                        }`}
                      >
                        <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-sm ${on ? 'bg-sage-100 text-sage-700' : 'bg-white text-warm-400'}`}>
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
                        <span className="flex-1 text-body-sm font-medium text-warm-800">{c.label}</span>
                        <span className={`price-tag text-body-sm ${on ? 'text-warm-900' : 'text-warm-400'}`}>{inr(c.price)}</span>
                      </motion.button>
                    );
                  })}
                </motion.div>

                <div className="mt-4 space-y-1.5 border-t border-warm-200 pt-4 text-body-sm text-warm-500">
                  <div className="flex justify-between"><span>Subtotal · {picked.length} pieces</span><span className="price-tag">{inr(subtotal)}</span></div>
                  <div className="flex justify-between"><span>GST 18%</span><span className="price-tag">{inr(gst)}</span></div>
                </div>
                <div ref={totalRef} className="mt-3 flex items-baseline justify-between border-t-2 border-warm-900 pt-3">
                  <span className="text-title text-warm-900">Total</span>
                  <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-fox-600">
                    {inr(shownTotal)}
                  </span>
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
        <div className="container-fx">
          <Reveal className="max-w-xl">
            <span className="eyebrow mb-4">One step at a time</span>
            <h2 className="text-3xl text-warm-900 md:text-display-lg">How it works, in three steps</h2>
            <p className="mt-4 text-body-lg text-warm-600">
              No lengthy proposals. Browse, build a plan, and book a call when it looks right.
            </p>
          </Reveal>

          <Reveal stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal.Item key={s.title} className="rounded-md border border-warm-200 bg-warm-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-pill bg-sage-50 font-mono text-sm text-sage-700">{i + 1}</span>
                  <s.icon size={18} className="text-fox-500" />
                </div>
                <h3 className="text-title text-warm-900">{s.title}</h3>
                <p className="mt-1.5 text-body-sm text-warm-600">{s.body}</p>
              </Reveal.Item>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Assembly band — "building software is easy now" ──── */}
      <section className="relative overflow-hidden bg-warm-50">
        <motion.img
          src={cdnImg('home-blocks', 1600)} width="1400" height="788" loading="lazy" alt=""
          aria-hidden
          onError={(e) => { e.currentTarget.src = '/img/home-blocks.webp'; }}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.14 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-warm-white via-warm-white/85 to-transparent" />
        <div className="container-fx relative py-16 md:py-24">
          <Reveal className="max-w-md">
            <p className="font-display text-display-md text-warm-900">
              Piece by piece, a real product — priced before you commit to a single line of code.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 3 · Browse the catalog ───────────────────────────── */}
      <section className="section-padding bg-warm-white" id="services">
        <div className="container-fx">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <span className="eyebrow mb-4">The catalog</span>
              <h2 className="text-3xl text-warm-900 md:text-display-lg">13 domains, {serviceCount}+ priced pieces</h2>
              <p className="mt-4 text-body-lg text-warm-600">
                Every service is broken into individually priced pieces. Pick what you need, skip what you don't.
              </p>
            </div>
            <Link to="/catalog" className="btn-outline self-start md:self-auto">
              Browse everything <ArrowRight size={15} />
            </Link>
          </Reveal>

          <Reveal stagger className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = iconMap[cat.icon] || Globe;
              const count = cat.count;
              return (
                <Reveal.Item key={cat.id} as={Link}
                  to={`/builder?category=${cat.id}`}
                  className="group flex h-full flex-col rounded-md border border-warm-200 bg-white p-5 shadow-sm transition-transform duration-short hover:-translate-y-1 hover:shadow-md"
                >
                  <span className="mb-4 grid h-10 w-10 place-items-center rounded-sm bg-warm-50 text-warm-500 transition-colors group-hover:bg-fox-50 group-hover:text-fox-600">
                    <Icon size={18} />
                  </span>
                  <h3 className="text-body-md font-semibold text-warm-900">{cat.name}</h3>
                  <p className="mt-0.5 text-body-sm text-sage-700">{count} pieces</p>
                  <p className="mt-2 hidden text-body-sm leading-snug text-warm-500 sm:line-clamp-2">{cat.description}</p>
                </Reveal.Item>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ── 4 · Proof ────────────────────────────────────────── */}
      <section className="bg-white section-padding">
        <div className="container-fx">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <Reveal variant="fade" className="lg:col-span-5">
              <div className="img-frame aspect-[4/3]">
                <CdnImage
                  name="founder-desk" w={900} widths={[480, 720, 900, 1200]}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  width={1200} height={900}
                  alt="A StackFox client working through her itemised project plan"
                />
              </div>
            </Reveal>

            <Reveal className="lg:col-span-7">
              <span className="eyebrow mb-4">Why teams pick us</span>
              <Quote size={28} className="mb-3 text-fox-500" aria-hidden />
              <blockquote className="font-display text-display-sm text-warm-900">
                "I priced the whole build in an afternoon, sent the list, and had a
                call booked by the next morning. No back-and-forth, no guessing."
              </blockquote>
              <p className="mt-4 text-body-sm text-warm-600">
                Neha R. · founder, D2C skincare · shipped a storefront + subscriptions in 6 weeks
              </p>

              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-warm-200 pt-6 text-body-sm text-warm-600">
                <span className="inline-flex items-center gap-2"><Shield size={15} className="text-sage-600" /> GST registered</span>
                <span className="inline-flex items-center gap-2"><Check size={15} className="text-sage-600" /> NDA on request</span>
                <span className="inline-flex items-center gap-2"><Check size={15} className="text-sage-600" /> ISO 27001 aligned</span>
                <span className="inline-flex items-center gap-2"><Zap size={15} className="text-fox-500" /> 24-hour response</span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Closing CTA is the Footer's own band. */}
      <FoxBot />
    </>
  );
}

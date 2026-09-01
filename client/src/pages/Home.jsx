import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, ShoppingCart, Globe, Smartphone, Brain, Zap, Palette, Server,
  Cloud, TrendingUp, MessageCircle, Box, Wrench, Code2, Check, Star, Shield,
  Search, Layers, PhoneCall,
} from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { BrandLogo } from '@components/ui/BrandLogo';
import { FoxBot } from '@components/ui/FoxBot';
import { fadeUp, fade, stagger, revealOnScroll, inView } from '@components/motion';
import SF_DATA from '@data/stackfox-data.json';

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

/* Soft warm backdrop for the hero — replaces the old decorative circles. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,77,0,0.10), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle at 60% 40%, rgba(91,138,114,0.10), transparent 70%)' }}
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

  const categories = SF_DATA.categories || [];
  const serviceCount = (SF_DATA.services || []).length;

  return (
    <>
      {/* ── 1 · Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-warm-white">
        <HeroBackdrop />
        <div className="container-fx relative py-14 sm:py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <motion.div
              className="lg:col-span-6 xl:col-span-7"
              variants={stagger} initial="hidden" animate="show"
            >
              <motion.span variants={fadeUp} className="chip-sage mb-6">
                <Zap size={14} className="text-sage-600" /> 240 services · one live total
              </motion.span>
              <motion.h1
                variants={fadeUp}
                className="text-warm-900"
                style={{ fontSize: 'clamp(2.35rem, 6vw, 3.5rem)', lineHeight: 1.05, letterSpacing: '-0.025em' }}
              >
                Build anything.<br />
                Price <span className="italic text-fox-600">every</span> piece.
              </motion.h1>
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

              <motion.div variants={fade} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-warm-200 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {[11, 12, 13, 14].map((i) => (
                      <img key={i} src={`https://i.pravatar.cc/72?u=${i}`} alt=""
                        className="h-8 w-8 rounded-full border-2 border-warm-white object-cover" />
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

            {/* Itemised quote card */}
            <motion.div
              className="lg:col-span-6 xl:col-span-5"
              variants={fade} initial="hidden" animate="show"
            >
              <div className="rounded-md border border-warm-200 bg-white p-5 shadow-lg sm:p-6">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-title text-warm-900">Your project, itemised</h2>
                  <span className="rounded-sm bg-warm-50 px-2 py-1 font-mono text-[11px] text-warm-400">stackfox.in/builder</span>
                </div>
                <p className="mb-4 text-caption text-warm-500">Indicative pricing · final quote after a free call</p>

                <div className="space-y-2">
                  {chips.map((c) => {
                    const on = picked.includes(c.id);
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggle(c.id)}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors duration-short ${
                          on
                            ? 'border-sage-200 bg-sage-50'
                            : 'border-warm-200 bg-warm-white hover:border-warm-300'
                        }`}
                      >
                        <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-sm ${on ? 'bg-sage-100 text-sage-700' : 'bg-white text-warm-400'}`}>
                          {on ? <Check size={13} /> : <Icon size={13} />}
                        </span>
                        <span className="flex-1 text-body-sm font-medium text-warm-800">{c.label}</span>
                        <span className={`price-tag text-body-sm ${on ? 'text-warm-900' : 'text-warm-400'}`}>{inr(c.price)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-1.5 border-t border-warm-200 pt-4 text-body-sm text-warm-500">
                  <div className="flex justify-between"><span>Subtotal · {picked.length} pieces</span><span className="price-tag">{inr(subtotal)}</span></div>
                  <div className="flex justify-between"><span>GST 18%</span><span className="price-tag">{inr(gst)}</span></div>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t-2 border-warm-900 pt-3">
                  <span className="text-title text-warm-900">Total</span>
                  <motion.span
                    key={total}
                    initial={{ opacity: 0.5, y: -3 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                    className="font-display text-2xl font-bold tabular-nums tracking-tight text-warm-900"
                  >
                    {inr(total)}
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
        <div className="container-fx">
          <motion.div {...revealOnScroll} className="max-w-xl">
            <span className="eyebrow mb-4">One step at a time</span>
            <h2 className="text-3xl text-warm-900 md:text-display-lg">How it works, in three steps</h2>
            <p className="mt-4 text-body-lg text-warm-600">
              No lengthy proposals. Browse, build a plan, and book a call when it looks right.
            </p>
          </motion.div>

          <motion.div
            variants={stagger} initial="hidden" whileInView="show" viewport={inView}
            className="mt-12 grid gap-5 md:grid-cols-3"
          >
            {STEPS.map((s, i) => (
              <motion.div key={s.title} variants={fadeUp} className="rounded-md border border-warm-200 bg-warm-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-pill bg-sage-50 font-mono text-sm text-sage-700">{i + 1}</span>
                  <s.icon size={18} className="text-warm-400" />
                </div>
                <h3 className="text-title text-warm-900">{s.title}</h3>
                <p className="mt-1.5 text-body-sm text-warm-600">{s.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 3 · Browse the catalog ───────────────────────────── */}
      <section className="section-padding bg-warm-white" id="services">
        <div className="container-fx">
          <motion.div {...revealOnScroll} className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
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
          </motion.div>

          <motion.div
            variants={stagger} initial="hidden" whileInView="show" viewport={inView}
            className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {categories.map((cat) => {
              const Icon = iconMap[cat.icon] || Globe;
              const count = (SF_DATA.services || []).filter((s) => s.catId === cat.id).length;
              return (
                <motion.div key={cat.id} variants={fadeUp}>
                  <Link
                    to={`/builder?category=${cat.id}`}
                    className="group flex h-full flex-col rounded-md border border-warm-200 bg-white p-5 shadow-sm transition-transform duration-short hover:-translate-y-1 hover:shadow-md"
                  >
                    <span className="mb-4 grid h-10 w-10 place-items-center rounded-sm bg-warm-50 text-warm-500 transition-colors group-hover:bg-fox-50 group-hover:text-fox-600">
                      <Icon size={18} />
                    </span>
                    <h3 className="text-body-md font-semibold text-warm-900">{cat.name}</h3>
                    <p className="mt-0.5 text-body-sm text-sage-700">{count} pieces</p>
                    <p className="mt-2 hidden text-body-sm leading-snug text-warm-500 sm:line-clamp-2">{cat.description}</p>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── 4 · Proof ────────────────────────────────────────── */}
      <section className="border-y border-warm-200 bg-white py-10">
        <div className="container-fx">
          <motion.div {...revealOnScroll} className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-body-sm text-warm-500">
            <span className="inline-flex items-center gap-2"><Shield size={15} className="text-warm-400" /> GST registered</span>
            <span className="inline-flex items-center gap-2"><Check size={15} className="text-sage-600" /> NDA on request</span>
            <span className="inline-flex items-center gap-2"><Check size={15} className="text-sage-600" /> ISO 27001 aligned</span>
            <span className="inline-flex items-center gap-2"><Zap size={15} className="text-fox-500" /> 24-hour response</span>
          </motion.div>
        </div>
      </section>

      {/* Closing CTA is the Footer's own band — no need to repeat it here. */}
      <FoxBot />
    </>
  );
}

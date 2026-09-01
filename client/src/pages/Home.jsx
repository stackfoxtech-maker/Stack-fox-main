import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@lib/api';
import useAuthStore from '@store/authStore';
import {
  ArrowRight, ShoppingCart, Cpu, Rocket, Shield, Globe, Smartphone, Brain, Zap,
  Palette, Server, Cloud, TrendingUp, MessageCircle, Box, Wrench, Star,
  Check, Sparkles, Briefcase, Gauge, Lock, Heart, Code2, ChevronDown,
  ChevronRight, Quote, Calendar, Headphones, Award, IndianRupee, Plus, Minus,
  Bot, Edit3
} from 'lucide-react';
import { usePageTitle, useScrollReveal } from '@lib/hooks';
import { Section, SectionHeading } from '@components/ui/Primitives';
import { BrandLogo } from '@components/ui/BrandLogo';
import { FoxBot } from '@components/ui/FoxBot';
import SF_DATA from '@data/stackfox-data.json';

const iconMap = {
  globe: Globe, smartphone: Smartphone, brain: Brain, zap: Zap,
  'shopping-cart': ShoppingCart, palette: Palette, server: Server, cloud: Cloud,
  shield: Shield, 'trending-up': TrendingUp, 'message-circle': MessageCircle,
  box: Box, wrench: Wrench, code: Code2,
};

const TECH = [
  'React', 'Next.js', 'Node.js', 'Python', 'Flutter', 'Swift', 'PostgreSQL',
  'MongoDB', 'AWS', 'GCP', 'Docker', 'Kubernetes', 'Figma', 'Shopify',
  'Stripe', 'Razorpay', 'Firebase', 'OpenAI', 'LangChain', 'Redis',
  'GraphQL', 'Zapier',
];

const TRUST_BADGES = [
  { icon: Shield, label: 'GST Registered', sub: '27AAACS1234A1Z5' },
  { icon: Lock, label: 'NDA on Request', sub: 'Your IP is safe' },
  { icon: Award, label: 'ISO 27001 Aligned', sub: 'Security first' },
  { icon: Headphones, label: '24h Response', sub: 'Always on' },
];

const TRADITIONAL = [
  { label: 'Discovery & docs', amt: 50000 },
  { label: 'Design "package"', amt: 120000 },
  { label: 'Development "package"', amt: 250000 },
  { label: 'Project management fee', amt: 60000 },
  { label: 'Testing & QA', amt: 50000 },
  { label: 'Hidden change requests', amt: 70000 },
];

const STACKFOX = [
  { label: 'Custom website (5 pages)', amt: 35000 },
  { label: 'Logo + brand guidelines', amt: 18000 },
  { label: 'CMS for blog', amt: 22000 },
  { label: 'Razorpay payment gateway', amt: 12000 },
  { label: 'SEO setup + analytics', amt: 15000 },
  { label: 'Hosting & SSL (1 year)', amt: 8000 },
];

const RevealDiv = ({ children, className, delay = 0 }) => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        } ${className || ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const inr = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n);

/* ── Pill label component ─────────────────────────────────────────── */
const EyebrowLabel = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-fox-500 mb-4">
    <span className="w-4 h-px bg-fox-500 inline-block" />
    {children}
  </span>
);

export default function Home() {
  usePageTitle(null);

  const [activeTab, setActiveTab] = useState('all');
  const [faqOpen, setFaqOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const [posts, setPosts] = useState([]);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchLatestPosts = async () => {
      try {
        const res = await api.get('/blog?limit=3&featured=true');
        setPosts(res.data.data || []);
      } catch (err) {
        // Fallback to static data if API fails or no posts yet
        setPosts((SF_DATA.resources || []).slice(0, 3));
      }
    };
    fetchLatestPosts();
  }, []);

  const sampleChips = useMemo(() => [
    { id: 'c1', icon: Globe, label: 'Custom Website (5 pages)', price: 35000 },
    { id: 'c2', icon: Palette, label: 'Logo + Brand Kit', price: 18000 },
    { id: 'c3', icon: ShoppingCart, label: 'Razorpay Checkout', price: 12000 },
    { id: 'c4', icon: () => <BrandLogo size={18} />, label: 'AI Chatbot (FoxBot)', price: 35000 },
    { id: 'c5', icon: TrendingUp, label: 'SEO Starter Pack', price: 15000 },
    { id: 'c6', icon: Cloud, label: 'Cloud Hosting (1yr)', price: 8000 },
  ], []);

  const [picked, setPicked] = useState(['c1', 'c2', 'c3']);
  const togglePick = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const subtotal = sampleChips.filter((c) => picked.includes(c.id)).reduce((s, c) => s + c.price, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const copyRef = () => {
    navigator.clipboard.writeText('stackfox.in/ref/SF' + Math.random().toString(36).substring(2, 7).toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const featuredPackages = (SF_DATA.packages || []).slice(0, 3);
  const featuredIndustries = (SF_DATA.industryBundles || []).slice(0, 4);
  const openJobs = (SF_DATA.careers?.openPositions || []).slice(0, 3);

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          HERO — split layout with oversized number accent
          ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-warm-white flex items-center lg:min-h-[92vh]">
        {/* Geometric background accents — desktop only; on mobile they crowd the
            stacked content and add nothing. */}
        <div className="absolute top-0 right-0 w-[55%] h-full bg-warm-50 clip-hero hidden lg:block" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-fox-500/[0.04] -translate-x-1/2 translate-y-1/2 hidden lg:block" />
        <div className="absolute top-24 right-24 w-40 h-40 rounded-full border border-fox-200/50 hidden lg:block" />
        <div className="absolute top-32 right-32 w-20 h-20 rounded-full border border-fox-300/30 hidden lg:block" />

        <style>{`
          .clip-hero { clip-path: polygon(8% 0%, 100% 0%, 100% 100%, 0% 100%); }
          @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .animate-marquee { animation: marquee 35s linear infinite; }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          .anim-1 { animation: fadeUp 0.7s ease forwards; }
          .anim-2 { animation: fadeUp 0.7s 0.1s ease both; }
          .anim-3 { animation: fadeUp 0.7s 0.2s ease both; }
          .anim-4 { animation: fadeUp 0.7s 0.3s ease both; }
          .anim-5 { animation: fadeUp 0.7s 0.4s ease both; }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          .anim-card { animation: scaleIn 0.6s 0.3s ease both; }
          .step-line::before {
            content: '';
            position: absolute;
            left: 27px;
            top: 56px;
            bottom: -24px;
            width: 1px;
            background: repeating-linear-gradient(to bottom, #FF4D00 0, #FF4D00 4px, transparent 4px, transparent 10px);
          }
        `}</style>

        <div className="container-fx relative py-12 sm:py-20 md:py-32 w-full">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* Left */}
            <div className="lg:col-span-6 xl:col-span-7">
              <div className="anim-1">
                <EyebrowLabel>
                  <Sparkles size={10} /> 240+ Services · 13 Domains · Built for India
                </EyebrowLabel>
              </div>

              <h1 className="anim-2 font-black text-warm-900 leading-[1.05] mb-6" style={{ fontSize: 'clamp(2.6rem, 5vw, 4.2rem)', letterSpacing: '-0.03em' }}>
                Build anything.<br />
                <span className="relative">
                  Price{' '}
                  <span className="text-fox-500 italic">every</span>{' '}
                  piece.
                  <span className="absolute -bottom-2 left-0 w-full h-0.5 bg-fox-500/20" />
                </span>
              </h1>

              <p className="anim-3 text-warm-500 leading-relaxed mb-10 max-w-lg" style={{ fontSize: '1.0625rem' }}>
                India's first Amazon-style tech agency. Browse 240+ individually
                priced services across web, mobile, AI, e-commerce, cloud & more.
                Pick what you need, see your total live, ship fast.
              </p>

              <div className="anim-4 flex flex-wrap gap-3 mb-12">
                <Link to="/builder" className="btn-fox text-sm px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2">
                  Start Building <ArrowRight size={16} />
                </Link>
                <Link to="/packages" className="btn-outline text-sm px-6 py-3 rounded-xl font-semibold">
                  View Packages
                </Link>
                <Link to="/contact" className="btn-ghost text-sm px-5 py-3 rounded-xl">
                  Book free call
                </Link>
              </div>

              {/* Dynamic Activity Row */}
              <div className="anim-5 flex flex-wrap items-center gap-8 pt-8 border-t border-warm-150">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-warm-100 flex items-center justify-center overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?u=${i + 10}`} alt="Active Client" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-warm-900 flex items-center justify-center text-[10px] font-bold text-white z-10">
                      +120
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-warm-900 tracking-tight leading-none mb-1">120+ Trusted Partners</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-warm-400 font-medium">
                      <Star size={10} className="fill-fox-500 text-fox-500" />
                      4.9/5 Average Rating
                    </div>
                  </div>
                </div>

                <div className="h-10 w-px bg-warm-150 hidden md:block" />

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-fox-50 flex items-center justify-center text-fox-500 border border-fox-100">
                      <Zap size={18} fill="currentColor" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-warm-900 tracking-tight leading-none mb-1">Live Pipeline</div>
                    <div className="text-[10px] text-warm-400 font-medium uppercase tracking-wider">
                      8 Sprints Active Now
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — floating builder card */}
            <div className="lg:col-span-6 xl:col-span-5">
              <div className="anim-card">
                <div className="bg-white rounded-2xl border border-warm-200 shadow-[0_8px_60px_rgba(0,0,0,0.08)] p-6 relative">
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-fox-500 animate-pulse" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-fox-500">Live Preview</span>
                      </div>
                      <h3 className="text-sm font-bold text-warm-900">Your project, itemized</h3>
                    </div>
                    <span className="text-[10px] text-warm-300 font-mono bg-warm-50 px-2 py-1 rounded-lg">stackfox.in/builder</span>
                  </div>

                  {/* Service chips */}
                  <div className="space-y-2 mb-5 max-h-[272px] overflow-y-auto pr-0.5">
                    {sampleChips.map((c) => {
                      const on = picked.includes(c.id);
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          onClick={() => togglePick(c.id)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 text-left ${on
                              ? 'bg-fox-500 border-fox-500 text-white shadow-[0_2px_12px_rgba(255,77,0,0.25)]'
                              : 'bg-warm-50 border-warm-150 hover:border-warm-300 text-warm-700 hover:bg-white'
                            }`}
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? 'bg-white/20' : 'bg-white'}`}>
                            {on ? <Check size={13} className="text-white" /> : <Icon size={13} className="text-warm-500" />}
                          </span>
                          <span className="flex-1 text-xs font-medium">{c.label}</span>
                          <span className={`font-mono text-xs font-semibold ${on ? 'text-white/90' : 'text-warm-600'}`}>
                            {inr(c.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Running total */}
                  <div className="bg-warm-50 rounded-xl p-3.5 space-y-2 mb-4">
                    <div className="flex justify-between text-xs text-warm-500">
                      <span>Subtotal ({picked.length} pieces)</span>
                      <span className="font-mono">{inr(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-warm-500">
                      <span>GST (18%)</span>
                      <span className="font-mono">{inr(gst)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-warm-200">
                      <span className="text-xs font-bold text-warm-800">Total</span>
                      <span className="font-mono text-xl font-black text-warm-900">{inr(total)}</span>
                    </div>
                  </div>

                  <Link to="/builder" className="btn-fox w-full justify-center text-sm py-2.5 rounded-xl font-semibold">
                    Build the real thing <ArrowRight size={14} />
                  </Link>
                  <p className="text-[10px] text-warm-600 text-center mt-2.5 font-medium">
                    Indicative pricing · Final quote after free call
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TRUST STRIP
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-900 border-b border-warm-800">
        <div className="container-fx py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-warm-700">
            {TRUST_BADGES.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-6 first:pl-0 last:pr-0">
                  <div className="w-8 h-8 rounded-lg bg-fox-500/10 text-fox-400 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-warm-100">{b.label}</div>
                    <div className="text-[10px] text-warm-500 font-mono">{b.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SERVICES GRID
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-white py-20 md:py-28" id="services">
        <div className="container-fx">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <EyebrowLabel>Services</EyebrowLabel>
              <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
                 13 domains.<br />240+ pieces.
              </h2>
            </div>
            <p className="text-warm-500 text-sm max-w-xs md:text-right leading-relaxed">
              Every service broken into individually priced atomic pieces. Pick what you need, skip what you don't.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {(SF_DATA.categories || []).map((cat, i) => {
              const Icon = iconMap[cat.icon] || Globe;
              const count = (SF_DATA.services || []).filter((s) => s.catId === cat.id).length;
              return (
                <RevealDiv key={cat.id} delay={i * 35}>
                  <Link
                    to={`/builder?category=${cat.id}`}
                    className="group relative bg-warm-50 hover:bg-white border border-warm-150 hover:border-fox-200 rounded-2xl p-5 h-full block transition-all duration-300 hover:shadow-[0_4px_24px_rgba(255,77,0,0.08)]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-warm-150 group-hover:border-fox-200 group-hover:bg-fox-50 flex items-center justify-center mb-4 transition-all">
                      <Icon size={18} className="text-warm-600 group-hover:text-fox-500 transition-colors" />
                    </div>
                    <h3 className="text-xs font-bold text-warm-900 mb-1 leading-tight">{cat.name}</h3>
                    <p className="text-[10px] text-fox-500 font-semibold mb-1.5">{count} pieces</p>
                    <p className="text-[10px] text-warm-400 leading-relaxed line-clamp-2 hidden sm:block">
                      {cat.description}
                    </p>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={12} className="text-fox-400" />
                    </div>
                  </Link>
                </RevealDiv>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link to="/catalog" className="btn-outline text-sm px-6 py-2.5 rounded-xl inline-flex items-center gap-2">
               Browse all 240+ services <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TECH MARQUEE
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-50 border-y border-warm-150 py-7 overflow-hidden">
        <div className="mb-3 text-center">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-warm-400">
            Technologies we master
          </span>
        </div>
        <div className="relative">
          <div className="flex gap-2.5 animate-marquee whitespace-nowrap">
            {[...TECH, ...TECH].map((t, i) => (
              <span
                key={i}
                className="flex-shrink-0 px-4 py-1.5 rounded-full bg-white border border-warm-200 text-warm-600 text-xs font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS — vertical timeline style
          ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28" id="how">
        <div className="container-fx">
          <div className="max-w-lg mb-14">
            <EyebrowLabel>Process</EyebrowLabel>
            <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
              Brief to launch<br />in 4 steps.
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-0 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-[27px] left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-warm-150" />
            {[
              { icon: Globe, step: '01', title: 'Discovery', desc: 'Free 30-min call. We map your needs, recommend tech stack, and estimate cost & timeline. Zero obligation.' },
              { icon: Palette, step: '02', title: 'Design', desc: 'Wireframes → hi-fi mockups → clickable Figma prototype. You approve every screen before code starts.' },
              { icon: Cpu, step: '03', title: 'Build', desc: 'Agile sprints with weekly demos. CI/CD pipeline, automated testing. You see real progress every week.' },
              { icon: Rocket, step: '04', title: 'Launch', desc: 'Deployment, monitoring, docs & handoff. Then ongoing support — we don\'t disappear after delivery.' },
            ].map((step, i) => (
              <RevealDiv key={i} delay={i * 120}>
                <div className="relative px-6 pb-8 md:pb-0">
                  <div className="w-14 h-14 rounded-2xl bg-fox-500 text-white flex items-center justify-center mb-6 relative z-10">
                    <step.icon size={22} />
                  </div>
                  <div className="text-[10px] font-black tracking-[0.15em] text-fox-500 mb-2">STEP {step.step}</div>
                  <h3 className="text-base font-black text-warm-900 mb-3">{step.title}</h3>
                  <p className="text-xs text-warm-500 leading-relaxed">{step.desc}</p>
                </div>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          INDUSTRY BUNDLES
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-50 py-20 md:py-28" id="industries">
        <div className="container-fx">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <EyebrowLabel>Industries</EyebrowLabel>
              <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
                Hand-picked bundles<br />for your sector.
              </h2>
            </div>
            <Link to="/industries" className="btn-ghost text-sm inline-flex items-center gap-2">
              See all {(SF_DATA.industryBundles || []).length} bundles <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredIndustries.map((bundle, i) => (
              <RevealDiv key={bundle.id} delay={i * 80}>
                <Link
                  to={`/industries#${bundle.id}`}
                  className="group bg-white border border-warm-150 hover:border-fox-300 rounded-2xl p-6 h-full flex flex-col transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,77,0,0.06)]"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-black text-warm-900 mb-1.5">{bundle.name}</h3>
                      <p className="text-xs text-warm-500 leading-relaxed">{bundle.description}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-warm-50 group-hover:bg-fox-50 flex items-center justify-center flex-shrink-0 transition-colors">
                      <ChevronRight size={14} className="text-warm-400 group-hover:text-fox-500 transition-colors" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {(bundle.features || []).slice(0, 3).map((f, j) => (
                      <span key={j} className="text-[10px] px-2.5 py-1 rounded-full bg-warm-50 border border-warm-150 text-warm-600 font-medium">
                        {f}
                      </span>
                    ))}
                    {(bundle.features || []).length > 3 && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-warm-50 border border-warm-150 text-warm-400">
                        +{bundle.features.length - 3} more
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-baseline justify-between pt-4 border-t border-warm-100">
                    <span className="text-[11px] text-warm-400 uppercase tracking-wide font-medium">Starting from</span>
                    <span className="font-mono text-2xl font-black text-warm-900">{inr(bundle.price)}</span>
                  </div>
                </Link>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRICING TRANSPARENCY — side-by-side comparison
          ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28" id="transparency">
        <div className="container-fx">
          <div className="max-w-xl mb-12">
            <EyebrowLabel>Transparency</EyebrowLabel>
            <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
              No black boxes.<br />Ever.
            </h2>
            <p className="text-warm-500 text-sm mt-4 leading-relaxed">
              See exactly where your rupee goes. Same project, two ways to quote it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Traditional */}
            <RevealDiv>
              <div className="rounded-2xl border-2 border-warm-150 p-6 md:p-8 h-full relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-warm-200" />
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-warm-500 bg-warm-50 border border-warm-150 px-3 py-1.5 rounded-full mb-5">
                  Traditional Agency
                </div>
                <h3 className="text-lg font-black text-warm-800 mb-1">Black-box "package"</h3>
                <p className="text-xs text-warm-400 mb-6">Vague line items. Hidden fees show up later.</p>
                <div className="space-y-3 mb-6">
                  {TRADITIONAL.map((row, i) => (
                    <div key={i} className="flex justify-between items-center text-sm pb-3 border-b border-warm-100 last:border-0 last:pb-0">
                      <span className="text-warm-500">{row.label}</span>
                      <span className="font-mono text-warm-600 font-semibold">{inr(row.amt)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-baseline py-4 border-t-2 border-warm-200">
                  <span className="text-sm font-bold text-warm-700">Total</span>
                  <span className="font-mono text-2xl font-black text-warm-800">
                    {inr(TRADITIONAL.reduce((s, r) => s + r.amt, 0))}
                  </span>
                </div>
                <p className="text-[10px] text-warm-400 mt-2">
                  + Surprise change requests · 8-12 week delivery · Limited revisions
                </p>
              </div>
            </RevealDiv>

            {/* StackFox */}
            <RevealDiv delay={120}>
              <div className="rounded-2xl border-2 border-fox-500 p-6 md:p-8 h-full relative overflow-hidden bg-fox-500/[0.015]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-fox-500" />
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-fox-600 bg-fox-50 border border-fox-200 px-3 py-1.5 rounded-full mb-5">
                  StackFox · Itemized
                </div>
                <h3 className="text-lg font-black text-warm-900 mb-1">Every piece priced</h3>
                <p className="text-xs text-warm-500 mb-6">Same scope. Real pieces. Real prices.</p>
                <div className="space-y-3 mb-6">
                  {STACKFOX.map((row, i) => (
                    <div key={i} className="flex justify-between items-center text-sm pb-3 border-b border-fox-100/60 last:border-0 last:pb-0">
                      <span className="text-warm-700 flex items-center gap-2">
                        <Check size={12} className="text-fox-500 flex-shrink-0" />
                        {row.label}
                      </span>
                      <span className="font-mono text-warm-900 font-bold">{inr(row.amt)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-baseline py-4 border-t-2 border-fox-200">
                  <span className="text-sm font-bold text-warm-800">Total</span>
                  <span className="font-mono text-2xl font-black text-fox-500">
                    {inr(STACKFOX.reduce((s, r) => s + r.amt, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Zap size={11} className="text-fox-500" />
                  <p className="text-[10px] text-fox-600 font-semibold">
                    Save {inr(TRADITIONAL.reduce((s, r) => s + r.amt, 0) - STACKFOX.reduce((s, r) => s + r.amt, 0))}
                    {' · '}4–6 week delivery · Unlimited sprint revisions
                  </p>
                </div>
              </div>
            </RevealDiv>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PACKAGES PREVIEW
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-50 py-20 md:py-28" id="packages">
        <div className="container-fx">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <EyebrowLabel>Packages</EyebrowLabel>
              <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
                Pre-built solutions,<br />better value.
              </h2>
            </div>
            <p className="text-warm-500 text-sm max-w-xs md:text-right leading-relaxed">
              Curated bundles for the most common use cases. Save up to 30%.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredPackages.map((pkg, i) => (
              <RevealDiv key={pkg.id} delay={i * 80}>
                <div className={`bg-white rounded-2xl p-6 h-full flex flex-col relative transition-all ${pkg.popular
                    ? 'border-2 border-fox-500 shadow-[0_8px_40px_rgba(255,77,0,0.12)]'
                    : 'border border-warm-150 hover:border-warm-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
                  }`}>
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-fox-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                        Most popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-base font-black text-warm-900 mb-2 mt-2">{pkg.name}</h3>
                  <p className="text-xs text-warm-500 mb-5 flex-1 leading-relaxed">{pkg.description}</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-mono text-3xl font-black text-warm-900">{inr(pkg.price)}</span>
                  </div>
                  {pkg.savings > 0 && (
                    <p className="text-[11px] text-fox-500 font-bold mb-4">You save {inr(pkg.savings)}</p>
                  )}
                  <p className="text-[11px] text-warm-400 mb-5">{pkg.items.length} services included</p>
                  <Link
                    to="/packages"
                    className={`w-full text-center py-2.5 text-sm rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition-all ${pkg.popular
                        ? 'btn-fox'
                        : 'bg-warm-50 border border-warm-200 text-warm-700 hover:bg-warm-100'
                      }`}
                  >
                    View details <ArrowRight size={13} />
                  </Link>
                </div>
              </RevealDiv>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/packages" className="btn-ghost text-sm inline-flex items-center gap-2">
              View all {(SF_DATA.packages || []).length} packages <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CAREERS
          ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28" id="careers">
        <div className="container-fx">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <EyebrowLabel>Careers</EyebrowLabel>
              <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
                Build StackFox<br />with us.
              </h2>
            </div>
            <p className="text-warm-500 text-sm">
              Hiring {(SF_DATA.careers?.openPositions || []).length} roles across engineering, design & growth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {openJobs.map((job, i) => (
              <RevealDiv key={job.id} delay={i * 80}>
                <Link
                  to={`/careers#${job.id}`}
                  className="group bg-warm-50 hover:bg-white border border-warm-150 hover:border-fox-200 rounded-2xl p-5 h-full flex flex-col transition-all duration-300 hover:shadow-[0_4px_20px_rgba(255,77,0,0.06)]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] font-bold tracking-widest uppercase text-fox-600 bg-fox-50 border border-fox-100 px-2.5 py-1 rounded-full">
                      {job.type}
                    </span>
                    <Briefcase size={14} className="text-warm-300" />
                  </div>
                  <h3 className="text-sm font-black text-warm-900 mb-3 group-hover:text-fox-600 transition-colors leading-snug">
                    {job.title}
                  </h3>
                  <div className="space-y-1.5 text-[11px] text-warm-500 mb-4">
                    <div className="flex items-center gap-1.5"><Globe size={10} /> {job.location}</div>
                    <div className="flex items-center gap-1.5"><Calendar size={10} /> {job.experience}</div>
                    <div className="flex items-center gap-1.5"><IndianRupee size={10} /> {job.salary}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-warm-100">
                    {(job.skills || []).slice(0, 3).map((s) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-warm-150 text-warm-600">
                        {s}
                      </span>
                    ))}
                  </div>
                </Link>
              </RevealDiv>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/careers" className="btn-outline text-sm px-6 py-2.5 rounded-xl inline-flex items-center gap-2">
              See all open positions <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          WHY STACKFOX — bold stat grid
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-900 py-20 md:py-28">
        <div className="container-fx">
          <div className="max-w-lg mb-12">
            <EyebrowLabel>Why StackFox</EyebrowLabel>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              Why {SF_DATA.company?.stats?.[1]?.value || '120+'} businesses<br />chose us.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: Gauge, title: 'Full transparency', desc: 'Every piece priced. No hidden costs. No surprises after signing.' },
              { icon: Zap, title: '2× faster delivery', desc: 'AI-assisted dev pipeline ships twice as fast as traditional agencies.' },
              { icon: IndianRupee, title: 'Save 40%', desc: 'Granular pricing means you only pay for what you actually need.' },
              { icon: Lock, title: 'Zero lock-in', desc: 'You own 100% of the code. Full handoff. Leave anytime.' },
              { icon: Gauge, title: 'Live dashboard', desc: 'Real-time progress bars, milestones & weekly demo recordings.' },
              { icon: Star, title: '4.9★ rated', desc: 'Verified reviews across Google, Clutch & client testimonials.' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <RevealDiv key={i} delay={i * 50}>
                  <div className="bg-warm-800/50 border border-warm-700 rounded-2xl p-5 h-full hover:border-fox-500/40 transition-all">
                    <div className="w-9 h-9 rounded-xl bg-fox-500/10 text-fox-400 flex items-center justify-center mb-4">
                      <Icon size={16} />
                    </div>
                    <h3 className="text-sm font-black text-warm-100 mb-2">{c.title}</h3>
                    <p className="text-xs text-warm-500 leading-relaxed">{c.desc}</p>
                  </div>
                </RevealDiv>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TESTIMONIALS
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-50 py-20 md:py-28" id="testimonials">
        <div className="container-fx">
          <div className="max-w-lg mb-12">
            <EyebrowLabel>Testimonials</EyebrowLabel>
            <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight">
              What our clients say.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(SF_DATA.testimonials || []).slice(0, 3).map((t, i) => (
              <RevealDiv key={i} delay={i * 100}>
                <div className="bg-white border border-warm-150 rounded-2xl p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: t.rating || 5 }).map((_, j) => (
                      <Star key={j} size={13} className="fill-fox-500 text-fox-500" />
                    ))}
                  </div>
                  <p className="text-sm text-warm-700 mb-5 flex-1 leading-relaxed">
                    "{t.text}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-warm-100">
                    <div className="w-8 h-8 rounded-full bg-fox-50 border border-fox-100 flex items-center justify-center flex-shrink-0 text-[11px] font-black text-fox-600">
                      {t.name?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-warm-900">{t.name}</p>
                      <p className="text-[10px] text-warm-500">
                        {t.role}{t.company ? `, ${t.company}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FAQ — clean accordion
          ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28" id="faq">
        <div className="container-fx">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-4">
              <div className="sticky top-28">
                <EyebrowLabel>FAQ</EyebrowLabel>
                <h2 className="text-3xl font-black text-warm-900 tracking-tight leading-tight mb-4">
                  Frequently asked questions.
                </h2>
                <p className="text-sm text-warm-500 leading-relaxed mb-6">
                  Can't find what you're looking for?
                </p>
                <Link to="/contact" className="btn-outline text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2">
                  Contact us <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="md:col-span-8">
              {(SF_DATA.faq || []).slice(0, 8).map((item, i) => (
                <RevealDiv key={i} delay={i * 25}>
                  <div className={`border-b border-warm-100 ${i === 0 ? 'border-t' : ''}`}>
                    <button
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                      className="w-full flex justify-between items-center py-5 text-left gap-6 group"
                    >
                      <span className={`text-sm font-bold transition-colors ${faqOpen === i ? 'text-fox-600' : 'text-warm-900'}`}>
                        {item.q}
                      </span>
                      <span className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${faqOpen === i ? 'bg-fox-500 border-fox-500' : 'border-warm-200 group-hover:border-fox-300'
                        }`}>
                        {faqOpen === i
                          ? <Minus size={11} className="text-white" />
                          : <Plus size={11} className="text-warm-500" />}
                      </span>
                    </button>
                    {faqOpen === i && (
                      <div className="pb-5 text-sm text-warm-500 leading-relaxed pr-10">
                        {item.a}
                      </div>
                    )}
                  </div>
                </RevealDiv>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          REFERRAL
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-50 py-20" id="referral">
        <div className="container-fx">
          <RevealDiv>
            <div className="bg-white border border-warm-150 rounded-2xl p-8 md:p-12 relative overflow-hidden">
              {/* Decorative circle */}
              <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-fox-50 border border-fox-100" />
              <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-fox-100/50" />

              <div className="relative grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <EyebrowLabel>
                    <Heart size={10} /> Refer & Earn
                  </EyebrowLabel>
                  <h3 className="text-2xl md:text-3xl font-black text-warm-900 tracking-tight mb-3">
                    Earn 10% on every referral.
                  </h3>
                  <p className="text-sm text-warm-600 leading-relaxed mb-3">
                    Know someone who needs a website, app or AI tool? Refer them and earn{' '}
                    <span className="text-fox-500 font-bold">10% of project value</span>{' '}
                    in cash. No cap. No expiry.
                  </p>
                  <p className="text-[11px] text-warm-400 leading-relaxed">
                    Unique link · 30-day attribution · Payout after delivery.
                    Self-referrals & duplicates auto-rejected.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="font-mono text-sm text-fox-600 bg-fox-50 border border-fox-100 px-5 py-3.5 rounded-xl text-center font-semibold">
                    stackfox.in/ref/YOUR_CODE
                  </div>
                  <button onClick={copyRef} className="btn-fox py-3 rounded-xl font-bold justify-center text-sm">
                    {copied ? (
                      <><Check size={14} /> Copied!</>
                    ) : 'Copy referral link'}
                  </button>
                </div>
              </div>
            </div>
          </RevealDiv>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          LATEST INSIGHTS
          ══════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28" id="blog">
        <div className="container-fx">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <EyebrowLabel>Insights</EyebrowLabel>
              <h2 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight leading-tight">
                Latest from our<br />engineering blog.
              </h2>
            </div>
            <Link to="/resources" className="btn-ghost text-sm inline-flex items-center gap-2">
              View all articles <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <RevealDiv key={post._id || post.id} delay={i * 100}>
                <Link to={`/resources/${post.slug || post.id}`} className="group block h-full relative">
                  {isAdmin && (
                    <Link 
                      to="/app/admin/content" 
                      className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg text-fox-500 hover:scale-110 transition-transform"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit3 size={14} />
                    </Link>
                  )}
                  <div className="bg-warm-50 rounded-2xl overflow-hidden aspect-video mb-4 relative">
                    {post.coverImage ? (
                      <img 
                        src={post.coverImage} 
                        alt={post.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-fox-500/5 to-warm-900/5 group-hover:scale-110 transition-transform duration-500" />
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[9px] font-bold text-fox-600 uppercase tracking-widest border border-fox-100">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-warm-900 group-hover:text-fox-600 transition-colors mb-2 line-clamp-2 leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-[11px] text-warm-500 line-clamp-2 leading-relaxed mb-3">
                    {post.excerpt}
                  </p>
                  <span className="text-[10px] font-bold text-fox-500 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Read article <ArrowRight size={10} />
                  </span>
                </Link>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FINAL CTA — full-bleed dark section
          ══════════════════════════════════════════════════════ */}
      <section className="bg-warm-900 relative overflow-hidden py-24 md:py-32">
        {/* Large decorative fox number */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden
        >
          <img
            src="/logo.png"
            alt=""
            className="w-[30vw] h-[30vw] max-w-[360px] object-contain opacity-[0.03]"
            aria-hidden
          />
        </div>

        <div className="container-fx relative text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] uppercase text-fox-400 mb-6">
            <span className="w-6 h-px bg-fox-500" />
            Ready to build?
            <span className="w-6 h-px bg-fox-500" />
          </div>
          <h2
            className="font-black text-white mb-5 tracking-tight leading-[1.05]"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}
          >
            Build fast.<br />
            Price smart.<br />
            <span className="text-fox-500">Ship with StackFox.</span>
          </h2>
          <p className="text-warm-400 text-sm md:text-base mb-10 max-w-md mx-auto leading-relaxed">
            Free consultation · Transparent pricing · AI-first delivery.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/builder" className="btn-fox text-base px-8 py-3.5 rounded-xl font-bold inline-flex items-center gap-2">
              Start Building <ArrowRight size={17} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors text-base font-semibold"
            >
              Book free call
            </Link>
          </div>
        </div>
      </section>

      <FoxBot />
    </>
  );
}
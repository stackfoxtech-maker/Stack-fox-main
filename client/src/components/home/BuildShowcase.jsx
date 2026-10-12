import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { BuildPreview } from './BuildPreview';

const EASE = [0.2, 0.7, 0.2, 1];
const AUTO_MS = 7000; // time each tab stays up while autoplay runs
const inr = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n);

// Prices and contents are the real packages in shared/stackfox-data.json.
const BUILDS = [
  {
    key: 'website',
    stage: 'Mehta Bakery, Pune',
    tab: 'Website',
    title: 'A website that brings in customers',
    blurb: 'Professional site with CMS, blog, SEO and analytics, ready for your domain.',
    pkg: 'Business Website Package',
    price: 65000,
    savings: 27000,
    weeks: '2 to 3 weeks',
    items: [
      'Business website, 5 pages',
      'CMS you can edit yourself',
      'Blog',
      'Technical + on-page SEO',
      'Analytics and Search Console',
    ],
    cat: 'web-dev',
  },
  {
    key: 'store',
    stage: 'Greenleaf pantry store',
    tab: 'Online store',
    title: 'An online store that takes UPI on day one',
    blurb: 'A complete store with payments, reviews, coupons and analytics.',
    pkg: 'E-Commerce Launchpad',
    price: 85000,
    savings: 30000,
    weeks: '3 to 4 weeks',
    items: [
      'Storefront and catalogue',
      'UPI, cards and wallets',
      'Reviews and ratings',
      'Coupons and discounts',
      'SSL, domain and analytics',
    ],
    cat: 'ecommerce',
  },
  {
    key: 'app',
    stage: 'Live-class app for students',
    tab: 'Mobile app',
    title: 'An app on both stores, built once',
    blurb: 'Cross-platform app with push, offline mode and store submission.',
    pkg: 'Mobile App Launch Package',
    price: 110000,
    savings: 26000,
    weeks: '4 to 5 weeks',
    items: [
      'Android and iOS app',
      'App UI/UX design',
      'Push notifications',
      'Biometric login',
      'Offline mode',
    ],
    cat: 'mobile-dev',
  },
  {
    key: 'ai',
    stage: 'HealthFirst clinic assistant',
    tab: 'AI chatbot',
    title: 'An assistant that answers like your best rep',
    blurb: 'A chatbot trained on your own documents, plus search and content tools.',
    pkg: 'AI Integration Package',
    price: 90000,
    savings: 22000,
    weeks: '2 to 3 weeks',
    items: [
      'FAQ chatbot',
      'Custom GPT on your documents',
      'AI content generator',
      'Retrieval pipeline (RAG)',
    ],
    cat: 'ai-genai',
  },
  {
    key: 'growth',
    stage: 'Six months of organic growth',
    tab: 'Brand & growth',
    title: 'Get found, then get chosen',
    blurb: 'SEO, content and conversion work that grows traffic you already earn.',
    pkg: 'Digital Growth Package',
    price: 70000,
    savings: 20000,
    weeks: 'Ongoing, first results in 6 weeks',
    items: [
      'SEO audit and on-page fixes',
      'Keyword strategy',
      'Content plan',
      'Conversion optimisation',
      'Google Business profile',
    ],
    cat: 'seo-marketing',
  },
];

const DIGIT_ROWS = '0123456789'.split('');

/** Price that rolls like an odometer from the previous tab's value (digits aligned from the right). */
function Odometer({ value, from, reduce }) {
  const to = inr(value);
  const prev = inr(from);
  const shift = prev.length - to.length;
  return (
    <p
      data-price
      aria-label={to}
      className="inline-flex font-display text-4xl font-bold tabular-nums tracking-tight text-warm-900"
    >
      {to.split('').map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={i + ch} aria-hidden>
              {ch}
            </span>
          );
        }
        const before = /\d/.test(prev[i + shift] ?? '') ? Number(prev[i + shift]) : 0;
        const fromRight = to.length - 1 - i;
        return (
          <span key={fromRight} aria-hidden className="inline-block h-[1.15em] overflow-hidden">
            <motion.span
              className="flex flex-col"
              initial={{ y: `${-before * 10}%` }}
              animate={{ y: `${-Number(ch) * 10}%` }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 220, damping: 26, delay: fromRight * 0.03 }
              }
            >
              {DIGIT_ROWS.map((d) => (
                <span key={d} className="block h-[1.15em] leading-[1.15em]">
                  {d}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </p>
  );
}

/** Check mark that draws itself (pathLength), staggered per row. */
function DrawnCheck({ delay, reduce }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="shrink-0 text-sage-600" aria-hidden>
      <motion.path
        d="M3 8.5 L6.5 12 L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE, delay }}
      />
    </svg>
  );
}

/** Tabbed "what are you building?" showcase: a preview of the result, its price, and what is inside. */
export function BuildShowcase() {
  const [active, setActive] = useState(0);
  // +1 when moving forward through the tabs, -1 backward: drives the slide direction.
  const [dir, setDir] = useState(1);
  const [fromIdx, setFromIdx] = useState(0); // previous tab: the price rolls from its value
  const [replay, setReplay] = useState(0);
  const [hot, setHot] = useState(''); // feature the visitor points at, lit up in the preview
  const [auto, setAuto] = useState(true); // autoplay ends for good after any deliberate input
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const rootRef = useRef(null);
  const tabRefs = useRef([]);
  const inView = useInView(rootRef, { amount: 0.35 });
  const b = BUILDS[active];
  const last = BUILDS.length - 1;

  // Cursor parallax: the dot grid drifts slower than the preview. Mouse only.
  const px = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });
  const py = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });
  const patX = useTransform(px, (v) => v * -8);
  const patY = useTransform(py, (v) => v * -8);
  const preX = useTransform(px, (v) => v * 14);
  const preY = useTransform(py, (v) => v * 14);
  const onStageMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onStageLeave = () => {
    px.set(0);
    py.set(0);
    setHot('');
  };
  // Reverse link: pointing at a part of the preview lights the feature row that explains it.
  const onStageOver = (e) => {
    if (e.pointerType !== 'mouse') return;
    const key = e.target.closest?.('[data-hot]')?.dataset.hot;
    setHot(key ? (b.items.find((it) => it.includes(key)) ?? '') : '');
  };

  const go = (i, byUser = true) => {
    if (byUser) setAuto(false);
    if (i === active) return;
    setDir(i > active ? 1 : -1);
    setFromIdx(active);
    setActive(i);
  };

  // Autoplay: one progress value drives the bar and the advance, so pausing keeps its place.
  // It walks forward once and stops on the last tab; no endless carousel.
  const progress = useMotionValue(0);
  const running = auto && !paused && inView && !reduce && active < last;
  useEffect(() => {
    progress.set(0);
  }, [active, progress]);
  useEffect(() => {
    if (!running) return undefined;
    const c = animate(progress, 1, {
      duration: (AUTO_MS / 1000) * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => go(active + 1, false),
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, active, progress]);

  // Arrow/Home/End move focus and selection together (automatic activation).
  const onKeyDown = (e) => {
    const next = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    go(next);
    tabRefs.current[next]?.focus();
  };

  // Swipe the panel on touch to change tab (vertical scroll stays with the browser via touch-pan-y).
  const onSwipe = (e, info) => {
    if (e.pointerType === 'mouse') return;
    const { x, y } = info.offset;
    if (Math.abs(x) < 60 || Math.abs(x) < Math.abs(y) * 1.5) return;
    const next = active + (x < 0 ? 1 : -1);
    if (next >= 0 && next <= last) go(next);
  };

  // Keep the active tab visible in the phone scroller (horizontal only, never scrolls the page).
  useEffect(() => {
    const el = tabRefs.current[active];
    const row = el?.parentElement;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({
      left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [active, reduce]);

  const slide = reduce ? 0 : 36;

  return (
    <div
      ref={rootRef}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}
    >
      <div
        role="tablist"
        aria-label="What are you building?"
        onKeyDown={onKeyDown}
        className="no-scrollbar -mx-6 flex gap-1.5 overflow-x-auto px-6 py-1 [mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] sm:mx-0 sm:w-fit sm:rounded-pill sm:bg-white sm:p-1.5 sm:shadow-sm sm:ring-1 sm:ring-warm-200 sm:[mask-image:none]"
      >
        {BUILDS.map((x, i) => (
          <button
            key={x.key}
            ref={(el) => (tabRefs.current[i] = el)}
            type="button"
            role="tab"
            id={`build-tab-${x.key}`}
            aria-selected={i === active}
            aria-controls="build-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => go(i)}
            className={`relative min-h-11 shrink-0 rounded-pill px-4 text-body-sm font-medium transition-[color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox-500 active:scale-[0.98] ${
              i === active
                ? 'text-white'
                : 'text-warm-800 hover:bg-warm-100 hover:text-warm-900 max-sm:bg-white max-sm:ring-1 max-sm:ring-warm-200'
            }`}
          >
            {i === active && (
              <motion.span
                layoutId="tab-pill"
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-pill bg-warm-900"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }
                }
              >
                {/* Autoplay progress: fills over the tab's time on screen, then the next tab slides in. */}
                {auto && !reduce && active < last && (
                  <motion.span
                    className="absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-pill bg-fox-500"
                    style={{ scaleX: progress }}
                  />
                )}
              </motion.span>
            )}
            <span className="relative">{x.tab}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={b.key}
          id="build-panel"
          role="tabpanel"
          aria-labelledby={`build-tab-${b.key}`}
          custom={dir}
          initial={reduce ? false : { opacity: 0, x: dir * slide }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -dir * slide }}
          transition={{ duration: 0.35, ease: EASE }}
          onPanEnd={onSwipe}
          className="mt-8 grid touch-pan-y items-start gap-10 lg:grid-cols-12 lg:gap-14"
        >
          <div className="lg:col-span-7">
            <div className="relative">
              <div
                data-stage
                onPointerMove={onStageMove}
                onPointerOver={onStageOver}
                onPointerLeave={onStageLeave}
                className="brand-stage relative flex min-h-[26rem] flex-col justify-center overflow-hidden px-4 py-8 max-sm:pb-14 sm:min-h-[30rem] sm:px-10 sm:py-12 lg:pb-36"
              >
                {/* Dot grid sits on its own layer so it can drift slower than the preview. */}
                <motion.div
                  data-layer="pattern"
                  aria-hidden
                  className="pointer-events-none absolute -inset-4 opacity-30"
                  style={{
                    x: patX,
                    y: patY,
                    backgroundImage:
                      'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1.5px)',
                    backgroundSize: '22px 22px',
                  }}
                />
                <motion.div
                  data-layer="preview"
                  className="relative"
                  style={{ x: preX, y: preY }}
                  onClick={() => {
                    setAuto(false);
                    setReplay((r) => r + 1);
                  }}
                >
                  <BuildPreview kind={b.key} replay={replay} hot={hot} reduce={!!reduce} />
                </motion.div>
                <p className="relative mt-6 hidden max-w-[45%] text-caption font-medium text-white lg:block">
                  Example build · {b.stage}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuto(false);
                    setReplay((r) => r + 1);
                  }}
                  aria-label="Replay the animation"
                  className="absolute bottom-1 right-2 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition-[background-color,transform] duration-150 hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 lg:bottom-auto lg:top-2 lg:h-10 lg:w-10"
                >
                  <RotateCcw size={15} aria-hidden />
                </button>
              </div>

              {/* Price card: overhangs the stage on desktop, stacks below it on phones. */}
              <div
                data-layer="price"
                className="relative z-10 mt-3 rounded-md bg-white p-5 shadow-lg ring-1 ring-warm-900/5 lg:absolute lg:-bottom-8 lg:right-8 lg:mt-0 lg:w-80"
              >
                <p className="text-caption font-medium text-warm-700">{b.pkg}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Odometer value={b.price} from={BUILDS[fromIdx].price} reduce={reduce} />
                  <motion.p
                    data-savings
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: EASE, delay: 0.3 }}
                    className="rounded-pill bg-sage-50 px-2.5 py-1 text-caption font-semibold text-sage-700"
                  >
                    Saves {inr(b.savings)}
                  </motion.p>
                </div>
                <p className="mt-1 text-caption text-warm-700">
                  against buying the pieces one by one
                </p>
                <p className="mt-3 flex items-center justify-between border-t border-warm-100 pt-3 text-caption text-warm-800">
                  <span>{b.weeks}</span>
                  <span>+ GST</span>
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:min-h-[28rem] lg:pt-2">
            <p className="text-caption font-semibold uppercase tracking-wider text-fox-600">
              {String(active + 1).padStart(2, '0')} / {String(BUILDS.length).padStart(2, '0')} ·{' '}
              {b.tab}
            </p>
            <h3 className="mt-3 font-display text-display-md text-warm-900">{b.title}</h3>
            <p className="mt-3 text-body-lg text-warm-800">{b.blurb}</p>
            <ul className="mt-6 divide-y divide-warm-100 border-y border-warm-100">
              {b.items.map((it, i) => (
                <motion.li
                  key={it}
                  data-feature={it}
                  onPointerEnter={() => setHot(it)}
                  onPointerLeave={() => setHot('')}
                  initial={reduce ? false : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: 0.1 + i * 0.07 }}
                  className={`flex min-h-11 items-center gap-3 rounded-sm py-2.5 pl-2 text-body text-warm-900 transition-[background-color,transform] duration-200 ${
                    hot === it ? 'translate-x-1 bg-fox-50' : ''
                  }`}
                >
                  <DrawnCheck delay={0.25 + i * 0.07} reduce={reduce} />
                  {it}
                </motion.li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to={`/builder?category=${b.cat}`} className="btn-fox group">
                Customise in the Builder{' '}
                <ArrowRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                to="/packages"
                className="text-body-sm font-medium text-warm-800 underline decoration-warm-300 underline-offset-4 hover:text-fox-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fox-500 active:scale-[0.98]"
              >
                All packages
              </Link>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

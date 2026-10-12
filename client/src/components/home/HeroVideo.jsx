import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { EASE } from '@components/home/SectionHead';
import { Pause, Play } from 'lucide-react';
import Photo from '@components/Photo';

/* Services as they are added in the recording (`at` = seconds into the 15 s clip).
   Prices are copied from the frame; HeroHud takes `time` so a playback driver can
   reveal rows by video.currentTime. `null` = final state (poster, reduced motion). */
const DEMO_SECONDS = 15;
const PLAN_ROWS = [
  { name: 'Business Website (5 pages)', price: 25000, at: 3 },
  { name: 'Responsive Design', price: 8000, at: 6 },
  { name: 'CMS Setup (WordPress/Strapi)', price: 20000, at: 9 },
  { name: 'Blog System', price: 12000, at: 13 },
];
const GST_RATE = 0.18;
export const inr = (n) => `₹${n.toLocaleString('en-IN')}`;

/* Counts to `value` in 450 ms. The text is written imperatively so React never
   overwrites it mid-tween (the initial string is frozen in a ref). */
function Roll({ value, instant }) {
  const ref = useRef(null);
  const from = useRef(value);
  const first = useRef(inr(value));
  useEffect(() => {
    const el = ref.current;
    if (instant) {
      el.textContent = inr(value);
      from.current = value;
      return undefined;
    }
    const c = animate(from.current, value, {
      duration: 0.45,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (v) => {
        from.current = v;
        el.textContent = inr(Math.round(v));
      },
    });
    return () => c.stop();
  }, [value, instant]);
  return <span ref={ref}>{first.current}</span>;
}

/* Chip hover/focus in the hero previews that category in the plan card (real catalogue prices). */
export const PREVIEWS = {
  'web-dev': {
    label: 'Website',
    rows: [
      ['Business Website (5 pages)', 25000],
      ['Landing Page', 10000],
      ['Contact & Lead Forms', 8000],
    ],
  },
  ecommerce: {
    label: 'Online store',
    rows: [
      ['Shopify Store Setup', 30000],
      ['Payment Integration', 15000],
      ['Shipping & Logistics', 20000],
    ],
  },
  'mobile-dev': {
    label: 'Mobile app',
    rows: [
      ['Standard Mobile App', 250000],
      ['Mobile App UI/UX Design', 80000],
      ['Push Notifications', 12000],
    ],
  },
  'ai-genai': {
    label: 'AI chatbot',
    rows: [
      ['FAQ Chatbot', 25000],
      ['Custom GPT / RAG Bot', 80000],
      ['Chatbot Analytics Dashboard', 20000],
    ],
  },
  'ui-ux': {
    label: 'Logo & design',
    rows: [
      ['Brand Identity Design', 35000],
      ['Complete UI Kit / Design System', 40000],
      ['Icon Set Design (20 icons)', 10000],
    ],
  },
  'seo-marketing': {
    label: 'SEO & ads',
    rows: [
      ['Technical SEO Audit', 15000],
      ['On-Page SEO Optimization', 12000],
      ['Google Ads Management', 15000],
    ],
  },
};

/** "Your plan" card: sits outside the video so it never covers the Builder UI.
 *  `preview` (a PREVIEWS key) swaps in a category; `hot` is the row linked to the rail. */
export function HeroHud({ time = null, preview = null, hot = -1, onHot, onPick, className = '' }) {
  const reduce = useReducedMotion();
  const pv = PREVIEWS[preview];
  const list = pv
    ? pv.rows.map(([name, price]) => ({ name, price }))
    : PLAN_ROWS.filter((r) => time === null || time >= r.at);
  const subtotal = list.reduce((sum, r) => sum + r.price, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const linked = !pv && onHot;
  return (
    <div
      aria-hidden
      data-hero-hud
      className={`rounded-md bg-white p-4 text-warm-900 shadow-[0_1px_0_rgba(26,25,24,0.04),0_8px_16px_-6px_rgba(26,25,24,0.18),0_28px_48px_-16px_rgba(26,25,24,0.38)] ring-1 ring-warm-900/10 ${className}`}
    >
      {/* 150 ms cross-fade whenever the preview starts or ends */}
      <motion.div
        key={preview || 'live'}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-[15px] font-semibold tracking-tight">Your plan</span>
          <span className={`text-caption ${pv ? 'font-medium text-fox-600' : 'text-warm-700'}`}>
            {pv
              ? `Preview: ${pv.label}`
              : `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`}
          </span>
        </div>
        {/* fixed height = four rows, so the card never shifts the page as rows arrive */}
        <ul className="mt-3 min-h-[92px] space-y-1.5 lg:min-h-[120px]">
          {list.length === 0 && (
            <li className="px-2.5 py-1.5 text-body-sm text-warm-700">
              Services appear here as they are added.
            </li>
          )}
          <AnimatePresence initial={false}>
            {list.map((r) => {
              const i = PLAN_ROWS.indexOf(r);
              return (
                <motion.li
                  key={r.name}
                  data-hud-row
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.25 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  onPointerEnter={linked ? (e) => e.pointerType === 'mouse' && onHot(i) : undefined}
                  onPointerLeave={linked ? () => onHot(-1) : undefined}
                  onClick={linked ? () => onPick(i) : undefined}
                  className={`flex items-baseline justify-between gap-3 rounded-sm px-2.5 py-1.5 text-body-sm transition-colors duration-short ${linked ? 'cursor-pointer' : ''} ${i === hot ? 'bg-fox-50 ring-1 ring-fox-300' : 'bg-warm-50'}`}
                >
                  <span className="truncate">{r.name}</span>
                  <span className="font-medium tabular-nums">{inr(r.price)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        <dl className="mt-3 space-y-0.5 border-t border-warm-200 pt-2 text-body-sm text-warm-800 tabular-nums">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>
              <Roll value={subtotal} instant={reduce} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>GST 18%</dt>
            <dd>
              <Roll value={gst} instant={reduce} />
            </dd>
          </div>
        </dl>
        <div className="mt-2 flex items-baseline justify-between border-t-2 border-warm-900 pt-2">
          <span className="text-body-sm font-semibold">Total</span>
          <span
            data-hud-total
            className="font-display text-[1.6rem] font-semibold leading-none tracking-tight text-fox-500 tabular-nums"
          >
            <Roll value={subtotal + gst} instant={reduce} />
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/** Progress rail: ticks at the moment each service is added; drag or use arrow keys to seek. */
function HeroRail({ className = '', fillRef, railRef, count, live, hot, onHot, onSeek, onToggle }) {
  const drag = useRef(false);
  const seekAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - r.left) / r.width) * DEMO_SECONDS);
  };
  // the tick under (or within 14px of) the cursor lights its row in the plan card
  const nearTick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    return PLAN_ROWS.findIndex((p) => Math.abs((p.at / DEMO_SECONDS) * r.width - x) < 14);
  };
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step) onSeek(null, step);
    else if (e.key === 'Home') onSeek(0);
    else if (e.key === 'End') onSeek(DEMO_SECONDS - 0.01);
    else if (e.key === ' ' || e.key === 'k') onToggle();
    else return;
    e.preventDefault();
  };
  const interactive = live
    ? {
        ref: railRef,
        role: 'slider',
        tabIndex: 0,
        'aria-label': 'Demo progress',
        'aria-valuemin': 0,
        'aria-valuemax': DEMO_SECONDS,
        'aria-valuenow': 0,
        onKeyDown: onKey,
        onPointerDown: (e) => {
          drag.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e);
        },
        onPointerMove: (e) => {
          if (drag.current) seekAt(e);
          else if (e.pointerType === 'mouse') onHot(nearTick(e));
        },
        onPointerUp: () => (drag.current = false),
        onPointerCancel: () => (drag.current = false),
        onPointerLeave: () => onHot(-1),
      }
    : {};
  return (
    <div
      data-hero-rail
      className={`select-none ${className}`}
      {...(live ? {} : { 'aria-hidden': true })}
    >
      <div
        {...interactive}
        className={`relative h-1 rounded-full bg-warm-900/20 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] ${live ? 'cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-900 focus-visible:ring-offset-4 focus-visible:ring-offset-fox-500' : ''}`}
      >
        <div
          ref={fillRef}
          data-rail-fill
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-warm-900/70"
        />
        {PLAN_ROWS.map((r, i) => (
          <motion.span
            key={r.name}
            animate={{
              scaleY: i === hot ? 1.5 : i < count ? 1 : 0.6,
              opacity: i < count || i === hot ? 1 : 0.6,
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            className="absolute top-1/2 h-3 w-0.5 rounded-full bg-warm-900"
            style={{ left: `${(r.at / DEMO_SECONDS) * 100}%`, x: '-50%', y: '-50%' }}
          />
        ))}
      </div>
      <div className="relative mt-1.5 hidden h-4 text-[11px] font-medium text-warm-900 sm:block">
        {PLAN_ROWS.map((r, i) => (
          // pointer-only shortcut to that moment; keyboard users have the slider above
          <button
            key={r.name}
            type="button"
            tabIndex={-1}
            aria-hidden
            disabled={!live}
            onClick={() => onSeek(r.at + 0.05)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHot(i)}
            onPointerLeave={() => onHot(-1)}
            className={`absolute -translate-x-1/2 whitespace-nowrap rounded-sm px-1 transition-opacity duration-medium ${i === hot ? 'underline underline-offset-2' : ''}`}
            style={{
              left: `${(r.at / DEMO_SECONDS) * 100}%`,
              opacity: i < count || i === hot ? 1 : 0.8,
            }}
          >
            {r.name.split(' (')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Hero visual: a real screen recording of the StackFox Builder (services added
 * one by one, the plan and GST total building up), played inside a browser frame
 * on the brand stage. The recording is 15 s, ~0.7 MB and silent. People who
 * prefer reduced motion or have Save-Data on get the final frame as a still.
 */
export function HeroVideo({ preview = null }) {
  const reduce = useReducedMotion();
  const video = useRef(null);
  const stage = useRef(null);
  const fill = useRef(null);
  const rail = useRef(null);
  const [useVideo, setUseVideo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fine, setFine] = useState(false);
  // services added so far at the playhead (derived from currentTime, never accumulated)
  const [count, setCount] = useState(0);
  // row index lit by hovering a plan row or a rail tick (each lights the other)
  const [hot, setHot] = useState(-1);
  const swipe = useRef(null);
  const inView = useInView(stage, { amount: 0.1 });

  useEffect(() => {
    setUseVideo(!reduce && !navigator.connection?.saveData);
    setFine(window.matchMedia('(pointer: fine)').matches);
  }, [reduce]);

  /* Scroll-linked: the stage grows into place and the frame straightens. */
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'start 0.4'] });
  const stageScale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);

  /* Pointer parallax: one spring feeds frame tilt, HUD and light at different depths. */
  const px = useSpring(useMotionValue(0), { stiffness: 140, damping: 18, mass: 0.6 });
  const py = useSpring(useMotionValue(0), { stiffness: 140, damping: 18, mass: 0.6 });
  const hudX = useTransform(px, (v) => v * 14);
  const lightX = useTransform(px, (v) => v * -20);
  const onMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  /* Playhead -> HUD rows and rail fill. State only changes when a row boundary is crossed. */
  const sync = useCallback(() => {
    const v = video.current;
    if (!v) return;
    const t = v.currentTime;
    setCount(PLAN_ROWS.filter((r) => t >= r.at).length);
    if (fill.current) fill.current.style.transform = `scaleX(${Math.min(1, t / DEMO_SECONDS)})`;
    rail.current?.setAttribute('aria-valuenow', Math.round(t));
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!useVideo || !v) return undefined;
    v.addEventListener('seeked', sync);
    v.addEventListener('timeupdate', sync);
    return () => {
      v.removeEventListener('seeked', sync);
      v.removeEventListener('timeupdate', sync);
    };
  }, [useVideo, sync]);

  // timeupdate only fires ~4 Hz; poll per frame while playing and on screen.
  useEffect(() => {
    if (!useVideo || !inView || paused) return undefined;
    let id = requestAnimationFrame(function tick() {
      sync();
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [useVideo, inView, paused, sync]);

  // Don't decode video nobody can see.
  useEffect(() => {
    const v = video.current;
    if (!useVideo || !v) return;
    if (inView && !paused) v.play().catch(() => {});
    else v.pause();
  }, [useVideo, inView, paused]);

  const seek = (t, delta = 0) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(DEMO_SECONDS - 0.01, t ?? v.currentTime + delta));
    sync();
  };

  // a swipe that scrubbed must not also count as the tap that follows it
  const toggle = () => {
    if (swipe.current?.moved) {
      swipe.current = null;
      return;
    }
    setPaused((p) => !p);
  };
  // touch: drag across the video to scrub (a full-width swipe = the whole 15 s clip)
  const swipeHandlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'touch')
        swipe.current = { x: e.clientX, t: video.current?.currentTime ?? 0, moved: false };
    },
    onPointerMove: (e) => {
      const s = swipe.current;
      if (!s || e.pointerType !== 'touch') return;
      const dx = e.clientX - s.x;
      if (!s.moved && Math.abs(dx) < 12) return;
      s.moved = true;
      seek(s.t + (dx / e.currentTarget.clientWidth) * DEMO_SECONDS);
    },
    onPointerCancel: () => (swipe.current = null),
  };
  // jump to the moment a plan row was added, and make sure it is playing
  const pick = (i) => {
    seek(PLAN_ROWS[i].at + 0.05);
    setPaused(false);
  };

  const motionOn = !reduce;
  const hudTime = useVideo ? (count > 0 ? PLAN_ROWS[count - 1].at : -1) : null;

  return (
    <motion.div
      ref={stage}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-hero-stage
      style={motionOn ? { scale: stageScale, transformOrigin: '50% 0%' } : undefined}
      className="brand-stage relative isolate overflow-hidden p-3 sm:p-6 lg:px-12 lg:pb-12 lg:pt-12"
    >
      {/* soft light behind the frame; drifts opposite the pointer for depth */}
      <motion.div
        aria-hidden
        data-hero-light
        style={motionOn && fine ? { x: lightX } : undefined}
        className="pointer-events-none absolute left-[10%] top-[8%] -z-10 h-[70%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgba(255,214,184,0.55),rgba(255,214,184,0))]"
      />
      <div className="relative mx-auto max-w-[1080px]">
        <div className="relative">
          {/* No 3D tilt on the frame: a rotated video is resampled by the browser and looks soft. */}
          <div
            data-hero-frame
            className="overflow-hidden rounded-[1.1rem] bg-white shadow-[0_1px_0_rgba(26,25,24,0.04),0_8px_16px_-8px_rgba(26,25,24,0.25),0_40px_80px_-32px_rgba(26,25,24,0.45)] ring-1 ring-warm-900/10"
          >
            <div className="flex items-center gap-3 border-b border-warm-100 bg-warm-50 px-4 py-2.5">
              <div className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
                <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
                <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
              </div>
              <div className="mx-auto rounded-sm bg-white px-3 py-1 font-mono text-[11px] text-warm-700 ring-1 ring-warm-100">
                stackfox.in/builder
              </div>
              <span className="w-[42px]" aria-hidden />
            </div>

            <div className="relative aspect-[8/5] bg-warm-50">
              {useVideo ? (
                <video
                  ref={video}
                  className="h-full w-full cursor-pointer touch-pan-y object-cover"
                  poster="/images/home/hero-builder-poster-1440.webp"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onClick={toggle}
                  {...swipeHandlers}
                  aria-label="Screen recording of the Builder: services are added one by one and the plan total builds up"
                >
                  <source src="/videos/home/hero-builder-demo.mp4" type="video/mp4" />
                </video>
              ) : (
                <Photo
                  base="/images/home/hero-builder-poster"
                  widths={[800, 1440]}
                  width={1440}
                  height={900}
                  sizes="(min-width: 1280px) 1080px, 100vw"
                  eager
                  alt="The StackFox Builder with four services added and a total of ₹76,700 including GST"
                  className="h-full w-full object-cover"
                />
              )}

              {useVideo && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={paused ? 'Play demo video' : 'Pause demo video'}
                  className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-warm-900/70 text-white backdrop-blur transition hover:bg-warm-900/90 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* phone: strip under the frame; desktop: overlaps the frame's bottom-left corner so the stage stays tight */}
          <motion.div
            style={motionOn && fine ? { x: hudX } : undefined}
            className="mt-3 lg:absolute lg:-bottom-10 lg:-left-8 lg:z-10 lg:mt-0 lg:w-[300px]"
            data-hero-hud-wrap
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.4, ease: EASE }}
            >
              <HeroHud
                time={hudTime}
                preview={preview}
                hot={hot}
                onHot={useVideo ? setHot : undefined}
                onPick={pick}
              />
            </motion.div>
          </motion.div>
        </div>
        <HeroRail
          className="mt-4 hidden sm:block lg:ml-[288px] lg:mt-5"
          live={useVideo}
          fillRef={fill}
          railRef={rail}
          count={useVideo ? count : PLAN_ROWS.length}
          hot={hot}
          onHot={setHot}
          onSeek={seek}
          onToggle={toggle}
        />
      </div>
    </motion.div>
  );
}

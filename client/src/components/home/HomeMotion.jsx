import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view; flips on after a beat regardless so
 *  content can never be left in its "before" state if the observer misses (see Reveal). */
export function useSeen(ref, amount = 0.3) {
  const seen = useInView(ref, { once: true, amount });
  const [safety, setSafety] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSafety(true), 1400);
    return () => clearTimeout(t);
  }, []);
  return seen || safety;
}

/** Thin fox-orange reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-fox-500"
    />
  );
}

/** Warm glow that follows the pointer inside a card. Put `spotlightProps` on the card
 *  (it needs `position: relative` + the `group` class) and render <SpotlightGlow/> inside. */
export const spotlightProps = {
  onMouseMove: (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  },
};
export function SpotlightGlow({ tone = 'rgba(255,77,0,0.11)' }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-medium group-hover:opacity-100"
      style={{
        background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), ${tone}, transparent 70%)`,
      }}
    />
  );
}

/** Gentle 3D tilt that follows the pointer. Disabled on touch and for reduced motion. */
export function Tilt({ children, max = 5, className }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });
  const onMove = (e) => {
    if (e.pointerType === 'touch' || prefersReduced()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * max * 2);
    rx.set(-py * max * 2);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };
  return (
    <div style={{ perspective: 1100 }} className={className}>
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Pulls its child a few pixels toward the pointer — used on the one primary CTA. */
export function Magnetic({ children, strength = 0.25, className }) {
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const onMove = (e) => {
    if (e.pointerType === 'touch' || prefersReduced()) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.span
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x, y }}
      className={`inline-block ${className || ''}`}
    >
      {children}
    </motion.span>
  );
}

/** Counts from 0 to `end` the first time it scrolls into view. */
export function CountOnView({ end, suffix = '', prefix = '', duration = 1.4 }) {
  const ref = useRef(null);
  const seen = useSeen(ref, 0.6);
  const [n, setN] = useState(prefersReduced() ? end : 0);
  useEffect(() => {
    if (!seen || prefersReduced()) {
      if (seen) setN(end);
      return undefined;
    }
    const c = animate(0, end, {
      duration,
      ease: [0.16, 0.8, 0.2, 1],
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => c.stop();
  }, [seen, end, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {n.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

/** Hand-drawn underline that strokes itself in under a word. */
export function DrawnUnderline({ delay = 0.9 }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 16"
      preserveAspectRatio="none"
      className="absolute -bottom-1 left-0 h-[0.32em] w-full overflow-visible text-fox-500"
    >
      <motion.path
        d="M3 11 C 60 3, 120 14, 180 7 S 290 4, 317 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, delay, ease: [0.5, 0, 0.2, 1] }}
      />
    </svg>
  );
}

/** Wraps an image so it drifts slower than the page as it scrolls past. */
export function Parallax({ children, distance = 60, className }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  return (
    <div ref={ref} className={`overflow-hidden ${className || ''}`}>
      <motion.div style={{ y }} className="h-[calc(100%+var(--pad,0px))]">
        {children}
      </motion.div>
    </div>
  );
}

/** Endless service ticker. Pure CSS (see .marquee in index.css) so it costs no JS. */
export function Marquee({ items }) {
  const row = (k) => (
    <ul key={k} className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={k === 'b'}>
      {items.map(({ label, icon: Icon }) => (
        <li
          key={label}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-pill border border-warm-200 bg-white px-4 py-2 text-body-sm font-medium text-warm-700 shadow-sm"
        >
          {Icon && <Icon size={14} className="text-fox-500" />}
          {label}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee relative overflow-hidden py-5" role="presentation">
      <div className="marquee-track flex w-max">
        {row('a')}
        {row('b')}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-warm-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-warm-white to-transparent" />
    </div>
  );
}

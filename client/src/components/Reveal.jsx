import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { fadeUp, fade, stagger } from './motion';

/* `as` may be a tag name ("section") or a component (react-router's Link). */
const motionize = (as) => (typeof as === 'string' ? motion[as] || motion.div : motion(as));

/**
 * Scroll-reveal wrapper — Calm Guidance motion (see DESIGN.md).
 * Gentle fade + 14px rise when the element scrolls in.
 *
 * Reliability: we drive it with `useInView` (once) AND fall back to the
 * "show" state on mount if the observer hasn't fired — framer's bare
 * `whileInView` can leave content stuck at opacity 0 on a fast scroll or a
 * scrollTo jump (see the note in motion.js). Here, worst case, the content is
 * simply already visible.
 *
 *   <Reveal>                     single element
 *   <Reveal as="section" delay={0.1}>
 *   <Reveal stagger> + <Reveal.Item>   children in sequence
 */
export function Reveal({
  children, as = 'div', delay = 0, variant = 'up', stagger: isStagger = false, className, ...rest
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  // Safety net: never leave content hidden if the observer misses.
  const [safety, setSafety] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSafety(true), 900);
    return () => clearTimeout(t);
  }, []);
  const Comp = useMemo(() => motionize(as), [as]);
  const variants = isStagger ? stagger : variant === 'fade' ? fade : fadeUp;
  return (
    <Comp
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={inView || safety ? 'show' : 'hidden'}
      transition={delay ? { delay } : undefined}
      {...rest}
    >
      {children}
    </Comp>
  );
}

Reveal.Item = function RevealItem({ children, as = 'div', className, ...rest }) {
  const Comp = useMemo(() => motionize(as), [as]);
  return (
    <Comp className={className} variants={fadeUp} {...rest}>
      {children}
    </Comp>
  );
};

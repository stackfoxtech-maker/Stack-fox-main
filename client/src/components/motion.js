// Shared motion vocabulary — Calm Guidance (see DESIGN.md).
// Gentle, quick, nothing bounces. Pair with <MotionConfig reducedMotion="user">
// at the app root; index.css also collapses CSS transitions under the same
// prefers-reduced-motion media query.

const easeEnter = [0.2, 0.7, 0.2, 1];

// Fade + small rise. Hero copy, cards, section content.
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: easeEnter } },
};

// Subtle fade only — large media where movement would feel heavy.
export const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28, ease: easeEnter } },
};

// Parent that reveals children one after another.
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

// Standard viewport trigger — fire once, slightly before fully in view.
export const inView = { once: true, amount: 0.25, margin: '0px 0px -10% 0px' };

// Spread onto a motion element to reveal it on scroll.
export const revealOnScroll = {
  variants: fadeUp,
  initial: 'hidden',
  whileInView: 'show',
  viewport: inView,
};

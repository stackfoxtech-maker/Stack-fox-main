import { motion } from 'framer-motion';
import { CountOnView, DrawnUnderline } from '@components/home/HomeMotion';

const EASE = [0.2, 0.7, 0.2, 1];

/**
 * The header band shared by the marketing pages: a soft gradient card with two slow orbs, an
 * eyebrow, a headline whose `accent` phrase gets a hand-drawn underline, a lead paragraph,
 * optional count-up figures and optional actions. It replaces the plain centred heading so every
 * page opens the same way the homepage and the Builder do.
 *
 *   <PageHero eyebrow="Pricing" title="Transparent pricing, no surprises" accent="no surprises"
 *             description="..." stats={[{ end: 255, suffix: '+', label: 'priced services' }]} />
 */
export function PageHero({ eyebrow, title, accent, description, stats, children }) {
  const at = accent ? title.indexOf(accent) : -1;
  const before = at >= 0 ? title.slice(0, at) : title;
  const after = at >= 0 ? title.slice(at + accent.length) : '';
  const rise = (delay) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: EASE },
  });

  return (
    <div className="relative mb-10 overflow-hidden rounded-[1.75rem] border border-warm-200 bg-gradient-to-br from-fox-50 via-white to-sage-50 px-5 py-9 md:mb-14 md:px-10 md:py-14">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-fox-200/40 blur-3xl"
        animate={{ x: [0, -18, 0], y: [0, 14, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-sage-200/40 blur-3xl"
        animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        {eyebrow && (
          <motion.span className="eyebrow mb-4" {...rise(0)}>
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          className="text-[1.9rem] leading-[1.1] text-warm-900 md:text-display-xl"
          {...rise(0.06)}
        >
          {before}
          {accent && (
            <span className="accent-serif relative inline-block">
              {accent}
              <DrawnUnderline delay={0.6} />
            </span>
          )}
          {after}
        </motion.h1>
        {description && (
          <motion.p className="mt-4 max-w-2xl text-body-lg text-warm-600" {...rise(0.14)}>
            {description}
          </motion.p>
        )}
        {children && (
          <motion.div
            className="mt-6 flex flex-wrap items-center justify-center gap-2.5"
            {...rise(0.22)}
          >
            {children}
          </motion.div>
        )}
        {stats?.length > 0 && (
          <motion.dl
            className="mt-8 grid w-full grid-cols-2 gap-x-6 gap-y-5 border-t border-warm-200/80 pt-6 sm:grid-cols-4"
            {...rise(0.3)}
          >
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-display text-3xl font-semibold tracking-tight text-warm-900 md:text-4xl">
                    <CountOnView end={s.end} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                  </span>
                  <span className="mt-0.5 block text-body-sm text-warm-600">{s.label}</span>
                </dd>
              </div>
            ))}
          </motion.dl>
        )}
      </div>
    </div>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '@components/Reveal';

export const EASE = [0.2, 0.7, 0.2, 1];

/** Words rise out of a mask one after another. */
export function MaskWords({ text, delay = 0, className = '' }) {
  const reduce = useReducedMotion();
  return text.split(' ').map((w, i) => (
    <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
      <motion.span
        className={`inline-block ${className}`}
        initial={reduce ? false : { y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, delay: delay + i * 0.07, ease: EASE }}
      >
        {w}
        {' '}
      </motion.span>
    </span>
  ));
}

/** Section heading whose lines slide up out of a mask as it scrolls in. */
export function SectionHead({ title, sub, action, tone = 'light' }) {
  const dark = tone === 'dark';
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <h2
          className={`text-[2rem] leading-[1.08] tracking-tight md:text-[2.875rem] ${dark ? 'text-white' : 'text-warm-900'}`}
        >
          {title.split('\n').map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={reduce ? false : { y: '105%' }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.75, delay: i * 0.1, ease: EASE }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h2>
        {sub && (
          <Reveal>
            <p className={`mt-5 text-body-lg ${dark ? 'text-warm-200' : 'text-warm-700'}`}>{sub}</p>
          </Reveal>
        )}
      </div>
      {action && <Reveal>{action}</Reveal>}
    </div>
  );
}

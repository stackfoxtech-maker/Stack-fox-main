import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '@components/Reveal';
import { EASE } from '@components/home/SectionHead';
import { TryEstimator } from '@components/home/TryEstimator';

const LINES = ['A little of this.', 'A lot of possibility.'];

/** Try it: tick pieces and watch the estimate move. */
export function EstimatorSection() {
  const reduce = useReducedMotion();
  return (
    <section className="section-padding bg-white">
      <div className="container-fx">
        <div className="max-w-2xl">
          {/* The mask span is the observed element: SectionHead observes the clipped child, so it never fires. */}
          <h2 className="text-[2rem] leading-[1.08] tracking-tight text-warm-900 md:text-[2.875rem]">
            {LINES.map((line, i) => (
              <motion.span
                key={line}
                className="block overflow-hidden pb-[0.06em]"
                initial="hide"
                whileInView="show"
                viewport={{ once: true, amount: 0.6 }}
              >
                <motion.span
                  className="block"
                  variants={{ hide: reduce ? {} : { y: '105%' }, show: { y: 0 } }}
                  transition={{ duration: 0.75, delay: i * 0.1, ease: EASE }}
                >
                  {line}
                </motion.span>
              </motion.span>
            ))}
          </h2>
          <Reveal>
            <p className="mt-5 text-body-lg text-warm-700">
              Tick a few pieces and watch the estimate move. This is exactly how the Builder works.
            </p>
          </Reveal>
        </div>
        <div className="mt-12">
          <TryEstimator />
        </div>
      </div>
    </section>
  );
}

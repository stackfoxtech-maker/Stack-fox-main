import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { JourneyFilm } from '@components/home/JourneyFilm';
import { EASE, SectionHead } from '@components/home/SectionHead';

/** The whole customer journey, on the brand stage. */
export function JourneySection() {
  const reduce = useReducedMotion();
  // The product stage tilts up from the page as it scrolls into view.
  const stageRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'start 25%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.92, 1]);

  return (
    <section className="section-padding bg-warm-white">
      <div className="container-fx">
        <SectionHead
          title={'From first idea\nto launch day.'}
          sub="Pick the pieces, see the price, sign and pay, then watch every milestone land. Here is the whole journey in twenty seconds."
        />
        <div ref={stageRef} className="mt-12 [perspective:1400px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.9, ease: EASE }}
            style={{ rotateX, scale, transformOrigin: 'center top' }}
          >
            <JourneyFilm stageClassName="brand-stage p-3 sm:p-6 lg:p-12" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

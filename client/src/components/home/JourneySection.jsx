import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { JourneyFilm } from '@components/home/JourneyFilm';
import { EASE, SectionHead } from '@components/home/SectionHead';

// Matches the film's own mapping: chapters share this slice of the pinned track.
const P0 = 0.04;
const PSPAN = 0.84;
const PIN_TOP = 80; // px, same as the sticky `top-20`

// Pinned scroll storytelling needs room: wide and tall enough to hold the whole stage.
const PIN_QUERY = '(min-width: 1024px) and (min-height: 840px)';

function usePinned() {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(
    () => typeof window !== 'undefined' && matchMedia(PIN_QUERY).matches,
  );
  useEffect(() => {
    const mq = matchMedia(PIN_QUERY);
    const sync = () => setOn(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return on && !reduce;
}

/** The whole customer journey, on the brand stage. */
export function JourneySection() {
  const reduce = useReducedMotion();
  const pinned = usePinned();
  const trackRef = useRef(null);
  // Scroll position inside the pinned track drives the film; the same start edge drives the entry tilt.
  const { scrollYProgress: progress } = useScroll({
    target: trackRef,
    offset: [`start ${PIN_TOP}px`, 'end end'],
  });
  const { scrollYProgress: entry } = useScroll({
    target: trackRef,
    offset: ['start end', 'start 25%'],
  });
  const rotateX = useTransform(entry, [0, 1], [reduce ? 0 : 16, 0]);
  const scale = useTransform(entry, [0, 1], [reduce ? 1 : 0.92, 1]);

  // Clicking a chapter scrolls to the middle of its slice of the track.
  const jump = (i) => {
    const r = trackRef.current.getBoundingClientRect();
    const start = r.top + window.scrollY - PIN_TOP;
    const end = r.top + window.scrollY + r.height - window.innerHeight;
    const v = P0 + (PSPAN * (i + 0.5)) / 4;
    window.scrollTo({ top: start + v * (end - start), behavior: 'smooth' });
  };

  return (
    <section className="section-padding bg-warm-white">
      <div className="container-fx">
        <SectionHead
          title={'From first idea\nto launch day.'}
          sub="Pick the pieces, see the price, sign and pay, then watch every milestone land. Here is the whole journey in twenty seconds."
        />
        {/* Wrapper is tall only when pinned: the stage sticks while the page scrolls through it. */}
        <div ref={trackRef} className={`mt-12 ${pinned ? 'h-[210vh]' : ''}`}>
          <div className={pinned ? 'sticky top-20' : ''}>
            <div className="[perspective:1400px]">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.9, ease: EASE }}
                style={{ rotateX, scale, transformOrigin: 'center top' }}
              >
                <JourneyFilm
                  stageClassName="brand-stage relative p-3 sm:p-6 lg:p-12"
                  progress={pinned ? progress : undefined}
                  onJump={jump}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

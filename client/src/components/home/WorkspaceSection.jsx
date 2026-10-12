import { useEffect, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { Bento } from '@components/home/Bento';
import { Reveal } from '@components/Reveal';
import { EASE } from '@components/home/SectionHead';

const LINES = ['Clarity doesn’t', 'stop at the quote.'];

/** After you sign: the client workspace, on a dark band. */
export function WorkspaceSection() {
  const reduce = useReducedMotion();
  // Spotlight only for a real mouse: touch has no cursor to follow.
  const [fine, setFine] = useState(false);
  const [near, setNear] = useState(false);
  useEffect(() => {
    setFine(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 140, damping: 22 });
  const y = useSpring(my, { stiffness: 140, damping: 22 });
  const light = useMotionTemplate`radial-gradient(460px circle at ${x}px ${y}px, rgba(255,120,60,0.11), transparent 70%)`;
  const live = fine && !reduce;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  return (
    <section
      className="section-padding relative overflow-hidden bg-warm-900"
      onPointerMove={live ? onMove : undefined}
      onPointerEnter={live ? () => setNear(true) : undefined}
      onPointerLeave={live ? () => setNear(false) : undefined}
    >
      {/* Band depth: a faint warm wash and a hairline; the spotlight follows the cursor above it. */}
      <div
        aria-hidden
        data-spotlight
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_40%,rgba(255,77,0,0.07),transparent_70%)]"
      />
      {live && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: light }}
          animate={{ opacity: near ? 1 : 0 }}
          initial={false}
          transition={{ duration: 0.4 }}
        />
      )}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="container-fx relative">
        <div className="max-w-2xl">
          {/* The mask span is the observed element: SectionHead observes the clipped child, so it never fires. */}
          <h2 className="text-[2rem] leading-[1.08] tracking-tight text-white md:text-[2.875rem]">
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
            <p className="mt-5 text-body-lg text-warm-200">
              A shared workspace keeps you connected to the work, from kickoff to launch.
            </p>
          </Reveal>
        </div>
        <Bento />
      </div>
    </section>
  );
}

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@components/Reveal';

const EASE = [0.2, 0.7, 0.2, 1];

// Variant factories: every element reads `hidden` / `show` from the parent svg.
const fade = (delay, d = 0.5) => ({
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { delay, duration: d, ease: EASE } },
});
const draw = (delay, d = 0.5) => ({
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: { delay, pathLength: { duration: d, ease: EASE }, opacity: { duration: 0.01 } },
  },
});
const grow = (delay, d = 0.4) => ({
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { delay, duration: d, ease: EASE } },
});
const rise = (delay, x = 0, y = 0) => ({
  hidden: { opacity: 0, x, y, scale: 0.96 },
  show: { opacity: 1, x: 0, y: 0, scale: 1, transition: { delay, duration: 0.6, ease: EASE } },
});
const pop = (delay) => ({
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { delay, type: 'spring', stiffness: 380, damping: 18 },
  },
});

// scaleX from the left edge of each bar.
const LEFT = { transformBox: 'fill-box', originX: 0, originY: 0.5 };
const CENTER = { transformBox: 'fill-box', originX: 0.5, originY: 0.5 };

const CHECKS = [217, 242, 267];
const PLAN_BARS = [
  [224, 207],
  [249, 182],
  [274, 198],
];

function Flow({ toY, delay }) {
  return (
    <motion.circle
      r="3.5"
      fill="#FF4D00"
      initial={{ opacity: 0, cx: 236, cy: 224 }}
      animate={{
        cx: [236, 286, 286, 334],
        cy: [224, 224, toY, toY],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        delay,
        duration: 1.6,
        times: [0, 0.3, 0.75, 1],
        ease: 'easeInOut',
        repeat: Infinity,
        repeatDelay: 2.4,
      }}
    />
  );
}

function Illustration() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const state = reduce || inView ? 'show' : 'hidden';

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 640 440"
      fill="none"
      className="h-auto w-full"
      role="img"
      aria-label="An itemised plan connects design and code into one finished product"
      initial={reduce ? 'show' : 'hidden'}
      animate={state}
    >
      {/* 1. grid */}
      <motion.path
        variants={fade(0, 0.6)}
        d="M80 340H560M80 100H560M120 60V380M520 60V380"
        stroke="#E4DFD5"
      />

      {/* 3. connectors (drawn under the cards) */}
      <motion.path
        variants={draw(1.0, 0.5)}
        d="M236 224H286V153H334"
        stroke="#A19B90"
        strokeWidth="2"
      />
      <motion.path
        variants={draw(1.1, 0.5)}
        d="M286 224V303H334"
        stroke="#A19B90"
        strokeWidth="2"
      />

      {/* 5. data flow loop */}
      {!reduce && inView && (
        <>
          <Flow toY={153} delay={2.6} />
          <Flow toY={303} delay={2.6} />
        </>
      )}

      {/* 2. plan card */}
      <motion.g variants={rise(0.2, 0, 10)} style={CENTER}>
        <rect x="82" y="144" width="156" height="164" rx="10" fill="#FFFEFC" stroke="#C6C1B5" />
        <path d="M106 176H160" stroke="#252722" strokeWidth="5" strokeLinecap="round" />
        <path d="M106 191H195" stroke="#DEDAD1" strokeWidth="4" strokeLinecap="round" />
      </motion.g>
      {CHECKS.map((y, i) => (
        <g key={y}>
          <motion.rect
            variants={fade(0.45 + i * 0.15, 0.3)}
            x="106"
            y={y}
            width="13"
            height="13"
            rx="3"
            fill="#DCE8E1"
          />
          <motion.path
            variants={draw(0.55 + i * 0.15, 0.3)}
            d={`m109 ${y + 6} 3 3 5-6`}
            stroke="#48705C"
            strokeWidth="1.5"
          />
          <motion.path
            variants={grow(0.6 + i * 0.15)}
            style={LEFT}
            d={`M130 ${PLAN_BARS[i][0]}H${PLAN_BARS[i][1]}`}
            stroke="#C6C1B5"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* 4a. design card */}
      <motion.g variants={rise(1.35, 16, 0)} style={CENTER}>
        <rect x="332" y="84" width="220" height="136" rx="10" fill="#FFFEFC" stroke="#C6C1B5" />
        <path d="M332 110H552" stroke="#DEDAD1" />
        <circle cx="347" cy="97" r="3" fill="#FF4D00" />
        <circle cx="358" cy="97" r="3" fill="#DEDAD1" />
        <circle cx="369" cy="97" r="3" fill="#DEDAD1" />
      </motion.g>
      <motion.g variants={rise(1.6)} style={CENTER}>
        <rect x="350" y="128" width="73" height="72" rx="4" fill="#FFE1D1" />
        <path d="m369 177 13-27 21 35h-38" fill="#C73C00" />
        <circle cx="406" cy="140" r="5" fill="#FF9E74" />
      </motion.g>
      {[
        [139, 529],
        [151, 513],
        [163, 521],
      ].map(([y, x2], i) => (
        <motion.path
          key={y}
          variants={grow(1.7 + i * 0.08)}
          style={LEFT}
          d={`M439 ${y}H${x2}`}
          stroke="#DEDAD1"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
      <motion.rect
        variants={grow(1.95, 0.3)}
        style={LEFT}
        x="439"
        y="183"
        width="50"
        height="16"
        rx="3"
        fill="#252722"
      />

      {/* 4b. code card */}
      <motion.rect
        variants={rise(1.5, 16, 0)}
        style={CENTER}
        x="332"
        y="252"
        width="184"
        height="100"
        rx="10"
        fill="#252722"
      />
      <motion.path
        variants={draw(1.8, 0.6)}
        d="m365 290-11 10 11 10m38-20 11 10-11 10m-14-28-11 46"
        stroke="#FFAC85"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [289, 493],
        [301, 479],
        [313, 488],
      ].map(([y, x2], i) => (
        <motion.path
          key={y}
          variants={grow(1.95 + i * 0.12, 0.3)}
          style={LEFT}
          d={`M436 ${y}H${x2}`}
          stroke="#64675B"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}

      {/* 3b. junction node */}
      <motion.g variants={pop(1.25)} style={CENTER}>
        <rect x="261" y="209" width="30" height="30" rx="6" fill="#C73C00" />
        <path d="M269 224H283M276 217V231" stroke="white" strokeWidth="2" />
      </motion.g>
    </motion.svg>
  );
}

export function Studio() {
  return (
    <section className="section-padding bg-white">
      <div className="container-fx grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
        <figure className="lg:col-span-6">
          <div className="rounded-lg bg-warm-50 p-6 ring-1 ring-warm-900/5">
            <Illustration />
          </div>
          <figcaption className="mt-4 text-body-sm text-warm-700">
            Thoughtfully scoped. Carefully built.
          </figcaption>
        </figure>

        <Reveal stagger className="lg:col-span-6">
          <Reveal.Item>
            <h2 className="font-display text-3xl tracking-tight text-warm-900 md:text-display-lg">
              Software is personal.
              <br />
              So is our approach.
            </h2>
          </Reveal.Item>
          <Reveal.Item>
            <p className="mt-6 text-body-lg text-warm-800">
              StackFox by Artwall Labs brings design, engineering and delivery into one place.
              Choose the pieces yourself, or work through the possibilities with our team.
            </p>
          </Reveal.Item>
          <Reveal.Item>
            <p className="mt-4 text-body-lg text-warm-800">
              Start with a conversation. Leave with a clearer next step.
            </p>
          </Reveal.Item>
          <Reveal.Item>
            <Link
              to="/contact"
              className="group mt-8 inline-flex items-center gap-1.5 font-medium text-warm-900 underline decoration-warm-300 underline-offset-4 hover:text-fox-600"
            >
              Let’s talk about your idea
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </Reveal.Item>
        </Reveal>
      </div>
    </section>
  );
}

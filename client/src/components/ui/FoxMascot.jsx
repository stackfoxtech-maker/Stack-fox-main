import { motion } from 'framer-motion';

/**
 * The StackFox fox, drawn in SVG so it can move: it blinks, an ear twitches now and
 * then, and its pupils follow `look` ({x, y}, each -1..1). `mood` changes the face:
 *   idle      — open eyes, blinking
 *   happy     — closed smiling eyes (greeting / chat open)
 *   thinking  — eyes glance up and aside while a reply is loading
 * Animations are transform-only, so MotionConfig reducedMotion="user" freezes them.
 */
export function FoxMascot({ size = 40, mood = 'idle', look, className }) {
  const dx = (look?.x ?? 0) * 2.2 + (mood === 'thinking' ? 1.6 : 0);
  const dy = (look?.y ?? 0) * 1.8 + (mood === 'thinking' ? -1.8 : 0);
  const happy = mood === 'happy';
  const blink = {
    scaleY: [1, 1, 0.08, 1, 1],
    transition: { duration: 4.2, times: [0, 0.46, 0.5, 0.54, 1], repeat: Infinity, delay: 1 },
  };
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="FoxBot"
    >
      {/* ears */}
      <motion.g
        style={{ transformOrigin: '20px 22px' }}
        animate={{ rotate: [0, 0, -9, 3, 0, 0] }}
        transition={{
          duration: 6,
          times: [0, 0.7, 0.75, 0.8, 0.85, 1],
          repeat: Infinity,
          delay: 2,
        }}
      >
        <path d="M9 32 L11 5 L31 19 Z" fill="#E04400" />
        <path d="M14 25 L15 12 L25 19 Z" fill="#FFC3A6" />
      </motion.g>
      <path d="M55 32 L53 5 L33 19 Z" fill="#E04400" />
      <path d="M50 25 L49 12 L39 19 Z" fill="#FFC3A6" />
      {/* head */}
      <path d="M8 31 Q8 17 32 17 Q56 17 56 31 Q56 50 32 59 Q8 50 8 31 Z" fill="#FF4D00" />
      {/* muzzle */}
      <path d="M13 37 Q22 31 32 40 Q42 31 51 37 Q46 55 32 59 Q18 55 13 37 Z" fill="#FFF1EA" />
      {/* eyes */}
      {happy ? (
        <g fill="none" stroke="#1A1918" strokeWidth="2.6" strokeLinecap="round">
          <path d="M18.5 34 Q23 28.5 27.5 34" />
          <path d="M36.5 34 Q41 28.5 45.5 34" />
        </g>
      ) : (
        <motion.g
          animate={blink}
          style={{ transformOrigin: '32px 34px', transformBox: 'fill-box' }}
        >
          <g transform={`translate(${dx} ${dy})`}>
            <circle cx="23" cy="34" r="3.6" fill="#1A1918" />
            <circle cx="41" cy="34" r="3.6" fill="#1A1918" />
            <circle cx="24.2" cy="32.8" r="1.1" fill="#fff" />
            <circle cx="42.2" cy="32.8" r="1.1" fill="#fff" />
          </g>
        </motion.g>
      )}
      {/* nose + mouth */}
      <ellipse cx="32" cy="48.5" rx="3.2" ry="2.3" fill="#1A1918" />
      <path
        d="M28.5 52.5 Q32 55.5 35.5 52.5"
        fill="none"
        stroke="#1A1918"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* cheek blush when happy */}
      {happy && (
        <>
          <circle cx="16.5" cy="42" r="3" fill="#FF9E74" opacity="0.5" />
          <circle cx="47.5" cy="42" r="3" fill="#FF9E74" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

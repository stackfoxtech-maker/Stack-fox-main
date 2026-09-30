import { motion, useMotionValue, useTransform } from 'framer-motion';

/**
 * The StackFox fox, drawn in SVG so it can move. It looks at whatever `lookX` / `lookY`
 * (MotionValues, each -1..1) point to, and the whole head answers: it turns and shifts, the face
 * slides a little further than the head and the eyes a little further than the face (that gap is
 * what reads as depth), and the ears lean the other way. It also blinks and twitches an ear.
 *
 *   mood="idle"      open eyes
 *   mood="happy"     closed smiling eyes and blush (greeting, chat open)
 *   mood="thinking"  eyes glance up and aside while a reply loads
 *
 * Everything is a transform on a MotionValue, so following the pointer never re-renders React,
 * and MotionConfig reducedMotion="user" freezes it for people who ask.
 */
export function FoxMascot({ size = 40, mood = 'idle', lookX, lookY, className }) {
  const still = useMotionValue(0);
  const lx = lookX ?? still;
  const ly = lookY ?? still;
  const thinking = mood === 'thinking';
  const happy = mood === 'happy';

  // Head: turns toward the target and shifts a touch.
  const headRotate = useTransform(lx, (v) => v * 9 + (thinking ? 4 : 0));
  const headX = useTransform(lx, (v) => v * 1.4);
  const headY = useTransform(ly, (v) => v * 1.2 + (thinking ? -1 : 0));
  // Face (muzzle, nose): further than the head. Eyes: further again.
  const faceX = useTransform(lx, (v) => v * 2.6);
  const faceY = useTransform(ly, (v) => v * 2);
  const eyeX = useTransform(lx, (v) => v * 4 + (thinking ? 1.8 : 0));
  const eyeY = useTransform(ly, (v) => v * 3 + (thinking ? -2 : 0));
  // Ears lean away from where it looks, and lift when it looks up.
  const earLeanL = useTransform(lx, (v) => -v * 7);
  const earLeanR = useTransform(lx, (v) => -v * 7);
  const earLift = useTransform(ly, (v) => Math.min(0, v) * 2.4);

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
      style={{ overflow: 'visible' }}
    >
      <motion.g
        style={{
          x: headX,
          y: headY,
          rotate: headRotate,
          transformOrigin: '32px 50px',
        }}
      >
        {/* ears */}
        <motion.g style={{ rotate: earLeanL, y: earLift, transformOrigin: '20px 24px' }}>
          <motion.g
            style={{ transformOrigin: '20px 24px' }}
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
        </motion.g>
        <motion.g style={{ rotate: earLeanR, y: earLift, transformOrigin: '44px 24px' }}>
          <path d="M55 32 L53 5 L33 19 Z" fill="#E04400" />
          <path d="M50 25 L49 12 L39 19 Z" fill="#FFC3A6" />
        </motion.g>

        {/* head */}
        <path d="M8 31 Q8 17 32 17 Q56 17 56 31 Q56 50 32 59 Q8 50 8 31 Z" fill="#FF4D00" />

        {/* face: muzzle, nose, mouth */}
        <motion.g style={{ x: faceX, y: faceY }}>
          <path d="M13 37 Q22 31 32 40 Q42 31 51 37 Q46 55 32 59 Q18 55 13 37 Z" fill="#FFF1EA" />
          <ellipse cx="32" cy="48.5" rx="3.2" ry="2.3" fill="#1A1918" />
          <path
            d="M28.5 52.5 Q32 55.5 35.5 52.5"
            fill="none"
            stroke="#1A1918"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {happy && (
            <>
              <circle cx="16.5" cy="42" r="3" fill="#FF9E74" opacity="0.5" />
              <circle cx="47.5" cy="42" r="3" fill="#FF9E74" opacity="0.5" />
            </>
          )}
        </motion.g>

        {/* eyes */}
        <motion.g style={{ x: eyeX, y: eyeY }}>
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
              <circle cx="23" cy="34" r="3.8" fill="#1A1918" />
              <circle cx="41" cy="34" r="3.8" fill="#1A1918" />
              <circle cx="24.3" cy="32.7" r="1.2" fill="#fff" />
              <circle cx="42.3" cy="32.7" r="1.2" fill="#fff" />
            </motion.g>
          )}
        </motion.g>
      </motion.g>
    </svg>
  );
}

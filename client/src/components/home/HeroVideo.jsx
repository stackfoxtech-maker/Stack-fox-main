import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Pause, Play } from 'lucide-react';
import Photo from '@components/Photo';

const EASE = [0.2, 0.7, 0.2, 1];

/**
 * Hero visual: a founder at work (looping, muted clip; see CREDITS.md) with the
 * product's live estimate floating over it. The clip only loads on wide screens
 * without reduced-motion or Save-Data; everyone else gets the poster frame.
 */
export function HeroVideo() {
  const reduce = useReducedMotion();
  const video = useRef(null);
  const [useVideo, setUseVideo] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)').matches;
    const saveData = navigator.connection?.saveData;
    setUseVideo(wide && !reduce && !saveData);
  }, [reduce]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div className="relative">
      <div className="relative aspect-[16/11] overflow-hidden rounded-[1.75rem] bg-warm-200 shadow-[0_40px_80px_-36px_rgba(26,25,24,0.45)] lg:aspect-[4/5]">
        {useVideo ? (
          <video
            ref={video}
            className="h-full w-full object-cover object-[48%_50%]"
            poster="/images/home/hero-video-poster-1920.webp"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          >
            <source src="/videos/home/hero-founder-desk-1080.webm" type="video/webm" />
            <source src="/videos/home/hero-founder-desk-1080.mp4" type="video/mp4" />
          </video>
        ) : (
          <Photo
            base="/images/home/hero-video-poster"
            widths={[960, 1920]}
            width={1920}
            height={1080}
            sizes="(min-width: 1024px) 40vw, 100vw"
            eager
            alt="A founder planning her project at a wooden desk beside a laptop"
            className="h-full w-full object-cover object-[48%_50%]"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-warm-900/35 via-transparent to-transparent" />

        {useVideo && (
          <button
            type="button"
            onClick={toggle}
            aria-label={paused ? 'Play background video' : 'Pause background video'}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-warm-900/55 text-white backdrop-blur transition-colors hover:bg-warm-900/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
      </div>

      {/* The product's own live estimate, floating over the scene. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.9, ease: EASE }}
        className="absolute -bottom-6 left-4 w-[17rem] rounded-lg bg-white p-4 shadow-[0_24px_48px_-20px_rgba(26,25,24,0.4)] ring-1 ring-warm-900/5 sm:-left-8 lg:-left-12"
      >
        <div className="flex items-center justify-between text-caption">
          <span className="font-medium text-warm-800">Your plan</span>
          <span className="flex items-center gap-1.5 text-sage-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-500" /> Live
          </span>
        </div>
        <ul className="mt-3 space-y-1.5 text-body-sm">
          {[
            ['Business website, 5 pages', '₹35,000'],
            ['Razorpay checkout', '₹12,000'],
            ['SEO starter pack', '₹15,000'],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span className="flex items-center gap-1.5 text-warm-800">
                <Check size={12} className="text-sage-600" /> {k}
              </span>
              <span className="tabular-nums text-warm-900">{v}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-warm-100 pt-3">
          <span className="text-caption text-warm-700">Total incl. GST</span>
          <span className="font-display text-xl font-bold tabular-nums text-fox-600">₹73,160</span>
        </div>
      </motion.div>
    </div>
  );
}

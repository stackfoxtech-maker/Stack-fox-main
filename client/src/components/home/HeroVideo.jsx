import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import Photo from '@components/Photo';

/**
 * Hero visual: a real screen recording of the StackFox Builder (services added
 * one by one, the plan and GST total building up), played inside a browser frame
 * on the brand stage. The recording is 15 s, ~0.7 MB and silent. People who
 * prefer reduced motion or have Save-Data on get the final frame as a still.
 */
export function HeroVideo() {
  const reduce = useReducedMotion();
  const video = useRef(null);
  const [useVideo, setUseVideo] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setUseVideo(!reduce && !navigator.connection?.saveData);
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
    <div className="brand-stage p-3 sm:p-6 lg:p-12">
      <div className="mx-auto max-w-[1080px] overflow-hidden rounded-[1.1rem] bg-white shadow-[0_1px_0_rgba(26,25,24,0.04),0_40px_80px_-32px_rgba(26,25,24,0.45)] ring-1 ring-warm-900/10">
        <div className="flex items-center gap-3 border-b border-warm-100 bg-warm-50 px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-warm-200" />
          </div>
          <div className="mx-auto rounded-sm bg-white px-3 py-1 font-mono text-[11px] text-warm-700 ring-1 ring-warm-100">
            stackfox.in/builder
          </div>
          <span className="w-[42px]" aria-hidden />
        </div>

        <div className="relative aspect-[8/5] bg-warm-50">
          {useVideo ? (
            <video
              ref={video}
              className="h-full w-full object-cover"
              poster="/images/home/hero-builder-poster-1440.webp"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Screen recording of the Builder: services are added one by one and the plan total builds up"
            >
              <source src="/videos/home/hero-builder-demo.mp4" type="video/mp4" />
            </video>
          ) : (
            <Photo
              base="/images/home/hero-builder-poster"
              widths={[800, 1440]}
              width={1440}
              height={900}
              sizes="(min-width: 1280px) 1080px, 100vw"
              eager
              alt="The StackFox Builder with four services added and a total of ₹76,700 including GST"
              className="h-full w-full object-cover"
            />
          )}

          {useVideo && (
            <button
              type="button"
              onClick={toggle}
              aria-label={paused ? 'Play demo video' : 'Pause demo video'}
              className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-warm-900/70 text-white backdrop-blur transition-colors hover:bg-warm-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

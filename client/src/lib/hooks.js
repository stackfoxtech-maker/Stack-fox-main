import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * IntersectionObserver hook for scroll-reveal animations.
 * Returns a ref to attach to the element.
 */
export const useScrollReveal = (options = {}) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el); // Only trigger once
        }
      },
      { threshold: options.threshold || 0.1, rootMargin: options.rootMargin || '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return { ref, isVisible };
};

/**
 * Click outside detection.
 */
export const useClickOutside = (callback) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [callback]);

  return ref;
};

/**
 * Debounced value.
 */
export const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

/**
 * Media query hook.
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

/**
 * Set document title.
 */
export const usePageTitle = (title) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — StackFox` : 'StackFox — Smart Code, Swift Delivery';
    return () => { document.title = prev; };
  }, [title]);
};

/**
 * Animate a number toward `end` whenever it changes — the "signature moment"
 * from DESIGN.md: the running total ticking up as pieces are added.
 * First paint eases up from ~60% of the value; later changes ease from the
 * previous value. Honours prefers-reduced-motion (snaps).
 * `ref` is returned for API compatibility; attach it to the total if you like.
 */
export const useCountUp = (end, { duration = 700, decimals = 0, startDelay = 0 } = {}) => {
  const ref = useRef(null);
  const from = useRef(Math.round(end * 0.6));
  const firstRun = useRef(true);
  const [value, setValue] = useState(end);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const a = from.current;
    const b = end;
    from.current = b;
    const delay = firstRun.current ? startDelay : 0;
    firstRun.current = false;
    if (reduce || a === b) { setValue(b); return; }

    let raf;
    let startTs;
    const tick = (now) => {
      if (startTs === undefined) startTs = now;
      const t = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = a + (b - a) * eased;
      setValue(decimals ? +next.toFixed(decimals) : Math.round(next));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [end, duration, decimals, startDelay]);

  return { ref, value };
};

/**
 * Scroll to top on mount.
 */
export const useScrollToTop = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
};

/**
 * Local storage state.
 */
export const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or disabled
    }
  }, [key, value]);

  return [value, setValue];
};

/**
 * Keyboard shortcut listener.
 */
export const useKeyboard = (key, callback, deps = []) => {
  const cb = useCallback(callback, deps);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === key && !e.target.closest('input, textarea, select, [contenteditable]')) {
        e.preventDefault();
        cb(e);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, cb]);
};

/**
 * Track scroll position (for sticky nav).
 */
export const useScrollPosition = (threshold = 20) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);

  return isScrolled;
};

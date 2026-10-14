import { useState, useEffect, useRef, useCallback } from 'react';
import { SITE, absUrl, clip } from './seo';

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
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px 0px -50px 0px',
      },
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

const upsert = (selector, make) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = make();
    document.head.appendChild(el);
  }
  return el;
};
const metaEl = (attr, key) => () => {
  const m = document.createElement('meta');
  m.setAttribute(attr, key);
  return m;
};

/**
 * Per-route head: title, optional description, canonical + og:url from the current path.
 * Pass { noindex: true } for pages that should stay out of search (stubs, not-found states).
 * The prerendered HTML (scripts/prerender.mjs) carries the same values for crawlers that skip JS.
 */
export const usePageTitle = (title, description, { noindex = false } = {}) => {
  useEffect(() => {
    if (title === undefined) return undefined;
    const full = title ? `${title} — ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
    const url = absUrl(window.location.pathname);
    const targets = [
      ['meta[property="og:title"]', metaEl('property', 'og:title'), full],
      ['meta[name="twitter:title"]', metaEl('name', 'twitter:title'), full],
      ['meta[property="og:url"]', metaEl('property', 'og:url'), url],
    ];
    if (description) {
      const d = clip(description, 200);
      targets.push(
        ['meta[name="description"]', metaEl('name', 'description'), d],
        ['meta[property="og:description"]', metaEl('property', 'og:description'), d],
        ['meta[name="twitter:description"]', metaEl('name', 'twitter:description'), d],
      );
    }
    if (noindex) targets.push(['meta[name="robots"]', metaEl('name', 'robots'), 'noindex']);
    const canonical = upsert('link[rel="canonical"]', () => {
      const l = document.createElement('link');
      l.rel = 'canonical';
      return l;
    });

    const prevTitle = document.title;
    const prevCanonical = canonical.getAttribute('href');
    const prev = targets.map(([sel, make, val]) => {
      const el = upsert(sel, make);
      const old = el.getAttribute('content');
      el.setAttribute('content', val);
      return [el, old];
    });
    document.title = full;
    canonical.setAttribute('href', url);
    return () => {
      document.title = prevTitle;
      if (prevCanonical) canonical.setAttribute('href', prevCanonical);
      prev.forEach(([el, old]) => (old === null ? el.remove() : el.setAttribute('content', old)));
    };
  }, [title, description, noindex]);
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
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const a = from.current;
    const b = end;
    from.current = b;
    const delay = firstRun.current ? startDelay : 0;
    firstRun.current = false;
    if (reduce || a === b) {
      setValue(b);
      return;
    }

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
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
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

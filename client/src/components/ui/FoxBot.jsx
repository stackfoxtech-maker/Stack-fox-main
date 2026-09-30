import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { Sparkles, X, ArrowUp, ArrowRight } from 'lucide-react';
import { FoxMascot } from '@components/ui/FoxMascot';
import api from '@lib/api';

// Shown until the server's page-specific chips arrive (or if it is unreachable).
const DEFAULT_STARTERS = [
  'What does a website cost?',
  'Show me packages',
  'How does it work?',
  'How do payments work?',
];
const EASE = [0.2, 0.7, 0.2, 1];
const GREETED_KEY = 'sf_foxbot_greeted';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } };
const pop = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE } },
};

/** Three bouncing dots — shown while the reply is on its way. */
function TypingDots() {
  return (
    <div
      className="mr-6 flex w-fit gap-1 rounded-xl border border-warm-100 bg-warm-50 px-3.5 py-3"
      role="status"
      aria-label="FoxBot is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-fox-400"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export function FoxBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [nudge, setNudge] = useState(false);
  // Where the fox is looking, as springs: pointer moves update them without re-rendering React.
  const lookX = useSpring(useMotionValue(0), { stiffness: 170, damping: 14, mass: 0.6 });
  const lookY = useSpring(useMotionValue(0), { stiffness: 170, damping: 14, mass: 0.6 });
  // It perks up (grows a little) as the pointer or a finger gets close.
  const perk = useSpring(1, { stiffness: 220, damping: 16 });
  // On phones the button tucks toward the edge while scrolling down, so it never sits on
  // top of prices or add buttons, and slides back out on scroll up.
  const [tucked, setTucked] = useState(false);
  const [starters, setStarters] = useState(DEFAULT_STARTERS);
  const { pathname } = useLocation();
  const scrollRef = useRef(null);
  const fabRef = useRef(null);

  // Opening chips fit the page: pricing questions on /pricing, invoices in the dashboard.
  useEffect(() => {
    let live = true;
    api
      .get('/assistant/suggestions', { params: { page: pathname } })
      .then(({ data }) => {
        if (live && data?.data?.suggestions?.length) setStarters(data.data.suggestions);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!window.matchMedia?.('(max-width: 1023px)').matches) return undefined;
    let last = window.scrollY;
    let idle;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      last = y;
      if (Math.abs(dy) < 6) return;
      setTucked(dy > 0 && y > 160);
      clearTimeout(idle);
      idle = setTimeout(() => setTucked(false), 1400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idle);
    };
  }, []);

  // The fox follows the pointer, or a finger while it is down, with its whole head. Close by it
  // perks up; a still pointer for a few seconds and it glances around on its own; scrolling
  // makes it look the way the page is going. Frame-throttled, and it never re-renders React.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    let lastMove = Date.now();
    const aim = (cx, cy) => {
      const r = fabRef.current?.getBoundingClientRect();
      if (!r) return;
      const vx = cx - (r.left + r.width / 2);
      const vy = cy - (r.top + r.height / 2);
      const d = Math.hypot(vx, vy) || 1;
      const k = Math.min(1, d / 200);
      lookX.set((vx / d) * k);
      lookY.set((vy / d) * k);
      perk.set(1 + Math.max(0, 1 - d / 240) * 0.16);
    };
    const onMove = (e) => {
      lastMove = Date.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => aim(e.clientX, e.clientY));
    };
    const onLeave = () => {
      lookX.set(0);
      lookY.set(0);
      perk.set(1);
    };
    let lastY = window.scrollY;
    let scrollReset;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (Math.abs(dy) < 4) return;
      lastMove = Date.now();
      lookX.set(0);
      lookY.set(dy > 0 ? 0.9 : -0.9);
      clearTimeout(scrollReset);
      scrollReset = setTimeout(() => lookY.set(0), 450);
    };
    // Idle: an occasional look to the side, so it never sits frozen.
    const glance = setInterval(() => {
      if (Date.now() - lastMove < 3500) return;
      lookX.set((Math.random() * 2 - 1) * 0.9);
      lookY.set((Math.random() * 2 - 1) * 0.4);
      setTimeout(() => {
        lookX.set(0);
        lookY.set(0);
      }, 900);
    }, 3200);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerup', onLeave, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      window.removeEventListener('pointerup', onLeave);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      clearInterval(glance);
      clearTimeout(scrollReset);
      cancelAnimationFrame(raf);
    };
  }, [lookX, lookY, perk]);

  // Say hello once per session, a few seconds in, then get out of the way.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(GREETED_KEY) === '1';
    } catch {
      /* storage unavailable — greet anyway */
    }
    if (seen) return undefined;
    const show = setTimeout(() => setNudge(true), 5500);
    const hide = setTimeout(() => setNudge(false), 14000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);
  const dismissNudge = () => {
    setNudge(false);
    try {
      sessionStorage.setItem(GREETED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/assistant/chat', { message: trimmed, page: pathname });
      const a = data.data;
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: a.reply, links: a.links, suggestions: a.suggestions },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text:
            err.response?.data?.message ||
            "Sorry, I'm having trouble responding right now — try again in a moment.",
          suggestions: ['Talk to a human'],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const toggle = () => {
    dismissNudge();
    setOpen((v) => !v);
  };
  const mood = sending ? 'thinking' : open ? 'happy' : 'idle';

  return (
    <div className="foxbot-fab fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end transition-[bottom] duration-300 sm:right-6 lg:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{
              width: 'min(292px, calc(100vw - 1.5rem))',
              maxHeight: '480px',
              transformOrigin: 'bottom right',
            }}
            className="mb-3 flex flex-col rounded-2xl border border-warm-200 bg-white p-4 shadow-[0_16px_64px_rgba(0,0,0,0.12)]"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-fox-50 ring-1 ring-fox-100">
                <FoxMascot
                  size={30}
                  mood={mood === 'idle' ? 'happy' : mood}
                  lookX={lookX}
                  lookY={lookY}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-warm-900">FoxBot</div>
                <div className="flex items-center gap-1 text-[10px] text-warm-400">
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  </span>
                  Online
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-700"
                aria-label="Close chat"
              >
                <X size={14} />
              </button>
            </div>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              className="mb-3 flex-1 space-y-2.5 overflow-y-auto pr-0.5"
              style={{ minHeight: '120px' }}
            >
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.3, ease: EASE }}
                  className="rounded-xl border border-fox-100/50 bg-fox-50 p-3.5 text-xs leading-relaxed text-warm-700"
                >
                  <div className="mb-1 flex items-center gap-1.5 font-bold text-fox-600">
                    Hi, I'm FoxBot <Sparkles size={10} />
                  </div>
                  I know StackFox's services, prices, packages and how projects run. Ask me
                  anything, or pick a question below.
                </motion.div>
              )}
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  style={{ transformOrigin: m.role === 'user' ? 'bottom right' : 'bottom left' }}
                  className={`whitespace-pre-wrap rounded-xl p-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-6 bg-fox-500 text-white'
                      : 'mr-6 border border-warm-100 bg-warm-50 text-warm-700'
                  }`}
                >
                  {m.text}
                  {m.links?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link
                          key={l.to + l.label}
                          to={l.to}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-fox-600 ring-1 ring-fox-200 transition-colors hover:bg-fox-50"
                        >
                          {l.label} <ArrowRight size={10} />
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              {sending && <TypingDots />}
            </div>

            {(() => {
              const last = messages[messages.length - 1];
              const chips =
                messages.length === 0 ? starters : last?.role === 'bot' ? last.suggestions : [];
              if (!chips?.length || sending) return null;
              return (
                <motion.div
                  key={messages.length}
                  variants={list}
                  initial="hidden"
                  animate="show"
                  className="mb-3 flex flex-wrap gap-1.5"
                >
                  {chips.map((q) => (
                    <motion.button
                      key={q}
                      variants={pop}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => send(q)}
                      className="border-warm-150 rounded-lg border bg-warm-50 px-2.5 py-1 text-left text-[11px] text-warm-600 transition-colors hover:border-fox-200 hover:text-fox-600"
                    >
                      {q}
                    </motion.button>
                  ))}
                </motion.div>
              );
            })()}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask FoxBot anything..."
                className="flex-1 rounded-xl border border-warm-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-fox-500/30"
                disabled={sending}
              />
              <motion.button
                type="submit"
                disabled={sending || !input.trim()}
                whileTap={{ scale: 0.9 }}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-fox-500 text-white transition hover:bg-fox-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send"
              >
                <ArrowUp size={14} />
              </motion.button>
            </form>

            <Link
              to="/contact"
              className="mt-2 text-center text-[10px] text-warm-400 hover:text-fox-500"
            >
              Prefer talking to a human? Book a free call
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="relative"
        animate={{ x: tucked && !open ? 30 : 0, opacity: tucked && !open ? 0.75 : 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {/* Greeting bubble — once per session, dismissible. */}
        <AnimatePresence>
          {nudge && !open && (
            <motion.div
              key="nudge"
              initial={{ opacity: 0, x: 12, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              style={{ transformOrigin: 'right center' }}
              className="absolute bottom-2 right-full mr-3 flex w-max max-w-[min(15rem,calc(100vw-6.5rem))] items-start gap-2 rounded-2xl rounded-br-md border border-warm-200 bg-white py-2.5 pl-3.5 pr-2 text-xs text-warm-700 shadow-lg"
            >
              <button onClick={toggle} className="text-left leading-snug">
                <span className="font-bold text-warm-900">Hi, I'm FoxBot 👋</span>
                <br />
                Want a quick price for your idea?
              </button>
              <button
                onClick={dismissNudge}
                aria-label="Dismiss"
                className="rounded-md p-0.5 text-warm-400 hover:bg-warm-100 hover:text-warm-700"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Soft attention rings while the greeting is up. */}
        {nudge && !open && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-ring-out rounded-full border-2 border-fox-400"
          />
        )}

        <motion.button
          ref={fabRef}
          onClick={toggle}
          aria-label={open ? 'Close FoxBot chat' : 'Open FoxBot chat'}
          aria-expanded={open}
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 1.2 }}
          whileHover={{ scale: 1.08, rotate: -4 }}
          whileTap={{ scale: 0.92 }}
          className="relative grid h-12 w-12 place-items-center rounded-full border border-fox-100 bg-white shadow-[0_8px_28px_rgba(255,77,0,0.26)] sm:h-16 sm:w-16"
        >
          <motion.span
            className="grid place-items-center"
            style={{ scale: perk }}
            animate={open ? { y: 0 } : { y: [0, -3, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <FoxMascot
              size={40}
              mood={mood}
              lookX={lookX}
              lookY={lookY}
              className="sm:h-11 sm:w-11"
            />
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
  );
}

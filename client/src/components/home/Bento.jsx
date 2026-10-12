import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  FileArchive,
  FileImage,
  FileSignature,
  FileText,
  IndianRupee,
  Link2,
  ListChecks,
  Rocket,
} from 'lucide-react';
import { Reveal } from '@components/Reveal';
import { CountOnView, useSeen } from './HomeMotion';

const EASE = [0.2, 0.7, 0.2, 1];

const ring =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox-500';

const MILESTONES = [
  {
    name: 'Design approved',
    pct: 100,
    what: 'Brand kit, homepage and product page designs',
    when: 'Week 1',
    who: 'Approved by Neha',
  },
  {
    name: 'Build & integrate',
    pct: 100,
    what: 'Storefront, payments and shipping integrations',
    when: 'Week 3',
    who: 'Approved by Neha',
  },
  {
    name: 'Review & QA',
    pct: 64,
    what: '12 of 19 checks passed; fixes land on staging',
    when: 'Due week 5',
    who: 'Approver: Neha',
  },
  {
    name: 'Launch',
    pct: 0,
    what: 'Go-live, DNS cut-over and handover of files',
    when: 'Week 6',
    who: 'Approver: Neha',
  },
];

/** Milestone bars fill in one after another when the tile scrolls into view.
 *  Each row is a button that opens an inline detail (one at a time). */
function MilestoneDemo() {
  const ref = useRef(null);
  const seen = useSeen(ref, 0.4);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(null);
  return (
    <ul ref={ref} data-row="milestones" className="space-y-2.5">
      {MILESTONES.map((m, i) => {
        const done = m.pct === 100;
        const isOpen = open === i;
        return (
          <li key={m.name}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`ws-ms-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className={`-mx-2 block w-[calc(100%+1rem)] rounded-sm px-2 py-1 text-left transition-colors duration-150 hover:bg-warm-50 active:scale-[0.99] ${ring}`}
            >
              <span className="mb-1.5 flex items-center justify-between text-caption">
                <span className="flex items-center gap-1.5 font-medium text-warm-800">
                  {done ? (
                    <motion.span
                      initial={reduce ? false : { scale: 0 }}
                      animate={{ scale: seen || reduce ? 1 : 0 }}
                      transition={{
                        delay: 0.5 + i * 0.35,
                        type: 'spring',
                        stiffness: 380,
                        damping: 16,
                      }}
                      className="grid h-4 w-4 place-items-center rounded-full bg-sage-500 text-white"
                    >
                      <Check size={10} strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-warm-300" />
                  )}
                  {m.name}
                </span>
                <span className="flex items-center gap-1 tabular-nums text-warm-700">
                  {m.pct}%
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className={`transition-transform duration-200 motion-reduce:transition-none ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </span>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-pill bg-warm-100">
                <motion.span
                  className={`block h-full rounded-pill ${done ? 'bg-sage-500' : 'bg-fox-500'}`}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: seen || reduce ? `${m.pct}%` : 0 }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.35, ease: EASE }}
                />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`ws-ms-${i}`}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.26, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 rounded-sm bg-warm-50 px-3 py-2 text-caption text-warm-800">
                    <p>{m.what}</p>
                    <p className="mt-0.5 tabular-nums text-warm-700">
                      {m.when} · {m.who}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

// Index order is the display order on load (descending from 0), so ages read newest to oldest.
const EVENTS = [
  { icon: CheckCircle2, text: 'Design approved by Neha' },
  { icon: FileSignature, text: 'Contract countersigned' },
  { icon: ListChecks, text: 'QA: 12 of 19 checks passed' },
  { icon: Rocket, text: 'Staging build deployed · v0.8' },
  { icon: IndianRupee, text: 'Invoice INV-0142 paid · ₹28,320 · UPI' },
];
const AGES = ['2m', '18m', '1h', '3h'];
const VISIBLE = 4;
const eventAt = (n) => EVENTS[((n % EVENTS.length) + EVENTS.length) % EVENTS.length];

/** Activity feed: every ~2.2s the next event slides in on top and the oldest leaves.
 *  New rows age on screen ("just now", 1m, 2m...). Paused while off-screen or hovered/focused;
 *  static for reduced motion. `onEvent` lets the bell and toast react to an arrival. */
function ActivityFeed({ inView, onEvent }) {
  const reduce = useReducedMotion();
  const [head, setHead] = useState(0);
  const [held, setHeld] = useState(false);
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    if (reduce || !inView || held) return undefined;
    const t = setInterval(() => setHead((h) => h + 1), 2200);
    return () => clearInterval(t);
  }, [reduce, inView, held]);
  useEffect(() => {
    if (head > 0) cb.current?.(eventAt(head), head);
  }, [head]);

  // `head` keeps climbing so each arriving row gets a fresh key and animates in.
  const rows = Array.from({ length: VISIBLE }, (_, i) => {
    const n = head - i;
    const meta = head > 0 && i === 0 ? 'just now' : head > 0 ? `${i * 2}m` : AGES[i];
    return { key: n, ...eventAt(n), meta };
  });

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <ul className="relative -mx-2 space-y-1 overflow-hidden" aria-live="off">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map(({ key, icon: Icon, text, meta }) => (
            <motion.li
              key={key}
              layout={!reduce}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{
                duration: 0.45,
                ease: EASE,
                layout: { type: 'spring', stiffness: 420, damping: 36 },
              }}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 text-body-sm transition-colors hover:bg-warm-50"
            >
              <Icon size={15} strokeWidth={1.75} className="shrink-0 text-warm-700" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-warm-800">{text}</span>
              <span className="shrink-0 tabular-nums text-caption text-warm-700">{meta}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

const TABS = [
  { id: 'milestones', label: 'Milestones' },
  { id: 'files', label: 'Files' },
  { id: 'invoices', label: 'Invoices' },
];

const FILES = [
  { icon: FileArchive, name: 'brand-kit.zip', size: '12 MB', state: 'Approved' },
  { icon: FileImage, name: 'homepage-v3.fig', size: '4.2 MB', state: 'Approved' },
  { icon: FileSignature, name: 'contract-signed.pdf', size: '186 KB', state: 'Signed' },
  { icon: Link2, name: 'staging link', size: 'Link', state: 'In review' },
];

// Milestone-based split of a ₹56,640 + ₹9,440 project, GST 18% included.
const INVOICES = [
  { id: 'INV-0140', label: 'Kickoff', amount: '₹14,160', gst: '₹2,160', paid: true },
  { id: 'INV-0141', label: 'Design approved', amount: '₹14,160', gst: '₹2,160', paid: true },
  { id: 'INV-0142', label: 'Build', amount: '₹28,320', gst: '₹4,320', paid: true },
  { id: 'INV-0143', label: 'Launch', amount: '₹9,440', gst: '₹1,440', paid: false },
];

function StatePill({ ok, children }) {
  return (
    <span
      className={`shrink-0 rounded-pill px-2 py-0.5 text-caption font-medium ${
        ok ? 'bg-sage-50 text-sage-700' : 'bg-fox-50 text-fox-700'
      }`}
    >
      {children}
    </span>
  );
}

// Rows settle in one after another when a tab opens.
const rowIn = (i, reduce) => ({
  initial: reduce ? false : { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: EASE, delay: 0.05 + i * 0.045 },
});

const iconBox = 'grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-warm-50 text-warm-700';

/** `data-row` marks what a linked highlight can pulse ("approved", "signed", "paid"...). */
function FilesPanel() {
  const reduce = useReducedMotion();
  return (
    <ul data-row="files" className="divide-y divide-warm-100">
      {FILES.map(({ icon: Icon, name, size, state }, i) => (
        <motion.li
          key={name}
          {...rowIn(i, reduce)}
          data-row={state.toLowerCase().replace(' ', '-')}
          className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-150 hover:bg-warm-50"
        >
          <span className={iconBox}>
            <Icon size={16} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-warm-900">
            {name}
          </span>
          <span className="hidden shrink-0 text-caption tabular-nums text-warm-700 sm:inline">
            {size}
          </span>
          <StatePill ok={state !== 'In review'}>{state}</StatePill>
        </motion.li>
      ))}
    </ul>
  );
}

function InvoicesPanel() {
  const reduce = useReducedMotion();
  return (
    <ul data-row="invoices" className="divide-y divide-warm-100">
      {INVOICES.map((inv, i) => (
        <motion.li
          key={inv.id}
          {...rowIn(i, reduce)}
          data-row={inv.paid ? 'paid' : 'pending'}
          className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-150 hover:bg-warm-50"
        >
          <span className={iconBox}>
            <FileText size={16} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-sm font-medium text-warm-900">
              {inv.id} <span className="font-normal text-warm-700">· {inv.label}</span>
            </span>
            <span className="block text-caption tabular-nums text-warm-700">
              incl. GST 18% {inv.gst}
            </span>
          </span>
          <span className="shrink-0 font-display tabular-nums text-warm-900">{inv.amount}</span>
          <StatePill ok={inv.paid}>{inv.paid ? 'Paid' : 'Pending'}</StatePill>
        </motion.li>
      ))}
    </ul>
  );
}

/** Real tablist: a shared underline slides between tabs; arrows / Home / End move focus. */
function Tabs({ tab, onTab, reduce }) {
  const onKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n === null) return;
    e.preventDefault();
    onTab(TABS[n].id);
    document.getElementById(`ws-tab-${TABS[n].id}`)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Workspace sections"
      onKeyDown={onKeyDown}
      className="mb-5 flex gap-1 border-b border-warm-100 text-body-sm"
    >
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            id={`ws-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`ws-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(t.id)}
            className={`relative min-h-[44px] rounded-sm px-3 transition-colors duration-150 active:scale-[0.98] sm:min-h-[40px] ${ring} ${
              on ? 'font-medium text-warm-900' : 'text-warm-700 hover:text-warm-900'
            }`}
          >
            {t.label}
            {on && (
              <motion.span
                layoutId="ws-tab-underline"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }
                }
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-pill bg-warm-900"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Which elements a point proves; the pulse finds them by `data-row` / `data-bell`.
const PULSE = [
  '[data-row="milestones"]',
  '[data-bell]',
  '[data-row="paid"]',
  '[data-row="approved"]',
  '[data-row="signed"]',
];

/** One-shot fox flash on whatever the active point refers to. Uses the independent `scale`
 *  property so it never fights framer's own transform. Retries once while the tab swaps in. */
function usePulse(rootRef, active, reduce) {
  useEffect(() => {
    if (reduce || active === null) return undefined;
    const run = () => {
      const els = rootRef.current?.querySelectorAll(PULSE[active]) ?? [];
      els.forEach((el) =>
        el.animate(
          [
            { scale: 1, backgroundColor: 'rgba(255,77,0,0.18)' },
            { scale: 1.015, backgroundColor: 'rgba(255,77,0,0.10)', offset: 0.35 },
            { scale: 1, backgroundColor: 'rgba(255,77,0,0)' },
          ],
          { duration: 700, easing: 'cubic-bezier(0.2,0.7,0.2,1)' },
        ),
      );
      return els.length > 0;
    };
    let t;
    if (!run()) t = setTimeout(run, 480);
    return () => clearTimeout(t);
  }, [active, reduce, rootRef]);
}

// Dashboard rows -> the point they prove (hovering the proof lights the claim).
const ROW_POINT = { milestones: 0, paid: 2, approved: 3, signed: 4 };

function Dashboard({ tab, onTab, active, onLink }) {
  const panelRef = useRef(null);
  const inView = useInView(panelRef, { amount: 0.2 });
  const reduce = useReducedMotion();
  const bell = useAnimationControls();
  const [unread, setUnread] = useState(3);
  const [toast, setToast] = useState(null);
  usePulse(panelRef, active, reduce);

  const rowLink = (e) => {
    const i = ROW_POINT[e.target.closest?.('[data-row]')?.dataset.row];
    if (i !== undefined) onLink(i);
  };
  // Swipe (touch or drag) moves one tab; the tab order is the swipe order.
  const swipe = (_, { offset }) => {
    if (Math.abs(offset.x) < 50) return;
    const i = TABS.findIndex((t) => t.id === tab) + (offset.x < 0 ? 1 : -1);
    if (TABS[i]) onTab(TABS[i].id);
  };

  // Every second feed arrival reaches the bell: badge +1, one ring, a toast.
  const onEvent = useCallback(
    (ev, n) => {
      if (n % 2) return;
      setUnread((u) => u + 1);
      setToast({ id: n, text: ev.text });
      bell.start({ rotate: [0, -14, 12, -8, 4, 0], transition: { duration: 0.5 } });
    },
    [bell],
  );
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div
      ref={panelRef}
      className="relative rounded-lg bg-white p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] ring-1 ring-black/5 sm:p-6 md:p-8"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-body-sm text-warm-700">
          Client dashboard · <span className="font-medium text-warm-900">D2C storefront</span>
        </p>
        <div className="flex shrink-0 items-center gap-3 text-caption">
          <span className="flex items-center gap-1.5 text-sage-700">
            <span className="relative grid h-2 w-2 place-items-center">
              {!reduce && (
                <motion.span
                  className="absolute h-2 w-2 rounded-full bg-sage-500"
                  animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="h-2 w-2 rounded-full bg-sage-500" />
            </span>
            Live
          </span>
          <span className="hidden tabular-nums text-warm-700 sm:inline">Week 4 of 6</span>
          <button
            type="button"
            data-bell
            aria-label={`Notifications, ${unread} new`}
            onClick={() => {
              setUnread(0);
              setToast(null);
            }}
            className={`relative grid h-11 w-11 place-items-center rounded-full text-warm-800 transition-colors hover:bg-warm-50 active:scale-95 sm:h-9 sm:w-9 ${ring}`}
          >
            <motion.span animate={bell} style={{ transformOrigin: '50% 10%' }} className="grid">
              <Bell size={17} strokeWidth={1.75} aria-hidden />
            </motion.span>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  aria-hidden
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={reduce ? undefined : { scale: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center overflow-hidden rounded-full bg-fox-500 px-1 text-[10px] font-medium leading-none tabular-nums text-white sm:right-0.5 sm:top-0.5"
                >
                  {/* Number roll: the old count leaves upward, the new one rises in. */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={unread}
                      initial={reduce ? false : { y: 9, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={reduce ? undefined : { y: -9, opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      {unread}
                    </motion.span>
                  </AnimatePresence>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            role="status"
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute right-4 top-16 z-10 max-w-[75%] truncate rounded-md bg-warm-900 px-3 py-2 text-caption text-white shadow-lg sm:right-6"
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>

      <Tabs tab={tab} onTab={onTab} reduce={reduce} />

      {/* Fixed height: switching tabs never shifts the feed and stats below. */}
      <motion.div
        role="tabpanel"
        id={`ws-panel-${tab}`}
        aria-labelledby={`ws-tab-${tab}`}
        tabIndex={0}
        onPanEnd={swipe}
        onMouseOver={rowLink}
        onFocus={rowLink}
        onMouseLeave={() => onLink(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) onLink(null);
        }}
        style={{ touchAction: 'pan-y' }}
        className={`-mx-2 h-[256px] overflow-y-auto overflow-x-hidden px-2 ${ring}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
          >
            {tab === 'milestones' && <MilestoneDemo />}
            {tab === 'files' && <FilesPanel />}
            {tab === 'invoices' && <InvoicesPanel />}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="mt-5 border-t border-warm-100 pt-5">
        <p className="mb-2 text-caption font-medium uppercase tracking-wide text-warm-700">
          Activity
        </p>
        <ActivityFeed inView={inView} onEvent={onEvent} />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-warm-100 pt-5">
        {[
          ['Paid so far', <CountOnView key="p" end={56640} prefix="₹" />],
          ['On schedule', <CountOnView key="s" end={100} suffix="%" />],
          ['Files shared', <CountOnView key="f" end={18} />],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-caption text-warm-700">{k}</dt>
            <dd className="mt-0.5 font-display text-title tabular-nums text-warm-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// `tab` is the dashboard tab a point proves; null = nothing to switch to.
const TAB_POINT = { milestones: 0, invoices: 2, files: 3 };

const POINTS = [
  {
    title: 'A clear view of progress',
    body: 'Follow milestones, review deliverables and keep conversations in one place.',
    tab: 'milestones',
  },
  {
    title: 'A real person within a working day',
    body: 'Ask, change scope, add a piece. The plan and the price update with the answer.',
    tab: null,
  },
  {
    title: 'Payments tied to progress',
    body: 'Itemised GST invoices, paid milestone by milestone.',
    tab: 'invoices',
  },
  {
    title: 'A proper handover',
    body: 'Files, signed agreements and project details stay in your workspace.',
    tab: 'files',
  },
  { title: 'You own it', body: 'The code and IP are yours. NDA on request.', tab: 'files' },
];

/** A live dashboard view beside the list of what is handled after you sign. Sits on a dark band. */
export function Bento() {
  const stageRef = useRef(null);
  const reduce = useReducedMotion();
  // Shared state: tabs and the five points drive each other (the linking pass builds on `active`).
  const [tab, setTab] = useState('milestones');
  const [active, setActive] = useState(null);
  // Auto-demo: once seen, after 6s of no input the points light up one by one, once.
  const seen = useInView(stageRef, { once: true, amount: 0.4 });
  const [auto, setAuto] = useState(true);
  const autoCur = useRef(null);
  const stop = useCallback(() => setAuto(false), []);
  useEffect(() => {
    if (reduce || !auto || !seen) return undefined;
    const timers = [];
    const step = (i) => {
      if (i >= POINTS.length) {
        autoCur.current = null;
        setActive(null);
        setAuto(false);
        return;
      }
      autoCur.current = i;
      setActive(i);
      if (POINTS[i].tab) setTab(POINTS[i].tab);
      timers.push(setTimeout(() => step(i + 1), 2400));
    };
    timers.push(setTimeout(() => step(0), 6000));
    return () => {
      timers.forEach(clearTimeout);
      // Input arrived mid-demo: drop the demo's highlight unless the visitor took it over.
      const c = autoCur.current;
      autoCur.current = null;
      if (c !== null) setActive((a) => (a === c ? null : a));
    };
  }, [auto, seen, reduce]);
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start end', 'center center'],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  // The glow drifts against the panel's tilt so the two layers read as separate depths.
  const glowY = useTransform(scrollYProgress, [0, 1], [50, -30]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.6], [0.3, 1]);

  const activate = (i) => {
    autoCur.current = null;
    setActive(i);
    if (POINTS[i].tab) setTab(POINTS[i].tab);
  };
  // Clicking a tab proves its claim: light the matching point.
  const pickTab = (id) => {
    autoCur.current = null;
    setTab(id);
    setActive(TAB_POINT[id]);
  };
  const linkRow = (i) => {
    autoCur.current = null;
    setActive(i);
  };

  return (
    <div
      onPointerEnter={stop}
      onPointerDown={stop}
      onFocus={stop}
      className="mt-10 grid grid-cols-1 gap-10 md:mt-14 lg:grid-cols-12 lg:gap-16"
    >
      <div ref={stageRef} className="relative min-w-0 lg:col-span-7">
        <motion.div
          aria-hidden
          data-glow
          style={reduce ? undefined : { y: glowY, opacity: glowOpacity }}
          className="pointer-events-none absolute inset-x-[8%] bottom-[-6%] top-[30%] rounded-[50%] bg-fox-500/20 blur-3xl"
        />
        <motion.div
          className="relative"
          style={reduce ? undefined : { rotateX, scale, transformPerspective: 1200 }}
        >
          <Dashboard tab={tab} onTab={pickTab} active={active} onLink={linkRow} />
        </motion.div>
      </div>

      <Reveal as="dl" stagger className="border-t border-white/10 lg:col-span-5">
        {POINTS.map((p, i) => {
          const on = active === i;
          return (
            <Reveal.Item key={p.title} className="border-b border-white/10">
              <div
                tabIndex={0}
                data-point={i}
                onMouseEnter={() => activate(i)}
                onClick={() => activate(i)}
                onFocus={() => activate(i)}
                onMouseLeave={() => setActive(null)}
                onBlur={() => setActive(null)}
                className="relative cursor-default py-5 pl-5 outline-none transition-colors duration-200 hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-fox-500 active:bg-white/[0.05]"
              >
                <span
                  aria-hidden
                  className={`absolute bottom-5 left-0 top-5 w-0.5 origin-top rounded-pill bg-fox-500 transition-transform duration-300 motion-reduce:transition-none ${
                    on ? 'scale-y-100' : 'scale-y-0'
                  }`}
                />
                <dt
                  className={`font-medium transition-colors duration-200 ${
                    on || active === null ? 'text-white' : 'text-warm-200'
                  }`}
                >
                  {p.title}
                </dt>
                <dd
                  className={`mt-1 text-body-sm transition-colors duration-200 ${
                    on ? 'text-white' : 'text-warm-200'
                  }`}
                >
                  {p.body}
                </dd>
              </div>
            </Reveal.Item>
          );
        })}
      </Reveal>
    </div>
  );
}

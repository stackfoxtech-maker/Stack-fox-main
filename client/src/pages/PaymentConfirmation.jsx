import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Rocket,
  UserRound,
  Mail,
  FileSignature,
  Clock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { quoteForDisplay } from '@lib/quoteMoney';
import { formatINR } from '@lib/utils';
import { TIER_LABELS } from '@lib/estimate';
import { Spinner } from '@components/ui/Primitives';
import api from '@lib/api';

const TIER_COPY = {
  PREMIUM: {
    role: 'Dedicated Project Manager',
    eta: 'Introduces themselves within 24 hours',
    steps: [
      {
        icon: UserRound,
        title: 'Meet your PM',
        text: 'A named project manager reaches out within 24 hours.',
      },
      {
        icon: Calendar,
        title: 'Kickoff call',
        text: 'Align on scope, milestones and communication.',
      },
      {
        icon: Rocket,
        title: 'Discovery begins',
        text: 'Strategy and design work starts right after.',
      },
    ],
  },
  GROWTH: {
    role: 'Project Coordinator',
    eta: 'Emails you within 48 hours',
    steps: [
      {
        icon: Mail,
        title: 'Coordinator email',
        text: 'Your project timeline lands in your inbox within 48 hours.',
      },
      {
        icon: FileSignature,
        title: 'Milestone plan',
        text: 'Review the 30 / 40 / 30 milestone schedule.',
      },
      { icon: Rocket, title: 'Work begins', text: 'The team starts on milestone one.' },
    ],
  },
  STARTER: {
    role: 'Delivery Team',
    eta: 'Access details within 24 hours',
    steps: [
      { icon: Mail, title: 'Check your email', text: 'Access details arrive within 24 hours.' },
      { icon: Rocket, title: 'Build starts', text: 'Delivery begins on your fixed-price scope.' },
      {
        icon: FileSignature,
        title: 'Review & accept',
        text: 'Two rounds of minor revisions are included.',
      },
    ],
  },
};

const CONFETTI_COLORS = ['bg-fox-500', 'bg-fox-300', 'bg-sage-500', 'bg-warm-800', 'bg-fox-700'];
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  dx: `${((i * 53) % 120) - 60}px`,
  rot: `${180 + ((i * 71) % 540)}deg`,
  delay: `${(i % 7) * 0.09}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden motion-reduce:hidden"
    >
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`absolute top-0 block h-2.5 w-1.5 animate-confetti ${c.color} ${c.round ? 'rounded-full' : 'rounded-[1px]'}`}
          style={{ left: c.left, animationDelay: c.delay, '--dx': c.dx, '--rot': c.rot }}
        />
      ))}
    </div>
  );
}

function AnimatedCheck() {
  return (
    <div className="relative mx-auto mb-6 h-20 w-20">
      <span className="absolute inset-0 rounded-full bg-sage-500/30 animate-ring-out motion-reduce:hidden" />
      <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-fox shadow-lg shadow-fox-500/30 animate-scale-in">
        <svg
          viewBox="0 0 24 24"
          className="h-9 w-9"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="30" className="animate-draw-check" />
        </svg>
      </div>
    </div>
  );
}

const DEMO_ITEMS = ['Business Website (5 pages)', 'SEO Foundation', 'Analytics Dashboard'];
const demoQuote = (tier) => ({
  quoteNumber: `SF-Q-DEMO-${tier.slice(0, 3)}`,
  tier,
  total: { PREMIUM: 129800, GROWTH: 73750, STARTER: 29500 }[tier],
  status: tier === 'GROWTH' ? 'partially_paid' : 'paid',
  checkoutDetails: { amountPaid: tier === 'GROWTH' ? 22125 : undefined },
  items: DEMO_ITEMS.map((name) => ({ name })),
});

const rise = (n) => ({ animationDelay: `${0.15 + n * 0.09}s` });

export default function PaymentConfirmation() {
  usePageTitle('Payment Confirmation');
  const [params] = useSearchParams();
  const quoteId = params.get('quote');
  const orderId = params.get('order');
  const demoTier = (params.get('demo') || '').toUpperCase();
  const isDemo = ['STARTER', 'GROWTH', 'PREMIUM'].includes(demoTier);
  const [quote, setQuote] = useState(isDemo ? demoQuote(demoTier) : null);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    if (isDemo) {
      setQuote(demoQuote(demoTier));
      return;
    }
    if (!quoteId) {
      // Express checkout hands over an order id, not a quote: confirm without quote details.
      if (orderId) setQuote({ tier: 'STARTER', items: [] });
      else setError('No quote ID provided');
      setLoading(false);
      return;
    }
    api
      .get(`/quotes/${quoteId}`)
      .then((r) => setQuote(quoteForDisplay(r.data.data)))
      .catch(() => setError('Quote not found'))
      .finally(() => setLoading(false));
  }, [quoteId, orderId, isDemo, demoTier]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <Spinner />
      </div>
    );
  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
        <div className="text-center">
          <p className="mb-4 text-warm-500">{error}</p>
          <Link to="/app/client/quotes" className="font-semibold text-fox-500 hover:underline">
            Back to Quotes
          </Link>
        </div>
      </div>
    );

  const tier = quote.tier || 'STARTER';
  const copy = TIER_COPY[tier] || TIER_COPY.STARTER;
  const partial = quote.status === 'partially_paid';
  const paid = partial ? quote.checkoutDetails?.amountPaid || 0 : quote.total;
  const balance = partial ? Math.max((quote.total || 0) - paid, 0) : 0;

  return (
    <div key={replay} className="relative min-h-screen overflow-hidden bg-warm-white px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-fox-500/10 blur-3xl"
      />
      <Confetti />

      <div className="relative mx-auto w-full max-w-lg">
        <div className="text-center">
          <AnimatedCheck />
          <span
            className="mb-3 inline-flex animate-rise items-center gap-1.5 rounded-full border border-fox-200 bg-fox-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fox-700"
            style={rise(-1)}
          >
            <Sparkles size={12} /> {TIER_LABELS[tier] || tier}
          </span>
          <h1
            className="animate-rise font-display text-3xl font-bold text-warm-900"
            style={rise(0)}
          >
            {partial ? 'Deposit received' : 'Payment successful'}
          </h1>
          <p className="mt-1 animate-rise text-sm text-warm-500" style={rise(1)}>
            {partial
              ? 'Your project is confirmed. The rest is billed as each milestone is approved.'
              : `Thank you. Your ${TIER_LABELS[tier] || tier} project is confirmed.`}
          </p>
        </div>

        <div
          className="mt-8 animate-rise rounded-2xl border border-warm-200 bg-white p-6 shadow-card"
          style={rise(2)}
        >
          <div className="space-y-3 text-sm">
            {quote.quoteNumber && <Row label="Quote" value={quote.quoteNumber} />}
            <Row label="Package" value={TIER_LABELS[tier] || tier} />
            <Row
              label="Date"
              value={new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            />
            {quote.total != null && (
              <div className="flex items-baseline justify-between border-t border-warm-100 pt-3">
                <span className="text-warm-500">{partial ? 'Deposit paid' : 'Amount paid'}</span>
                <span className="text-xl font-bold text-fox-600">{formatINR(paid)}</span>
              </div>
            )}
            {partial && <Row label="Balance, billed by milestone" value={formatINR(balance)} />}
          </div>
          {(quote.items || []).length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-warm-100 pt-4">
              {quote.items.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-warm-700">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fox-500" />
                  {item.name || item.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="mt-4 flex animate-rise items-center gap-4 rounded-2xl border border-fox-200 bg-fox-50 p-5"
          style={rise(3)}
        >
          <div className="relative shrink-0">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-fox text-white shadow-md shadow-fox-500/25">
              <UserRound size={26} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-fox-50 bg-sage-500 animate-pulse-soft" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-fox-700">
              Assigned to your project
            </p>
            <p className="font-bold text-warm-900">{copy.role}</p>
            <p className="flex items-center gap-1 text-xs text-warm-600">
              <Clock size={12} /> {copy.eta}
            </p>
          </div>
        </div>

        <div
          className="mt-4 animate-rise rounded-2xl border border-warm-200 bg-white p-6"
          style={rise(4)}
        >
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-warm-400">
            What happens next
          </p>
          <ol className="relative space-y-5">
            <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-warm-200" />
            {copy.steps.map((s, i) => (
              <li key={s.title} className="relative flex animate-rise gap-4" style={rise(5 + i)}>
                <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-fox-200 bg-fox-50 text-fox-600">
                  <s.icon size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-warm-900">{s.title}</p>
                  <p className="text-xs leading-relaxed text-warm-500">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Link
          to="/app/client/quotes"
          className="mt-6 flex animate-rise items-center justify-center gap-2 rounded-xl bg-fox-500 py-3.5 font-semibold text-white shadow-lg shadow-fox-500/20 transition hover:bg-fox-600 active:scale-[0.99]"
          style={rise(8)}
        >
          Go to dashboard <ArrowRight size={18} />
        </Link>
      </div>

      {isDemo && (
        <button
          type="button"
          onClick={() => setReplay((n) => n + 1)}
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-warm-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-warm-800 active:scale-95"
        >
          <RotateCcw size={14} /> Replay animation
        </button>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-warm-500">{label}</span>
      <span className="break-all text-right font-semibold text-warm-900">{value}</span>
    </div>
  );
}

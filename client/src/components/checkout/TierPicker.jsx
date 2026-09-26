import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@lib/api';
import { formatINR, cn } from '@lib/utils';
import { TIERS, TIER_LABELS, applyTierMultiplier } from '@lib/estimate';

// What each tier actually delivers: milestones and contracts come from
// packages/core/src/delivery, the added overhead from lib/estimate.
const TIER_COPY = {
  STARTER: {
    tagline: 'Fixed price, fastest start',
    lines: [
      'Pay in full up front at a fixed price.',
      'One delivery: the deployed site and its source code.',
      'A single-page agreement (Micro SOW).',
    ],
  },
  GROWTH: {
    tagline: 'Pay as work is approved',
    lines: [
      'Three milestones (30 / 40 / 30) with pay-as-you-go billing.',
      'Adds project management, QA, extended warranty and priority support.',
      'Statement of Work and Master Service Agreement.',
    ],
  },
  PREMIUM: {
    tagline: 'Full-service, end to end',
    lines: [
      'Five phases: strategy, design, two build phases, then QA, handover and training.',
      'Architecture review, plus SOW, MSA, NDA, IP and DPA agreements.',
      'Quoted as a range that firms up after discovery.',
    ],
  },
};

/**
 * Lets the client compare tiers and change their choice at checkout.
 *
 * The server refuses to change a quote's tier in place (a tier changes the
 * price, and a quote that may already have a payment against it must not be
 * silently repriced). So switching creates a fresh, server-priced quote from
 * the same items and cancels this draft.
 */
export default function TierPicker({ quote }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const rawSubtotal = quote.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const canSwitch = quote.items.every((i) => i.itemId);

  const switchTo = async (next) => {
    setBusy(true);
    try {
      const res = await api.post('/quotes', {
        items: quote.items.map((i) => ({
          itemId: i.itemId,
          itemType: i.itemType || 'service',
          quantity: i.quantity,
        })),
        tier: next,
      });
      const created = res.data?.data?.quote ?? res.data?.data;
      const newId = created?._id || created?.id;
      if (!newId) throw new Error('No quote returned');
      // Best effort: the old draft is superseded.
      await api
        .patch(`/quotes/${quote._id || quote.id}/status`, { status: 'cancelled' })
        .catch(() => {});
      toast.success(`Switched to ${TIER_LABELS[next]}.`);
      navigate(`/checkout/${newId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not switch plans. Try again.');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="space-y-3" data-testid="tier-picker">
      <div>
        <h3 className="font-bold text-warm-900">Choose your plan</h3>
        <p className="text-xs text-warm-500">
          Same scope, different level of service. Prices shown are before GST.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Plan">
        {TIERS.map((t) => {
          const selected = t === quote.tier;
          const total = applyTierMultiplier(rawSubtotal, t);
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy || (!selected && !canSwitch)}
              onClick={() => !selected && setPending(t)}
              className={cn(
                'text-left rounded-2xl border-2 p-4 transition-all flex flex-col gap-2',
                selected
                  ? 'border-fox-500 bg-fox-50 shadow-sm'
                  : 'border-warm-200 bg-white hover:border-fox-300',
                pending === t && 'ring-2 ring-fox-300',
                'disabled:opacity-60',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-warm-900">{TIER_LABELS[t]}</span>
                {selected && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-fox-700">
                    <Check size={12} /> Selected
                  </span>
                )}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-warm-500">
                {TIER_COPY[t].tagline}
              </div>
              <div className="text-lg font-black text-warm-900">
                {formatINR(total)}
                {t !== 'STARTER' && (
                  <span className="ml-1 text-[11px] font-medium text-warm-500">est.</span>
                )}
              </div>
              <ul className="space-y-1 text-xs text-warm-600 leading-relaxed">
                {TIER_COPY[t].lines.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <span className="text-fox-500">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {pending && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fox-200 bg-fox-50 px-4 py-3 text-sm"
        >
          <span className="text-warm-700">
            Switch to <strong>{TIER_LABELS[pending]}</strong> at{' '}
            <strong>{formatINR(applyTierMultiplier(rawSubtotal, pending))}</strong> before GST? This
            starts a new quote and cancels this one.
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-warm-600 hover:bg-white"
            >
              Keep {TIER_LABELS[quote.tier]}
            </button>
            <button
              type="button"
              onClick={() => switchTo(pending)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-fox-500 text-white hover:bg-fox-600 disabled:opacity-60"
            >
              {busy ? 'Switching…' : 'Switch plan'}
            </button>
          </span>
        </div>
      )}
      {!canSwitch && (
        <p className="text-xs text-warm-500">
          This quote contains custom items, so its plan cannot be changed here.
        </p>
      )}
    </div>
  );
}

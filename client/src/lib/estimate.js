// Instant Estimate Engine — tier pricing bands (Product Bible §4.4).
// Growth/Premium include added service overhead (PM, QA, extended
// warranty, priority support) beyond the raw catalog sum, so each tier
// applies its own price multiplier to the selected items before showing
// a range around that adjusted amount. Starter is a fixed flat price.
export const TIERS = ['STARTER', 'GROWTH', 'PREMIUM'];

export const TIER_LABELS = {
  STARTER: 'Starter',
  GROWTH: 'Growth',
  PREMIUM: 'Premium',
};

// Matches the multipliers already used in tools/InstantEstimate.jsx.
export const TIER_MULTIPLIERS = {
  STARTER: 1,
  GROWTH: 1.5,
  PREMIUM: 2.2,
};

export function applyTierMultiplier(rawSubtotal, tier) {
  return Math.round(rawSubtotal * (TIER_MULTIPLIERS[tier] ?? 1));
}

// subtotal here is already tier-adjusted (see applyTierMultiplier).
export function computeEstimateRange(subtotal, tier) {
  if (tier === 'STARTER') {
    return { format: 'flat', tier, low: subtotal, mid: subtotal, high: subtotal };
  }
  if (tier === 'PREMIUM') {
    return {
      format: 'range_plus',
      tier,
      low: Math.round(subtotal * 0.85),
      mid: subtotal,
      high: Math.round(subtotal * 1.5),
    };
  }
  // GROWTH (default) — ±15% tolerance from mid-range
  return {
    format: 'range',
    tier,
    low: Math.round(subtotal * 0.85),
    mid: subtotal,
    high: Math.round(subtotal * 1.15),
  };
}

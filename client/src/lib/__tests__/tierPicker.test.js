import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TIERS, TIER_MULTIPLIERS, applyTierMultiplier } from '../estimate';

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(resolve(here, '../../..', rel), 'utf8');

describe('checkout tier choice', () => {
  it('prices rise with the tier, from the same table the server uses', () => {
    expect(TIER_MULTIPLIERS.PREMIUM).toBe(2.2);
    const totals = TIERS.map((t) => applyTierMultiplier(25000, t));
    expect(totals).toEqual([25000, 37500, 55000]);
  });

  it('shows the picker on the first checkout step', () => {
    const checkout = src('src/pages/Checkout.jsx');
    expect(checkout).toMatch(/import TierPicker from '@components\/checkout\/TierPicker'/);
    expect(checkout).toMatch(/<TierPicker quote=\{quote\} \/>/);
  });

  it('switches by creating a new server-priced quote, never by editing the tier in place', () => {
    const picker = src('src/components/checkout/TierPicker.jsx');
    expect(picker).toMatch(/api\.post\('\/quotes'/);
    expect(picker).toMatch(/status: 'cancelled'/);
    expect(picker).not.toMatch(/api\.patch\([^)]*\{\s*tier/);
  });
});

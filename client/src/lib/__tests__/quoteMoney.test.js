import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { quoteForDisplay } from '../quoteMoney';

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(resolve(here, '../../..', rel), 'utf8');

describe('quote display boundary', () => {
  it('preserves ₹10,000 catalogue price through quote display and remains idempotent', () => {
    const wire = {
      moneyUnit: 'PAISE',
      subtotal: 1000000,
      gstAmount: 180000,
      total: 1180000,
      items: [{ price: 1000000 }],
      estimateRange: { low: 1000000, mid: 1000000, high: 1000000 },
      checkoutDetails: { amountPaid: 354000 },
    };
    const displayed = quoteForDisplay(wire);
    expect(displayed.total).toBe(11800);
    expect(displayed.items[0].price).toBe(10000);
    expect(displayed.checkoutDetails.amountPaid).toBe(3540);
    expect(quoteForDisplay(displayed)).toEqual(displayed);
    expect(wire.total).toBe(1180000);
  });
});

// ── The boundary is actually wired in, not just correct in isolation ────────
//
// quoteForDisplay() converts a PAISE-tagged quote back to rupees. Proving the
// function is correct (above) does not prove anyone calls it — and for a
// while nobody did. quotes.ts tags every response moneyUnit: "PAISE", but
// Checkout.jsx and Quotes.jsx both stored the API response directly and
// passed it straight to formatINR(), which expects rupees. The bug: a
// ₹1,180 quote rendered as ₹1,18,000 on the checkout screen, the invoice
// preview, the signed contract total, the exported PDF, and the client's own
// quotes list — six render paths from two unconverted fetches.
//
// A render test would need jsdom + component mocking that this client's test
// setup does not have (every existing test here is a pure function). This
// checks the property that was actually missing: is the conversion called at
// the point data enters state, not whether the conversion itself is correct.
describe('quoteForDisplay is wired into every quote fetch, not just correct in isolation', () => {
  it('Checkout.jsx converts both places it sets quote state', () => {
    const file = src('src/pages/Checkout.jsx');
    expect(file).toMatch(/from '@lib\/quoteMoney'/);
    // Both setQuote(...) call sites: the initial GET and the post-payment
    // verify response. A regression here is a silent 100x on the payment
    // screen, so both are checked by name rather than just counting.
    expect(file).toMatch(/setQuote\(q\)/);
    expect(file).toMatch(/const q = quoteForDisplay\(/);
    expect(file).toMatch(/setQuote\(paidQuote\)/);
    expect(file).toMatch(/const paidQuote = quoteForDisplay\(/);
  });

  it('Quotes.jsx converts the list before it is stored', () => {
    const file = src('src/app/client/Quotes.jsx');
    expect(file).toMatch(/from '@lib\/quoteMoney'/);
    expect(file).toMatch(/setQuotes\(.*\.map\(quoteForDisplay\)/);
  });
});

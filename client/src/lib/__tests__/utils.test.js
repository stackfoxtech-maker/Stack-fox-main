import { describe, it, expect } from 'vitest';
import { formatINR, formatINRShort, cn } from '../utils';

/**
 * Currency formatting is what a client reads on an invoice screen, so the
 * boundaries matter more than the happy path — a figure that jumps from
 * "99999" to "1.0L" at the wrong threshold misstates the amount.
 */
describe('formatINR', () => {
  it('renders nothing rather than NaN for absent values', () => {
    expect(formatINR(null)).toBe('—');
    expect(formatINR(undefined)).toBe('—');
  });

  it('renders zero as a real amount, not as absent', () => {
    // A zero balance is meaningful on a paid invoice; an em dash is not.
    expect(formatINR(0)).not.toBe('—');
    expect(formatINR(0)).toContain('0');
  });

  it('includes the rupee symbol', () => {
    expect(formatINR(1000)).toContain('₹');
  });

  it('groups in the Indian system, not thousands', () => {
    // 1,00,000 — not 100,000.
    expect(formatINR(100000).replace(/[^\d,]/g, '')).toBe('1,00,000');
  });
});

describe('formatINRShort', () => {
  it.each([
    [999, '999'],
    [1000, '1.0K'],
    [99999, '100.0K'],
    [100000, '1.0L'],
    [9999999, '100.0L'],
    [10000000, '1.0Cr'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatINRShort(input)).toBe(expected);
  });

  it('switches unit exactly at each threshold, never one short', () => {
    // The bug this guards: an off-by-one in the >= comparisons would render
    // 1,00,000 as "1000.0K" or 99,999 as "1.0L".
    expect(formatINRShort(99999)).toContain('K');
    expect(formatINRShort(100000)).toContain('L');
    expect(formatINRShort(9999999)).toContain('L');
    expect(formatINRShort(10000000)).toContain('Cr');
  });
});

describe('cn', () => {
  it('joins class names and drops falsy ones', () => {
    // The constant falsy argument is exactly what is under test.
    // eslint-disable-next-line no-constant-binary-expression
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('survives being given nothing', () => {
    expect(cn()).toBe('');
  });
});

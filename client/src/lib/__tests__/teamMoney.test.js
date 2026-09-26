import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../../app/team/PmDashboards.jsx'), 'utf8');

describe('Team Finance renders stored paise as rupees', () => {
  it('formats invoice and total amounts with formatPaise', () => {
    expect(src).toMatch(/import \{ formatPaise \} from '@lib\/utils'/);
    expect(src).toMatch(/formatPaise\(totalRevenue\)/);
    expect(src).toMatch(/formatPaise\(i\.total \|\| i\.grandTotal \|\| 0\)/);
  });

  it('does not divide a paise amount by 100000 and call it lakh', () => {
    // analytics.totalRevenue is already rupees, so its /100000 is correct.
    expect(src).not.toMatch(/(?<!analytics\.)totalRevenue \/ 100000/);
    expect(src).not.toMatch(/grandTotal \|\| 0\) \/ 100000/);
  });
});

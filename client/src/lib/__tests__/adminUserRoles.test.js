import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { INTERNAL_ROLES, CLIENT_ROLES } from '../../../../packages/core/src/roles/index';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../../app/admin/Users.jsx'), 'utf8');
const valid = new Set([...INTERNAL_ROLES, ...CLIENT_ROLES]);

const valuesIn = (name) => {
  const start = src.indexOf(`const ${name} = [`);
  const block = src.slice(start, src.indexOf('];', start));
  return [...block.matchAll(/value: '([^']+)'/g)].map((m) => m[1]);
};

describe('Admin Users only offers roles the API accepts', () => {
  it('every create/edit role option is a real role', () => {
    const opts = valuesIn('ROLE_OPTIONS');
    expect(opts.length).toBeGreaterThan(5);
    for (const v of opts) expect(valid.has(v)).toBe(true);
  });

  it('every filter chip is a real role (or "all")', () => {
    for (const v of valuesIn('ROLE_FILTERS')) expect(v === 'all' || valid.has(v)).toBe(true);
  });

  it('defaults to the least-privileged role', () => {
    expect(src).toMatch(/const DEFAULT_ROLE = 'INDIVIDUAL_CLIENT';/);
  });
});

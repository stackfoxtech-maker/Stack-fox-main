import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const signup = readFileSync(resolve(here, '../../pages/auth/Signup.jsx'), 'utf8');

describe('Signup form', () => {
  it('does not collect a phone number (signup is email + password or Google)', () => {
    expect(signup).not.toMatch(/phone/i);
  });

  it('posts only what the strict API schema accepts', () => {
    expect(signup).toMatch(/useState\(\{ name: '', email: '', password: '' \}\)/);
  });
});

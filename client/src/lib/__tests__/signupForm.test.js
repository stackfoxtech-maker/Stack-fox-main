import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const signup = readFileSync(resolve(here, '../../pages/auth/Signup.jsx'), 'utf8');

// Mirrors the normalisation in Signup.jsx's submit handler.
const normalise = (raw) => raw.replace(/(?!^\+)[^\d]/g, '');

describe('Signup form', () => {
  it('collects a phone number as a contact detail', () => {
    expect(signup).toMatch(/label="Phone"/);
    expect(signup).toMatch(/type="tel"/);
    expect(signup).toMatch(/verify your account by email/i);
  });

  it('normalises the number to what the API accepts', () => {
    expect(signup).toContain(String.raw`form.phone.replace(/(?!^\+)[^\d]/g, '')`);
    expect(normalise('+91 98765-43210')).toBe('+919876543210');
    expect(normalise('98765 43210')).toBe('9876543210');
    expect(normalise('(+91) 98765')).toBe('9198765');
  });
});

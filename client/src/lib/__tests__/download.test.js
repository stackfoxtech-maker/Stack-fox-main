import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { downloadFromUrl, downloadErrorMessage } from '../download';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(resolve(here, '../..', rel), 'utf8');

describe('downloadFromUrl', () => {
  // A minimal stand-in for the DOM: enough to see what gets clicked.
  const withFakeDocument = (fn) => {
    const clicked = [];
    const body = {
      appended: [],
      appendChild(el) {
        this.appended.push(el);
      },
    };
    globalThis.document = {
      body,
      createElement: () => ({
        style: {},
        click() {
          clicked.push({ href: this.href, download: this.download, rel: this.rel });
        },
        remove() {
          body.appended = body.appended.filter((e) => e !== this);
        },
      }),
    };
    try {
      fn();
    } finally {
      delete globalThis.document;
    }
    return { clicked, left: body.appended.length };
  };

  it('clicks a real link instead of opening a window', () => {
    const { clicked, left } = withFakeDocument(() =>
      downloadFromUrl('https://files.example.com/a.pdf?token=t', 'a.pdf'),
    );
    expect(clicked).toEqual([
      { href: 'https://files.example.com/a.pdf?token=t', download: 'a.pdf', rel: 'noopener' },
    ]);
    expect(left).toBe(0);
  });

  it('refuses a missing or non-http link rather than doing nothing', () => {
    expect(() => downloadFromUrl(undefined)).toThrow(/download link/);
    expect(() => downloadFromUrl('javascript:alert(1)')).toThrow(/download link/);
  });

  it('puts the request reference in the error so it can be reported', () => {
    const err = {
      response: { data: { error: 'Could not prepare the contract PDF.', requestId: 'r-1' } },
    };
    expect(downloadErrorMessage(err, 'x')).toBe('Could not prepare the contract PDF. (ref r-1)');
    expect(downloadErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

describe('document downloads never use window.open', () => {
  for (const f of [
    'app/client/Contracts.jsx',
    'app/client/Invoices.jsx',
    'app/admin/Finance.jsx',
    'app/admin/Orders.jsx',
    'app/client/ClientPanels.jsx',
  ]) {
    it(`${f} downloads through the shared helper`, () => {
      const src = read(f);
      expect(src).toMatch(/from '@lib\/download'/);
      expect(src).not.toMatch(/window\.open\([^)]*'noopener'\)/);
    });
  }
});

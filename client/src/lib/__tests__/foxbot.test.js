import { describe, expect, it } from 'vitest';
import { answer, starters } from '../foxbot';

describe('FoxBot in the browser', () => {
  it('answers a pricing question from the bundled catalogue', async () => {
    const a = await answer('What does a website cost?', '/');
    expect(a.reply).toMatch(/₹/);
    expect(a.suggestions.length).toBeGreaterThan(0);
  });

  it('suggests opening chips for a page', async () => {
    expect((await starters('/pricing')).length).toBeGreaterThan(0);
  });
});

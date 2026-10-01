// FoxBot answers in the browser: the engine and the catalogue are bundled, so a reply needs no
// network round trip. The engine is the same file the API runs (shared/foxbot-engine.mjs).
// Loaded lazily so it stays out of the first page load; prefetch() warms it when the chat opens.
let enginePromise;

function load() {
  enginePromise ??= Promise.all([
    import('@data/stackfox-data.json'),
    import('@shared/foxbot-engine.mjs'),
  ]).then(([data, { createEngine }]) =>
    createEngine({ data: data.default, tiers: { STARTER: 1, GROWTH: 1.5, PREMIUM: 2.2 } }),
  );
  return enginePromise;
}

export const prefetch = () => void load().catch(() => {});
export const answer = (message, page) => load().then((e) => e.answerQuestion(message, { page }));
export const starters = (page) => load().then((e) => e.starterSuggestions(page));

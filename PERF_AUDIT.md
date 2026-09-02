# Performance Audit — StackFox client

Date: 2026-09-02 · Scope: `client/` (the public marketing site + app shell).
Method: source review + `vite build` chunk analysis + `performance.getEntriesByType`
in the running dev app. Dev-mode byte counts are inflated (unbundled modules); the
**structural** findings below hold in production.

---

## Status — all items resolved 2026-09-02

| # | What shipped |
|---|---|
| P0-1 | Real logo kept but rebuilt: white keyed to transparent, resized, palette-quantised → **`logo.png` 22 KB** (was 486 KB), `favicon.png` 4.7 KB, `logo-512.png` for PWA install. Hi-res original kept at `client/assets-src/logo-source.png`. |
| P0-2 | Builder groups services once (`servicesByCat` / `catCounts` maps), `<ServiceCard>` is `React.memo`, and the "All" view shows **6 per category + "View all N"** — 78 cards instead of 255. |
| P0-3 | `pdfExport` is now `import()`-ed on click in `CartDrawer` + `Quotes`; `<CartDrawer>` itself is `lazy()` and only mounts once the cart is used. **Entry chunk 562 KB → 75 KB.** |
| P0-4 | Razorpay `<script>` removed from `index.html`; `src/lib/razorpay.js` loads it on demand from `Checkout` / `Invoices`. |
| P1-1 | `pdfExport` no longer statically imports the catalogue, so Vite splits `stackfox-data.json` (83 KB) into a lazy chunk. Home now uses a generated `src/data/catalog-summary.json` (~2 KB) — `scripts/gen-catalog-summary.mjs`. |
| P1-2 | `useStorefrontData` has a session promise-cache (1 request, not N); `SearchOverlay` is `lazy()` + mounted on first open. |
| P1-3 | `sw.js` rewritten — cache-first for `/assets/*`, network-first for navigations, nothing else touched, bounded caches, `v3`. Registration moved to `main.jsx`, **PROD-only**; dev registrations are torn down (kills the "failed to fetch script" console spam). |
| P1-4 | Home hero `pravatar` images → inline initial-avatars (0 requests). |
| P2-3 | About + Industries hero images are `loading="eager"` + `fetchpriority="high"`. |
| P2-4 | Toaster font `Outfit` → DM Sans. |
| — | **All 13 marketing images now served from Cloudinary** (`res.cloudinary.com/efgleg53/…/stackfox/*`) with `f_auto,q_auto` + responsive `srcset` via `src/lib/img.js`. Sources moved to `client/assets-src/img/` (out of the served bundle). |
| — | **Mobile**: shared `src/app/DashboardShell.jsx` — desktop sidebar unchanged; mobile gets a top app bar + fixed bottom tab bar (4 primary + "More" drawer). All four dashboards (client/admin/team/sales) use it. Builder service tiles go 3-up + compact on phones. |

P2-1 (font weight trim) deferred — marginal and risky (variable fonts download one
file per family regardless of the weight list).

---

## TL;DR — what's actually slow

| # | Problem | Impact | Effort |
|---|---------|--------|--------|
| P0-1 | **`public/logo.png` is a 1024×1024 JPEG, 486 KB**, rendered at 16–28 px and used as the favicon. Loads on every page. | ~480 KB wasted on every first paint | 5 min |
| P0-2 | **Builder renders all 255 service cards at once** when the category is "All" (the default). No pagination/virtualization; the per-category filter runs 13×255 times per render. | Multi-hundred-ms main-thread jank on `/builder`, worse on mobile | 1–2 h |
| P0-3 | **jsPDF (~150 KB gz) is on the critical path for every visitor** — `App.jsx` renders `<CartDrawer>` eagerly → `pdfExport.js` → `import { jsPDF }`. | Landing page ships a PDF library nobody on it will use | 30 min |
| P0-4 | **Razorpay checkout SDK loads as a blocking `<script>` in `<head>` on every page** and pulls 4 Razorpay domains (`checkout.`, `cdn.`, `api.`, `lumberjack.` — the last is analytics). | Render-blocking + third-party tracking on the marketing site | 20 min |
| P1-1 | **The 100 KB catalog JSON (`shared/stackfox-data.json`) is bundled into the entry** (via `pdfExport` → CartDrawer, and directly by Home/Pricing/Industries). | Every visitor downloads the full 255-service catalog to see the homepage | 30–60 min |
| P1-2 | **`/catalogue/storefront` (89 KB) is fetched app-wide via `Navbar → SearchOverlay → useStorefrontData`**, with no shared cache — refetched again on Catalog/Packages. | Redundant 89 KB API calls; fires even if search is never opened | 30 min |
| P1-3 | **Service worker is network-first for everything, caches every GET forever, and runs in dev** — the source of the repeating `"An unknown error occurred when fetching the script"` console errors. | No repeat-visit speed-up, unbounded cache growth, dev noise | 30 min |
| P1-4 | **5 external `i.pravatar.cc` avatar requests** in the Home hero (above the fold). | 5 blocking third-party image requests on LCP path | 15 min |
| P2-1 | 3 web-font families / 6 files (Bricolage variable + DM Sans variable + JetBrains Mono), ~230 KB. `display=swap` is set (good). | Trim unused weights; consider `&text=` for the wordmark | 20 min |
| P2-2 | No `React.memo` on Builder/Catalog service cards → every debounced search keystroke re-renders the whole list. | Compounds P0-2 | 30 min |
| P2-3 | Above-the-fold images (`about-workspace`, `industries-hero`) are `loading="lazy"` — should be `eager` + `fetchpriority="high"`. | Minor LCP delay on those routes | 5 min |
| P2-4 | `main.jsx` Toaster `fontFamily: 'Outfit'` — font no longer loaded (DESIGN.md swapped to DM Sans). Cosmetic, not perf. | — | 1 min |

---

## Production bundle (from `vite build`)

Loaded on **every** route (the app shell):

```
index-*.js          562 KB  (~180 KB gz)   entry: App, routes, stores, Navbar, Footer, CartDrawer
vendor-*.js          161 KB  (~54 KB gz)    react, react-dom, react-router
motion-*.js          111 KB  (~37 KB gz)    framer-motion (App.jsx <MotionConfig>)
icons-*.js            57 KB  (~11 KB gz)    lucide-react (tree-shaken)
index.es-*.js        148 KB  (~50 KB gz)    ← jsPDF, pulled in by CartDrawer
html2canvas.esm-*    198 KB  (~48 KB gz)    lazy — only when jsPDF.html() runs (OK)
```

Lazy / per-route (fine, listed for completeness):

```
charts-*.js          375 KB   recharts — only admin/Reports + client/ClientPanels
salesPitchLibrary-*  124 KB   — only team/sales routes
Checkout-*.js         53 KB
```

**The marketing homepage currently costs ≈ 330 KB gz of JS** before it's interactive.
Removing jsPDF from the shell (P0-3) and the catalog JSON from the entry (P1-1)
takes that to ≈ 230 KB gz. The `charts`/`salesPitchLibrary` chunks are already
correctly code-split and never touch a public visitor.

---

## Detailed findings & fixes

### P0-1 · logo.png — 486 KB, 1024² JPEG-as-PNG

`client/public/logo.png` — a 1 MP JPEG with a `.png` extension. Referenced by:
- `index.html:24` `<link rel="icon" type="image/png" href="/logo.png" />`
- `client/src/components/ui/BrandLogo.jsx:29` `<img src="/logo.png" … style={{ width: size }}/>` — Navbar (size 28), Footer (size 16), FoxBot.

**Fix:** there is already a `client/public/favicon.svg` (455 bytes). Either:
- point `BrandLogo` and the favicon at `favicon.svg`, delete `logo.png`; or
- export a real 64×64 PNG (`logo-64.png`, ~3 KB) for the wordmark + keep the SVG favicon.
Also fix `index.html` to `<link rel="icon" href="/favicon.svg">`.
Expected saving: **~485 KB per first visit.**

### P0-2 · Builder renders 255 cards at once

`client/src/pages/Builder.jsx`:
- Default `activeCat` is `'all'` (`Builder.jsx:96`).
- Lines 535–598: for `'all'` it maps every category and renders `catServices.map(svc => <card/>)` for all 13 → **255 cards, ~1,800 DOM nodes**, no windowing.
- Line 537 `filteredServices.filter(s => s.catId === cat.dataId)` runs **inside** the `.map(cat)` → O(13 × 255) array scans **per render**.
- Line 474 (chip rail) `catalog.services.filter(s => s.catId === cat.dataId).length` → another 13 full scans per render.
- Line 546 `text-[10px]` badge (also a DESIGN.md floor violation).

**Fix (in order of value):**
1. Precompute once:
   ```js
   const servicesByCat = useMemo(() => {
     const m = new Map();
     for (const s of filteredServices) (m.get(s.catId) ?? m.set(s.catId, []).get(s.catId)).push(s);
     return m;
   }, [filteredServices]);
   const catCounts = useMemo(() => {
     const m = new Map();
     for (const s of catalog.services) m.set(s.catId, (m.get(s.catId) ?? 0) + 1);
     return m;
   }, [catalog.services]);
   ```
2. For `activeCat === 'all'`, don't render every card. Options, cheapest first:
   - **Show a preview per category** (first 4–6 cards) with a "View all 20 →" button that sets `activeCat`. Turns 255 cards into ~60.
   - Or paginate the flat list like `Catalog.jsx` already does (24/page, `Catalog.jsx:12`).
   - Or content-visibility: add `className="[content-visibility:auto] [contain-intrinsic-size:600px]"` to each category `<section>` so off-screen categories skip layout/paint. One-line, keeps current UX.
3. Extract `<ServiceCard>` and wrap in `React.memo` (deps: `svc`, `isInCart`, `fmt`). Stops the full re-render on every search keystroke.

### P0-3 · jsPDF on the critical path

`client/src/App.jsx` renders `<CartDrawer />` unconditionally. `CartDrawer.jsx:9`
imports `exportQuotePDF` from `pdfExport.js`, which does `import { jsPDF } from 'jspdf'`
at module scope (`pdfExport.js:2`). So jsPDF + `stackfox-data.json` are in the shell.

**Fix:**
- In `CartDrawer.jsx`, drop the static import and load it on click:
  ```js
  const handleDownload = async () => {
    const { exportQuotePDF } = await import('@lib/pdfExport');
    await exportQuotePDF(...);
  };
  ```
- Same in `client/src/app/client/Quotes.jsx:6`.
- Optional: lazy-mount `<CartDrawer>` itself — `const CartDrawer = lazy(() => import('@components/ui/CartDrawer'))` and only render it when the cart has ever been opened.

Expected: **−150 KB gz** off every non-checkout page.

### P0-4 · Razorpay blocking script

`index.html:31` `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
— synchronous, in `<head>`, on every page. Network shows it fanning out to
`cdn.razorpay.com`, `api.razorpay.com`, and `lumberjack.razorpay.com` (analytics).

**Fix:** remove it from `index.html`. Load it only where a payment starts
(`Checkout.jsx` / `ExpressCheckout.jsx` / `PaymentConfirmation.jsx`) via a small
loader:
```js
const loadRazorpay = () => new Promise((res, rej) => {
  if (window.Razorpay) return res();
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = res; s.onerror = rej;
  document.body.appendChild(s);
});
```

### P1-1 · Catalog JSON in the entry bundle

`shared/stackfox-data.json` is 100 KB (255 services + copy). Imported by 14 modules
(`grep -rl "@data/stackfox-data.json" client/src`), including `pdfExport.js` (→ shell
via P0-3) and the public `Home`, `Pricing`, `Industries`.

**Fix:**
- Fixing P0-3 removes the shell reference. Then Vite splits the JSON into a shared
  **async** chunk loaded only by pages that need it.
- Home/Pricing/Industries only use `categories` (13 items) and `services.length`.
  Consider a tiny generated `catalog-summary.json` (categories + counts, ~2 KB) for
  those pages and keep the full file for Builder/Catalog only.
- Longer term: the API's `/catalogue/storefront` already returns this data — see the
  note at `Builder.jsx:157` about the incompatible `/catalog/*` dataset. Reconciling
  that lets the client drop the bundled copy entirely.

### P1-2 · storefront fetched app-wide, uncached

`Navbar.jsx` → `SearchOverlay.jsx` → `useStorefrontData()` fires `GET /catalogue/storefront`
(89 KB) on **every page**, whether or not search is opened. `Catalog.jsx`, `Packages.jsx`,
`ServiceCost.jsx`, `ServiceTimeline.jsx` each call it again with no shared cache
(`useStorefrontData.js` has none).

**Fix:**
- Add a module-level in-flight promise cache to `useStorefrontData` (or move it into a
  Zustand store / React Query) so N consumers = 1 request per session.
- Lazy-mount `SearchOverlay` only when the user opens search, so the fetch is deferred
  off the initial load.

### P1-3 · Service worker

`client/public/sw.js` — `fetch` handler is network-first for **all** same-origin GETs
and `cache.put`s every OK response into one cache that's only ever cleared on a
`CACHE_NAME` bump (`sw.js:5`). Registered unconditionally in `index.html:34`.

Problems: (a) network-first = zero repeat-visit speed-up for hashed assets;
(b) the cache grows without bound; (c) in dev it intercepts Vite's module/HMR
requests → the recurring `"An unknown error occurred when fetching the script"`
console errors on every page.

**Fix:**
- Guard registration: `if (import.meta.env.PROD && 'serviceWorker' in navigator)` —
  move the register call from `index.html` into `main.jsx`.
- `sw.js`: **cache-first** for `/assets/*` (content-hashed, immutable), network-first
  only for navigations, and cap/expire the runtime cache.
- Or, if a PWA/offline shell isn't a near-term goal, delete `sw.js` + the registration
  and add an unregister shim for existing clients.

### P1-4 · pravatar avatars

`Home.jsx:97-100` — `{[11,12,13,14].map(i => <img src={`https://i.pravatar.cc/72?u=${i}`}/>)}`
in the hero, above the fold. 4–5 requests to a third party on the LCP path.

**Fix:** replace with 4 small local webp thumbnails (or generated, like the other
images), or inline SVG initial-avatars. Same visual, zero third-party.

### P2-1 · Fonts

`index.html:27` loads Bricolage Grotesque (`opsz,wght@12..96` × 3 weights) +
DM Sans (`opsz,wght@9..40` × 3) + JetBrains Mono × 2. `preconnect` + `display=swap`
are already correct.

**Fix (optional):** drop any weight not actually used (grep the classes); JetBrains
Mono is used for a handful of chips — could be dropped for a system mono stack.
Add `&text=stackfox` variant for the wordmark if it stays a web font.

### P2-2 · Card memoization

Neither `Builder.jsx` nor `Catalog.jsx` memoizes the service card. With the 200 ms
debounced search (`Builder.jsx:112`), each settled keystroke re-renders every card.
`React.memo` + stable `fmt`/handlers fixes it (pairs with P0-2).

### P2-3 · Above-the-fold images

`About.jsx` hero (`about-workspace.webp`) and `Industries.jsx` hero
(`industries-hero.webp`) are `loading="lazy"`. They're the LCP element on those
routes → set `loading="eager"` and `fetchpriority="high"`. Below-the-fold images
(`founder-desk`, portfolio, `contact-call`) are correctly lazy.

### P2-4 · Dead font reference

`client/src/main.jsx:19` Toaster `style.fontFamily: 'Outfit, system-ui, sans-serif'`
— Outfit was removed in the DESIGN.md refresh. Change to `var(--font-sans)`.

---

## Suggested order of work

1. **P0-1** (logo) + **P2-3** (eager heroes) + **P2-4** — trivial, ~490 KB win.
2. **P0-4** (Razorpay) + **P1-3** (service worker) — removes render-blocking + console errors.
3. **P0-3** (lazy jsPDF) + **P1-1** (catalog JSON off entry) — ~150 KB gz off every page.
4. **P0-2** (Builder rendering) + **P2-2** (memo) — fixes the reported jank.
5. **P1-2** (storefront cache) + **P1-4** (avatars) + **P2-1** (fonts) — polish.

Nothing here requires an API change; P1-1's final form does.

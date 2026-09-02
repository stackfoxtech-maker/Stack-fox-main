# Design System — StackFox

Created by `/design-consultation`, 2026-09-02. Read this before any visual or UI change.

## Product Context
- **What this is:** An "Amazon-style" tech agency. People browse 240+ individually-priced software services, assemble a custom project in a builder, and watch the total update live before they ever talk to a human.
- **Who it's for:** Indian founders, SMB owners, and non-technical operators who need software built and are tired of opaque agency quotes.
- **Space:** Dev agencies / no-code builders / IT services. Peers hide pricing behind "contact us"; StackFox shows every price.
- **Project type:** Hybrid — marketing site (Home, Pricing, Industries, tools) wrapped around a real app (Builder, cart, checkout, client + admin dashboards).

## Memorable Thing
**"Building software is easy now."** Every design decision serves that feeling: calm, guided, one clear step at a time. Not corporate, not childish. The opposite of an intimidating enterprise sales page.

## Aesthetic Direction
- **Direction:** Approachable / Guided — "Calm Guidance."
- **Decoration level:** intentional. Warm paper ground, soft shadows instead of hard 1px borders, gentle depth. No decorative blobs, floating circles, wavy dividers, or emoji as ornament.
- **Mood:** You're in good hands. Unhurried, warm, trustworthy, quietly confident. A good advisor, not a hype man.

## Typography
- **Display/Hero:** **Bricolage Grotesque** (weights 500–700). Friendly, a little characterful, unmistakably modern — reads "this is easy" without tipping into childish. Deliberately not Fraunces/Outfit/Space Grotesk (the convergence choices). Headlines only (h1, h2, big section titles).
- **Body + UI:** **DM Sans**. Warm, round terminals, excellent readability, pairs with Bricolage. Replaces Inter (overused/generic). Weights 400/500/700.
- **Data / prices:** DM Sans with `font-variant-numeric: tabular-nums`. Friendlier than monospace for money — prices should feel human, not like a terminal.
- **Code / SKUs / URLs:** JetBrains Mono, only for genuinely code-like strings (the `stackfox.in/builder` chip, snippets).
- **Loading:** Google Fonts — `Bricolage+Grotesque:opsz,wght@12..96,500..700`, `DM+Sans:wght@400;500;700`, `JetBrains+Mono:wght@400;500`. `display=swap`, preconnect to gstatic.
- **Scale** (rem, 1.25 major-third, tighter at the top):
  - `display-2xl` 3.5rem / 1.05 / -0.02em — hero h1
  - `display-xl` 2.75rem / 1.1 / -0.02em
  - `display-lg` 2rem / 1.15 / -0.015em — section h2
  - `display-md` 1.5rem / 1.2 — sub-section
  - `title` 1.125rem / 1.35 / 600 — card titles (was 12–14px H3 — never go below 14px for a heading)
  - `body-lg` 1.125rem / 1.6
  - `body` 1rem / 1.6 — never below 16px for body copy
  - `body-sm` 0.875rem / 1.5 — secondary
  - `label` 0.8125rem / 1.4 / 500, tracking 0.04em uppercase — eyebrows, meta
  - `caption` 0.75rem / 1.4 — smallest allowed, non-heading only

## Color
- **Approach:** balanced-restrained. Orange means "do this." Green means "you're on track." Everything else is warm neutral.
- **Primary — fox orange `#FF4D00`** (scale `fox-50…900`). Reserved for the ONE primary action per view, active nav, and key numbers (the running total). Not for decoration, not for every card.
- **Secondary — sage `#5B8A72`** (`sage-50 #EEF3F0 … sage-500 #5B8A72 … sage-700 #3B5C4B`). Helper text, progress bars, "step complete" checks, tip callouts. Calm, reassuring, never competes with orange.
- **Neutrals — warm** (`warm-white #FAF8F5`, `warm-50 #F5F3EF`, `warm-100 #EDEAE4`, `warm-200 #DEDAD1`, `warm-300 #C6C1B5`, `warm-400 #6E6860`, `warm-500 #5E594F`, `warm-600 #57524A`, `warm-700 #3E3A34`, `warm-800 #2A2723`, `warm-900 #1A1918`). Slightly warmer and a touch more saturated than the old set; token names unchanged so nothing breaks.
- **Text colour rules:** body/secondary text is `warm-600` or darker; "muted" text bottoms out at `warm-400` (`#6E6860`, 5.2:1 on the warm ground — WCAG AA). `warm-300` is **borders and decoration only, never text**. On dark surfaces (`bg-warm-900`) it inverts: readable text is `warm-200`/`warm-300`, and `warm-400`/`warm-500` are too dark to use.
- **Semantic:** success `#4E8A5B`, warning `#D98E2B`, error `#D6483F`, info `#3E7CB1`.
- **Dark mode:** not in scope now. When added: redesign surfaces with elevation, text `#E8E4DD` not pure white, desaturate fox to ~`#FF6A33`.

## Spacing
- **Base unit:** 8px.
- **Density:** comfortable. Roomier rows in the builder/catalog than today; fewer, taller sections on marketing pages.
- **Scale:** 2xs 2 · xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64 · 4xl 96 (section rhythm on marketing pages).

## Layout
- **Approach:** hybrid. Marketing = guided narrative (one idea per section, generous air). App/Builder = calm disciplined grid.
- **Grid:** 4 col mobile / 8 col tablet / 12 col desktop. Gutter 24px.
- **Max content width:** 1200px text/marketing, 1360px for the builder's catalog + summary split.
- **Homepage section count:** target 5, down from ~9. Hero → How it works (3 steps) → Browse the catalog (13 domains) → Proof (compact) → CTA. Cut the redundant transparency/packages/testimonials pile-up; link out instead.
- **Border radius hierarchy** (not uniform bubble): `sm 8px` inputs/chips · `md 14px` cards · `lg 20px` feature panels · `pill 9999px` buttons + badges.
- **Elevation:** `shadow-sm 0 1px 2px rgba(26,25,24,.06)` · `shadow-md 0 4px 16px -4px rgba(26,25,24,.10)` · `shadow-lg 0 12px 32px -8px rgba(26,25,24,.14)`. Prefer shadow over border for card separation on the warm ground.

## Motion
- **Approach:** intentional. Gentle and quick — nothing bounces, nothing lingers.
- **Easing:** enter `cubic-bezier(.2,.7,.2,1)` · exit `cubic-bezier(.4,0,1,1)` · move `ease-in-out`.
- **Duration:** micro 80ms · short 180ms · medium 280ms · long 360ms (page-level only).
- **Signature moment:** the running Total counts up when a line item is added (280ms, ease-out). It's the one animation that earns its place — it makes "price every piece" tangible.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` collapses all of the above to ~0 (already wired in index.css).

## AI-slop guardrails (do not reintroduce)
No purple/indigo gradients · no 3-column icon-in-circle feature grid · no centered-everything · no uniform bubble radius · no decorative blobs/floating circles/wavy dividers · no emoji as design elements · no colored left-border cards · no "Built for X" hero copy · no system-ui as display font.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-02 | Initial design system | `/design-consultation`. Direction "Calm Guidance": approachable/guided, memorable thing "building software is easy now". Keep fox-orange + warm neutrals (ownable), swap generic Outfit/Inter → Bricolage Grotesque + DM Sans, add sage secondary for guidance cues, radius hierarchy, fewer/taller marketing sections. |
| 2026-09-02 | Display face: Bricolage Grotesque, not Fraunces | A warm serif on a cream ground is the current AI-design cliché. Bricolage is friendly and characterful, fits "easy/approachable" better, and isn't a convergence pick. |
| 2026-09-02 | Prices in DM Sans tabular-nums, not monospace | Money should feel human on an approachable site; monospace read as "unfinished / a bug" in the audit. |
| 2026-09-02 | Darkened `warm-400` `#9C968A` → `#6E6860`, `warm-500` `#756F63` → `#5E594F` | UI audit: `warm-400` was the de-facto "muted text" token (270+ uses) but only hit 2.8:1 on the warm ground — failed AA and was the top readability complaint. `warm-400` is ~never a border/bg so darkening it was safe; ramp stays monotonic. `--color-text-muted` and the Tailwind token both moved. |
| 2026-09-02 | Marketing site: real photography, generated on-brand | Home / About / Portfolio / Industries / Contact were text + icon-in-a-square only. Added a 13-image set generated via Gemini "nano banana" (`client/scripts/gen-images.mjs`, `sharp` → webp, `client/public/img/`), one warm editorial look. `.img-frame` helper = radius + soft shadow, no border. |
| 2026-09-02 | Motion: `<Reveal>` + `useCountUp` wired in | `framer-motion` + `motion.js` vocab existed but were unused. `components/Reveal.jsx` = scroll-reveal wrapper with a mount-time safety net (never leaves content at opacity 0). `useCountUp` drives the signature running-total tick on Home. |
| 2026-09-02 | Home hero: no italic-orange accent word | "Price *every* piece." (italic + fox) read as a Framer-template tell and spent fox-orange on a headline adjective — against the colour rules. Headlines are plain; the orange lives on the live total. |
| 2026-09-02 | Landing-page motion choreography | Hero enters in sequence (eyebrow → two headline lines blur-in → copy → CTAs → card). The quote card assembles itself: rows cascade in, then the total counts up (`useCountUp` `startDelay`). Hero washes drift slowly. All reduced-motion safe. |
| 2026-09-02 | Perf pass — see `PERF_AUDIT.md` | Entry bundle 562 KB → 75 KB (lazy jsPDF/CartDrawer, catalogue JSON off the entry), 486 KB logo → 22 KB, Razorpay/service-worker/pravatar cleaned up, images moved to Cloudinary. |
| 2026-09-02 | Mobile dashboard shell (`src/app/DashboardShell.jsx`) | Desktop keeps the static sidebar. Mobile gets a top app bar (logo · page title · search · alerts) + a fixed bottom tab bar — 4 primary destinations plus "More" (the full nav as a left drawer). Shared by client / admin / team / sales. Builder tiles are 3-up + compact under `sm`. |

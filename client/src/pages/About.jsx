import { Link } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { Section } from '@components/ui/Primitives';
import { Reveal } from '@components/Reveal';
import { Check, ArrowRight, Zap, ExternalLink } from 'lucide-react';

const ProblemItem = ({ title, desc }) => (
  <div className="py-1">
    <strong className="block text-body-sm font-semibold text-warm-900">{title}</strong>
    <p className="mt-0.5 text-body-sm leading-relaxed text-warm-600">{desc}</p>
  </div>
);

const RoadmapStep = ({ phase, title, desc, status }) => {
  const isDone = status === 'done';
  const isNow = status === 'now';
  return (
    <div className="group relative flex gap-5 pb-10 last:pb-0">
      <div className="absolute left-[17px] top-10 bottom-0 w-px bg-warm-200 group-last:hidden" />
      <div
        className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-sm font-medium ${
          isDone
            ? 'bg-fox-500 text-white'
            : isNow
              ? 'bg-sage-500 text-white ring-4 ring-sage-50'
              : 'border border-warm-200 bg-warm-100 text-warm-500'
        }`}
      >
        {isDone ? <Check size={16} /> : isNow ? <ArrowRight size={15} /> : '○'}
      </div>
      <div>
        <div className="eyebrow mb-1.5">{phase}</div>
        <h4 className="text-title text-warm-900">{title}</h4>
        <p className="mt-1 text-body-sm leading-relaxed text-warm-600">{desc}</p>
      </div>
    </div>
  );
};

export default function About() {
  usePageTitle('About Us');

  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-warm-white">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="container-fx relative py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-6">
              <span className="eyebrow mb-5">About StackFox</span>
              <h1 className="text-warm-900" style={{ fontSize: 'clamp(2.35rem, 5.5vw, 3.5rem)', lineHeight: 1.06, letterSpacing: '-0.025em' }}>
                India's first Amazon-style IT services consultancy.
              </h1>
              <p className="mt-5 max-w-lg text-body-lg text-warm-600">
                Browse, configure, purchase, and deploy IT services from a single place.
                No proposals. No ambiguity. Just technology, shipped.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {['Technology arm of Artwall Labs', 'Independent consultancy', 'E2E platform delivery', 'Est. 2026'].map((t) => (
                  <span key={t} className="badge-fx badge-neutral">{t}</span>
                ))}
              </div>
            </Reveal>

            <Reveal variant="fade" delay={0.1} className="lg:col-span-6">
              <div className="img-frame aspect-[4/3]">
                <img src="/img/about-workspace.webp" width="1400" height="1050" loading="lazy"
                  alt="The StackFox studio in the late afternoon" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 01 · Why StackFox exists ─────────────────────────── */}
      <Section className="bg-white">
        <Reveal className="max-w-2xl">
          <span className="eyebrow mb-4">01 — Why StackFox exists</span>
          <h2 className="text-3xl text-warm-900 md:text-display-lg">
            The Indian IT industry has a buying problem.
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal className="space-y-5 lg:col-span-5">
            <div className="rounded-lg border border-warm-200 bg-warm-50 p-7">
              <div className="eyebrow mb-5">The problem</div>
              <div className="space-y-4">
                <ProblemItem title="Opaque pricing" desc="You can't find out what a website or app costs without sitting through multiple calls and proposals." />
                <ProblemItem title="Endless cycles" desc="Getting a quote takes days or weeks. Most businesses give up before they even start." />
                <ProblemItem title="Fragmented delivery" desc="Design from one place, code from another. No single owner or accountability." />
                <ProblemItem title="No product thinking" desc="Most agencies sell hours, not outcomes. You buy time — not a working product." />
              </div>
            </div>
            <div className="rounded-lg border border-fox-200 bg-white p-7 shadow-md">
              <div className="eyebrow mb-5">How StackFox solves it</div>
              <div className="space-y-4">
                <ProblemItem title="Instant transparent pricing" desc="240+ services with configurable scope. See the price before you talk to anyone." />
                <ProblemItem title="End-to-end delivery" desc="From requirement to deployment to support — one team, one platform, one invoice." />
                <ProblemItem title="Amazon-style shopping" desc="Browse categories, add to cart, configure specs — like buying a product." />
                <ProblemItem title="Outcome-first consultancy" desc="We scope, build, ship, and stand behind working products. Strategy to deployment." />
              </div>
            </div>
          </Reveal>

          <Reveal className="space-y-8 lg:col-span-7">
            <div className="img-frame aspect-[16/10]">
              <img src="/img/studio-collab.webp" width="1400" height="875" loading="lazy"
                alt="The StackFox team working through a project plan" />
            </div>
            <p className="text-body-lg leading-relaxed text-warm-700">
              India's IT services industry is worth $250B+ — but buying technology as a business
              still feels like the early 2000s. There's no transparency, no standardisation, and no
              platform that lets you simply <strong className="text-warm-900">shop for technology</strong> the
              way you shop for everything else.
            </p>
            <p className="text-body-md leading-relaxed text-warm-600">
              <span className="font-semibold text-fox-600">StackFox</span> was built inside{' '}
              <span className="font-semibold text-warm-900">Artwall Labs</span> to solve exactly this.
              We started by building all the technology for Artwall's own products — and realised the
              engineering system we'd created could serve any business, not just our parent company.
            </p>
            <div className="flex items-start gap-4 rounded-lg border border-sage-200 bg-sage-50 p-6">
              <Zap size={22} className="mt-0.5 shrink-0 text-sage-600" />
              <p className="text-body-sm leading-relaxed text-warm-700">
                Today, StackFox operates as an independent consultancy and end-to-end delivery
                platform — the technology arm of Artwall Labs, with its own client base and
                commercial pipeline.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── 02 · Structure ──────────────────────────────────── */}
      <Section className="bg-warm-white">
        <Reveal className="max-w-2xl">
          <span className="eyebrow mb-4">02 — Structure</span>
          <h2 className="text-3xl text-warm-900 md:text-display-lg">
            How StackFox sits within the group
          </h2>
          <p className="mt-4 text-body-lg text-warm-600">
            All technology at Artwall Labs is built by StackFox. But StackFox is far more than an
            internal team — it's an independent operation with its own market and clients.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal className="rounded-lg border border-warm-200 bg-white p-7 shadow-sm">
            <div className="eyebrow mb-3">Parent organisation</div>
            <h3 className="text-display-sm text-warm-900">Artwall Labs Pvt Ltd</h3>
            <p className="mt-3 text-body-sm leading-relaxed text-warm-600">
              A creative-technology company building platforms for India's art and creator economy —
              marketplace infrastructure, exhibition systems, and creator networks.
            </p>
            <a href="https://artwalllabs.com" target="_blank" rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-fox-600 hover:text-fox-700">
              artwalllabs.com <ExternalLink size={13} />
            </a>
          </Reveal>

          <Reveal delay={0.08} className="rounded-lg border border-fox-200 bg-white p-7 shadow-md">
            <div className="eyebrow mb-3">Independent consultancy &amp; platform</div>
            <h3 className="text-display-sm text-fox-600">StackFox</h3>
            <p className="mt-3 text-body-sm leading-relaxed text-warm-600">
              India's first Amazon-style IT services platform. 240+ configurable services across 13
              categories. End-to-end delivery — from requirement to production.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {['Web & Mobile', 'AI & Automation', 'DevOps & Cloud', 'Design & Backend'].map((item) => (
                <div key={item} className="rounded-sm border border-warm-200 bg-warm-50 p-2.5 text-center text-body-sm font-medium text-warm-800">
                  {item}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── 03 · Trajectory ─────────────────────────────────── */}
      <Section className="bg-white">
        <Reveal className="max-w-2xl">
          <span className="eyebrow mb-4">03 — Trajectory</span>
          <h2 className="text-3xl text-warm-900 md:text-display-lg">From arm to entity.</h2>
          <p className="mt-4 text-body-lg text-warm-600">
            The path to becoming a formal subsidiary of Artwall Labs Pvt Ltd.
          </p>
        </Reveal>

        <Reveal className="mt-12 max-w-2xl">
          <RoadmapStep phase="Phase 1 · Done" title="Technology arm of Artwall Labs"
            desc="Built internally as the dedicated IT unit. All Artwall technology — fraud engine, escrow, AI curation — engineered by the StackFox team." status="done" />
          <RoadmapStep phase="Phase 2 · Done" title="Independent consultancy & marketplace"
            desc="Own client base, own pipeline, 240+ services live on the platform. Operating independently with structural backing from Artwall Labs." status="done" />
          <RoadmapStep phase="Phase 3 · Now" title="Platform scale & market presence"
            desc="Expanding to 300+ services, growing the delivery team, establishing StackFox as the default for IT service procurement in India." status="now" />
          <RoadmapStep phase="Phase 4 · Near future" title="StackFox by Artwall Labs — formal subsidiary"
            desc="Incorporation as a subsidiary. Independent entity, own P&L, funding optionality — retaining the parent group identity." status="soon" />
        </Reveal>
      </Section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="bg-warm-900 py-20 text-center">
        <div className="container-fx">
          <h2 className="text-3xl text-white md:text-display-lg">Ready to shop for technology?</h2>
          <p className="mx-auto mt-4 max-w-xl text-body-lg text-warm-300">
            Browse the catalog, configure your services, and get a professional quote in minutes.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/catalog" className="btn-fox px-8 text-base">Browse catalog <ArrowRight size={16} /></Link>
            <Link to="/contact" className="btn-outline border-white/25 bg-transparent px-8 text-base text-white hover:border-white/50">
              Contact sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Button } from '@components/ui/Primitives';
import { 
  Check, 
  X, 
  ArrowRight, 
  Target, 
  Shield, 
  Zap, 
  Building2, 
  TrendingUp, 
  Globe, 
  Cpu, 
  Code2, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import data from '@data/stackfox-data.json';

const ProblemItem = ({ title, desc }) => (
  <div className="pl-4 border-l-2 border-red-500 mb-4 py-1">
    <strong className="text-warm-900 block text-sm mb-0.5">{title}</strong>
    <p className="text-xs text-warm-500 leading-relaxed">{desc}</p>
  </div>
);

const SolveItem = ({ title, desc }) => (
  <div className="pl-4 border-l-2 border-fox-500 mb-4 py-1">
    <strong className="text-warm-900 block text-sm mb-0.5">{title}</strong>
    <p className="text-xs text-warm-500 leading-relaxed">{desc}</p>
  </div>
);

const RoadmapStep = ({ phase, title, desc, status }) => {
  const isDone = status === 'done';
  const isNow = status === 'now';
  
  return (
    <div className="flex gap-6 relative pb-10 last:pb-0 group">
      {/* Line */}
      <div className="absolute left-[17px] top-10 bottom-0 w-px bg-warm-200 group-last:hidden" />
      
      {/* Dot */}
      <div className={`
        shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono z-10
        ${isDone ? 'bg-fox-500 text-white' : isNow ? 'bg-blue-600 text-white ring-4 ring-blue-50' : 'bg-warm-100 text-warm-400 border border-warm-200'}
      `}>
        {isDone ? <Check size={16} /> : isNow ? '→' : '◎'}
      </div>
      
      <div>
        <div className="text-[10px] font-mono tracking-[0.2em] text-warm-400 uppercase mb-1">{phase}</div>
        <h4 className="text-base font-bold text-warm-900 mb-1">{title}</h4>
        <p className="text-sm text-warm-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
};

export default function About() {
  usePageTitle('About Us');
  const { company } = data;

  return (
    <div className="overflow-x-hidden">
      {/* HERO SECTION */}
      <Section className="relative py-24 sm:py-32 flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="relative z-10 max-w-4xl px-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-3 text-[10px] font-mono tracking-[0.4em] text-fox-500 uppercase mb-8">
            <span className="w-8 h-px bg-fox-500/40" />
            About Us
            <span className="w-8 h-px bg-fox-500/40" />
          </div>
          
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-warm-900 mb-6 leading-[1.1]">
            India's first <span className="text-fox-500 italic font-serif font-normal">Amazon-style</span><br />
            IT services consultancy.
          </h1>
          
          <p className="text-lg text-warm-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            End-to-end platform delivery — browse, configure, purchase, and deploy IT services from a single place. No proposals. No ambiguity. Just technology, shipped.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-2 text-[9px] font-mono tracking-widest uppercase text-warm-400">
            <span className="px-3 py-1.5 border border-fox-500/30 text-fox-500 rounded-md">Technology Arm of Artwall Labs</span>
            <span className="px-3 py-1.5 border border-warm-200 rounded-md">Independent Consultancy</span>
            <span className="px-3 py-1.5 border border-warm-200 rounded-md">E2E Platform Delivery</span>
            <span className="px-3 py-1.5 border border-warm-200 rounded-md">Est. 2026</span>
          </div>
        </div>
      </Section>

      <div className="h-px bg-warm-200 mx-8 sm:mx-16" />

      {/* 01 - WHY STACKFOX */}
      <Section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="inline-flex items-center gap-3 text-[10px] font-mono tracking-[0.4em] text-fox-500 uppercase mb-4">
            01 — Why StackFox Exists
            <span className="w-10 h-px bg-fox-500/40" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-warm-900 mb-12">
            The Indian IT industry has a <span className="text-fox-500 italic font-serif font-normal underline decoration-fox-500/20 underline-offset-8">buying problem.</span>
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              {/* Problem Box */}
              <div className="bg-warm-50/50 border border-warm-200 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-fox-500 to-blue-600" />
                <div className="text-[9px] font-mono tracking-widest text-red-600 uppercase mb-6 font-bold">The Problem</div>
                
                <ProblemItem title="Opaque pricing" desc="You can't find out what a website or app costs without sitting through multiple calls and proposals." />
                <ProblemItem title="Endless cycles" desc="Getting a quote takes days or weeks. Most businesses give up before they even start." />
                <ProblemItem title="Fragmented delivery" desc="Design from one place, code from another. No single owner or accountability." />
                <ProblemItem title="No product thinking" desc="Most agencies sell hours, not outcomes. You buy time — not a working product." />
              </div>

              {/* Solution Box */}
              <div className="bg-white border-2 border-fox-500/20 rounded-3xl p-8 shadow-xl shadow-fox-500/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-fox-500" />
                <div className="text-[9px] font-mono tracking-widest text-fox-500 uppercase mb-6 font-bold">How StackFox Solves It</div>
                
                <SolveItem title="Instant Transparent Pricing" desc="240+ services with configurable scope. See the price before you talk to anyone." />
                <SolveItem title="E2E Platform Delivery" desc="From requirement to deployment to support — one team, one platform, one invoice." />
                <SolveItem title="Amazon-style Shopping" desc="Browse categories, add to cart, configure specs — like buying a product." />
                <SolveItem title="Outcome-first Consultancy" desc="We scope, build, ship, and stand behind working products. Strategy to deployment." />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-8 py-4">
              <p className="text-lg text-warm-700 leading-relaxed">
                India's IT services industry is worth $250B+ — but buying technology as a business still feels like the early 2000s. There's no transparency, no standardisation, and no platform that lets you simply <strong>shop for technology</strong> the way you shop for everything else.
              </p>
              <p className="text-base text-warm-600 leading-relaxed">
                <span className="text-fox-500 font-bold">StackFox</span> was built inside <span className="font-bold text-warm-900">Artwall Labs</span> to solve exactly this. We started by building all the technology for Artwall's own products — and realised the engineering system we'd created could serve any business, not just our parent company.
              </p>
              <div className="p-6 bg-fox-50/50 rounded-2xl border border-fox-100 flex items-start gap-4">
                <Zap size={24} className="text-fox-500 shrink-0 mt-1" />
                <p className="text-sm text-warm-600 leading-relaxed italic">
                  "Today, StackFox operates as an independent consultancy and end-to-end delivery platform — the technology arm of Artwall Labs, with its own client base and commercial pipeline."
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 02 - STRUCTURE / MINDMAP */}
      <Section className="py-24 bg-warm-50/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-3 text-[10px] font-mono tracking-[0.4em] text-fox-500 uppercase mb-4">
            02 — Structure
            <span className="w-10 h-px bg-fox-500/40" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-warm-900 mb-6">
            How StackFox <span className="text-fox-500 italic font-serif font-normal">sits</span> within the group
          </h2>
          
          <p className="text-base text-warm-500 mb-16 max-w-2xl">
            All technology at Artwall Labs is built by StackFox. But StackFox is far more than an internal team — it's an independent operation with its own market and clients.
          </p>

          <div className="space-y-0 relative">
            {/* Center Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-fox-500/20 to-transparent -translate-x-1/2" />

            {/* Parent Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-white border-2 border-amber-500/40 rounded-3xl p-8 max-w-lg shadow-sm">
                <div className="text-[9px] font-mono tracking-[0.2em] text-amber-600 uppercase mb-3 font-bold">Parent Organisation</div>
                <h3 className="text-2xl font-bold text-warm-900 mb-3">Artwall Labs Pvt Ltd</h3>
                <p className="text-sm text-warm-500 leading-relaxed mb-4">
                  A creative-technology company building platforms for India's art and creator economy — marketplace infrastructure, exhibition systems, and creator networks.
                </p>
                <a href="https://artwalllabs.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-mono text-blue-600 hover:underline">
                  artwalllabs.com <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Connector */}
            <div className="h-16 flex flex-col items-center justify-center relative">
               <div className="px-4 py-2 bg-fox-500 text-white text-[9px] font-mono tracking-[0.3em] font-bold rounded-full relative z-20 shadow-lg shadow-fox-500/20 uppercase">
                 Technology Arm
               </div>
            </div>

            {/* Child Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-white border-2 border-fox-500 rounded-3xl p-8 max-w-2xl shadow-xl shadow-fox-500/5">
                <div className="text-[9px] font-mono tracking-[0.2em] text-fox-500 uppercase mb-3 font-bold">Independent Consultancy & Platform</div>
                <div className="flex items-end gap-3 mb-4">
                  <h3 className="text-3xl font-bold text-fox-500">StackFox</h3>
                  <span className="text-[10px] font-mono tracking-widest text-warm-400 mb-1.5 uppercase">BY ARTWALL LABS</span>
                </div>
                
                <p className="text-sm text-warm-600 leading-relaxed mb-8">
                  India's first Amazon-style IT services platform. <strong>240+ configurable services</strong> across 13 categories. End-to-end platform delivery — from requirement to production.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="p-5 bg-amber-50/50 border border-amber-200/50 rounded-2xl">
                    <div className="text-[8px] font-mono tracking-widest text-amber-600 mb-2 font-bold">FOR ARTWALL LABS</div>
                    <p className="text-xs text-warm-600 leading-relaxed">
                      Builds <strong>all technology</strong> for the Artwall ecosystem — anti-fraud engines, escrow systems, and creator portfolio platforms.
                    </p>
                  </div>
                  <div className="p-5 bg-fox-50/50 border border-fox-200/50 rounded-2xl">
                    <div className="text-[8px] font-mono tracking-widest text-fox-500 mb-2 font-bold">INDEPENDENT OPERATIONS</div>
                    <p className="text-xs text-warm-600 leading-relaxed">
                      Runs its <strong>own client base</strong> and pipeline. Acquires clients directly, scopes projects, and delivers end-to-end solutions.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {['Web & Mobile', 'AI & Automation', 'DevOps & Cloud', 'Design & Backend'].map(item => (
                    <div key={item} className="p-3 bg-warm-50 border border-warm-200 rounded-xl text-[11px] font-bold text-warm-900 text-center">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-warm-100">
                  {['240+ Services', 'Own Revenue', 'E2E Platform', 'Subsidiary Path'].map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-warm-100 text-warm-500 text-[8px] font-mono tracking-wider rounded uppercase">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 03 - TRAJECTORY */}
      <Section className="py-24">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-3 text-[10px] font-mono tracking-[0.4em] text-fox-500 uppercase mb-4">
            03 — Trajectory
            <span className="w-10 h-px bg-fox-500/40" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-warm-900 mb-6">
            From <span className="text-fox-500 italic font-serif font-normal">arm</span> to <span className="text-fox-500 italic font-serif font-normal">entity.</span>
          </h2>
          
          <p className="text-base text-warm-500 mb-16">
            The path to becoming a formal subsidiary of Artwall Labs Pvt Ltd.
          </p>

          <div className="max-w-2xl">
            <RoadmapStep 
              phase="PHASE 1 · DONE" 
              title="Technology arm of Artwall Labs" 
              desc="Built internally as the dedicated IT unit. All Artwall technology — fraud engine, escrow, AI curation — engineered by the StackFox team." 
              status="done" 
            />
            <RoadmapStep 
              phase="PHASE 2 · DONE" 
              title="Independent consultancy & marketplace" 
              desc="Own client base, own pipeline, 240+ services live on the platform. Operating independently with structural backing from Artwall Labs." 
              status="done" 
            />
            <RoadmapStep 
              phase="PHASE 3 · NOW" 
              title="Platform scale & market presence" 
              desc="Expanding to 300+ services, growing the delivery team, establishing StackFox as the default for IT service procurement in India." 
              status="now" 
            />
            <RoadmapStep 
              phase="PHASE 4 · NEAR FUTURE" 
              title="StackFox by Artwall Labs — Formal Subsidiary" 
              desc="Incorporation as a subsidiary. Independent entity, own P&L, funding optionality — retaining the parent group identity." 
              status="soon" 
            />
          </div>
        </div>
      </Section>

      {/* CTA SECTION */}
      <Section className="py-24 bg-warm-900 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6">Ready to shop for technology?</h2>
          <p className="text-warm-400 mb-10">
            Browse our catalog, configure your services, and get a professional quote in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/services" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full px-8 py-6 rounded-2xl h-auto text-base">
                Browse Catalog
              </Button>
            </Link>
            <Link to="/contact" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full px-8 py-6 rounded-2xl h-auto text-base border-white/20 text-white hover:bg-white/10">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}

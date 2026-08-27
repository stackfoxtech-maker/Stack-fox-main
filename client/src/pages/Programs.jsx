import { Users, Briefcase, Rocket, Building2, ArrowRight } from 'lucide-react';

const programs = [
  {
    icon: Users,
    title: 'Referral Program',
    tagline: 'Earn ₹5,000 per successful referral',
    description: 'Refer businesses to StackFox and earn cash rewards for every client that signs up. No limits on referrals — the more you share, the more you earn.',
    perks: ['₹5,000 per referral', 'Real-time tracking dashboard', 'Monthly payouts via UPI/Bank'],
    cta: 'Start Referring',
    href: '/referral',
    color: 'fox',
  },
  {
    icon: Briefcase,
    title: 'Partner Program',
    tagline: 'For agencies & freelancers',
    description: 'White-label our services or co-deliver projects. Get priority support, co-branded collateral, and revenue sharing on every deal.',
    perks: ['Revenue sharing up to 20%', 'White-label options', 'Dedicated partner manager'],
    cta: 'Apply Now',
    href: '#',
    color: 'blue',
  },
  {
    icon: Rocket,
    title: 'Startup Program',
    tagline: 'Discounted rates for early-stage startups',
    description: 'Building something new? Get up to 40% off on development, design, and marketing services. Available for startups under 2 years old with less than ₹2Cr revenue.',
    perks: ['Up to 40% discount', 'Flexible payment plans', 'Mentorship sessions'],
    cta: 'Apply Now',
    href: '#',
    color: 'emerald',
  },
  {
    icon: Building2,
    title: 'Enterprise Program',
    tagline: 'Custom solutions at scale',
    description: 'Dedicated account teams, SLA-backed delivery, volume pricing, and custom integrations for large organizations with ongoing needs.',
    perks: ['Volume pricing', 'Dedicated account team', 'Custom SLAs & compliance'],
    cta: 'Contact Sales',
    href: '#',
    color: 'purple',
  },
];

const colorMap = {
  fox: 'bg-fox-500/10 text-fox-500',
  blue: 'bg-blue-500/10 text-blue-500',
  emerald: 'bg-emerald-500/10 text-emerald-500',
  purple: 'bg-purple-500/10 text-purple-500',
};

export default function Programs() {
  return (
    <div className="min-h-screen bg-warm-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-warm-900 mb-3">Programs & Partnerships</h1>
          <p className="text-warm-500 max-w-xl mx-auto">Grow with StackFox — whether you are referring clients, partnering as an agency, launching a startup, or scaling an enterprise.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {programs.map(prog => (
            <div key={prog.title} className="bg-white rounded-2xl border border-warm-200 p-6 flex flex-col">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorMap[prog.color]}`}>
                <prog.icon size={22} />
              </div>
              <h2 className="text-xl font-bold text-warm-900">{prog.title}</h2>
              <p className="text-sm font-medium text-fox-500 mb-2">{prog.tagline}</p>
              <p className="text-sm text-warm-600 mb-4 flex-1">{prog.description}</p>
              <ul className="space-y-1 mb-5">
                {prog.perks.map((p, i) => (
                  <li key={i} className="text-sm text-warm-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-fox-500" /> {p}
                  </li>
                ))}
              </ul>
              <a href={prog.href} className="inline-flex items-center gap-2 text-sm font-semibold text-fox-500 hover:text-fox-600 transition">
                {prog.cta} <ArrowRight size={16} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

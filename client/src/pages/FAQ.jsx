import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const faqs = [
  { q: 'How does StackFox pricing work?', a: 'All prices are transparent and listed per service. You pick exactly what you need — no hidden fees. Final quotes may be lower for bundles.' },
  { q: 'What payment methods do you accept?', a: 'We accept UPI, credit/debit cards, net banking, and bank transfers. All payments are processed securely through Razorpay.' },
  { q: 'How long does a typical project take?', a: 'Timelines vary by complexity. A simple website takes 7-10 days, a mobile app 30-45 days, and a full SaaS product 60-90 days. Each service shows its estimated delivery time.' },
  { q: 'Do you offer refunds?', a: 'We offer milestone-based payments. If you are not satisfied after the first milestone, you can request a full refund for undelivered work.' },
  { q: 'Can I customize a package?', a: 'Absolutely! Use our Build & Price tool to pick individual services, or start with a package and add/remove items. Everything is modular.' },
  { q: 'Do you provide ongoing support?', a: 'Yes. We offer monthly maintenance retainers starting at ₹15,000/month, or you can buy a 10-hour bug fix package as needed.' },
  { q: 'What technologies do you use?', a: 'React, Next.js, React Native, Node.js, Python, PostgreSQL, Redis, AWS, Docker, Kubernetes — and more. We pick the best stack for your project.' },
  { q: 'Do you sign NDAs?', a: 'Yes. We sign NDAs before any project discussion. You can download our NDA template from the Legal Templates tool.' },
  { q: 'How do I track my project progress?', a: 'Every client gets access to a dashboard with real-time project tracking, file sharing, messaging, and milestone updates.' },
  { q: 'Can you work with my existing codebase?', a: 'Yes. We regularly take over projects from other teams. We start with a code audit, then create a stabilization plan.' },
  { q: 'Do you offer discounts for startups?', a: 'Yes! Our Startup Program offers up to 30% off for early-stage startups. Apply through our Programs page.' },
  { q: 'What is your revision policy?', a: 'Each milestone includes 2 rounds of revisions. Additional revisions are billed at our hourly rate.' },
];

export default function FAQ() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const filtered = faqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold text-warm-900 text-center mb-2">Frequently Asked Questions</h1>
      <p className="text-warm-500 text-center mb-8">Everything you need to know about working with StackFox.</p>

      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..." className="w-full pl-11 pr-4 py-3 bg-white border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/20 focus:border-fox-500" />
      </div>

      <div className="space-y-3">
        {filtered.map((f, i) => (
          <div key={i} className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 text-left">
              <span className="font-medium text-warm-900 text-sm">{f.q}</span>
              <ChevronDown size={18} className={`text-warm-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <div className="px-6 pb-4 text-sm text-warm-600 leading-relaxed">{f.a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

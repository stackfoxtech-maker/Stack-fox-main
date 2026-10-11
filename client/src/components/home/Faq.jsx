import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Reveal } from '@components/Reveal';

// Facts from shared/stackfox-data.json — keep numbers in sync with it.
const FAQS = [
  {
    q: 'Are the prices final?',
    a: 'Prices are indicative starting points. Final pricing depends on complexity and timeline; you get a detailed quote after a free call.',
  },
  {
    q: 'Is GST included?',
    a: 'Prices are exclusive of GST. 18% GST is added at checkout and shown line by line on every invoice.',
  },
  {
    q: 'Can I pay in instalments?',
    a: 'Yes. Projects above ₹50,000 are billed by milestone, so you pay as each phase is delivered. Razorpay also supports EMI on credit cards.',
  },
  {
    q: 'How long does a project take?',
    a: 'A simple website takes 1–2 weeks, a mobile app 3–5 weeks, and a full SaaS product 6–10 weeks. Each service shows its estimate, and your proposal has exact dates.',
  },
  {
    q: 'What happens after launch?',
    a: 'Every project includes 30 days of free bug-fix support. After that you can take a monthly maintenance plan from ₹15,000/month.',
  },
  {
    q: 'Do you sign NDAs?',
    a: 'Yes, before any project discussion if you ask. Your ideas and data stay confidential.',
  },
];

export function Faq() {
  return (
    <section className="bg-warm-white section-padding">
      <div className="container-fx grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 className="font-display text-3xl text-warm-900 md:text-display-lg">
              Questions, answered
            </h2>
            <p className="mt-3 text-body-lg text-warm-800">
              Pricing, payments, timelines and what happens after launch.
            </p>
            <div className="mt-8 border-t border-warm-200 pt-6">
              <p className="text-body text-warm-700">
                Still unsure?{' '}
                <a
                  href="tel:+918209395894"
                  className="font-medium text-warm-900 underline decoration-warm-300 underline-offset-4 hover:decoration-fox-500"
                >
                  Call +91 82093 95894
                </a>
              </p>
              <Link
                to="/contact"
                className="mt-3 inline-block text-body-sm text-warm-800 underline decoration-warm-300 underline-offset-4 hover:text-warm-900"
              >
                Or send us a message
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal stagger className="border-t border-warm-200 lg:col-span-8">
          {FAQS.map(({ q, a }, i) => (
            <Reveal.Item key={q} className="border-b border-warm-200">
              <details className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-body-lg font-medium text-warm-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    className="size-5 shrink-0 text-warm-700 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="max-w-prose pb-6 text-body text-warm-800">{a}</p>
              </details>
            </Reveal.Item>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

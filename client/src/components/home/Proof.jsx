import { Check } from 'lucide-react';
import { Reveal } from '@components/Reveal';

// The one real client quote we have. Do not add invented ones.
const RECEIPT = [
  'Storefront + subscriptions',
  '6 weeks, 4 milestones',
  'Paid by milestone',
  'GST invoices for every payment',
];

export function Proof() {
  return (
    <section className="bg-white section-padding">
      <div className="container-fx grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
        <Reveal as="figure" className="lg:col-span-7">
          <blockquote className="max-w-[28ch] font-display text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] leading-[1.15] tracking-tight text-warm-900">
            “I priced the whole build in an afternoon, sent the list, and had a call booked by the
            next morning. No back-and-forth, no guessing.”
          </blockquote>
          <figcaption className="mt-8 max-w-md border-t border-warm-200 pt-5">
            <p className="text-body font-medium text-warm-900">Neha R.</p>
            <p className="text-body-sm text-warm-800">Founder, D2C skincare</p>
            <p className="mt-2 text-body-sm text-warm-700">
              Shipped a storefront + subscriptions in 6 weeks.
            </p>
          </figcaption>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.1}>
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-warm-200 md:p-8">
            <p className="text-caption text-warm-700">Project receipt</p>
            <ul className="mt-4 divide-y divide-warm-100">
              {RECEIPT.map((row) => (
                <li key={row} className="flex items-center gap-3 py-3 text-body text-warm-800">
                  <Check className="size-4 shrink-0 text-sage-600" strokeWidth={2.5} aria-hidden />
                  {row}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-5 text-body-sm text-warm-700">
            GST registered · NDA on request · ISO 27001 aligned
          </p>
        </Reveal>
      </div>
    </section>
  );
}

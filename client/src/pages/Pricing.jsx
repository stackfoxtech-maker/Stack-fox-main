import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Section, SectionHeading } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';

// A handful of ₹2 placeholder rows sit in the catalogue; ignore anything that
// small so the range reads as a real starting price, not a bug.
const realPrices = (services) => services.map((s) => s.price).filter((p) => p >= 500);

export default function Pricing() {
  usePageTitle('Pricing');
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <>
      <Section>
        <SectionHeading
          label="The catalog"
          title="Transparent pricing, no surprises"
          description="Every service is priced individually. Ranges below are indicative and exclude 18% GST — you'll see an exact quote after a free call."
        />

        <div className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {data.categories.map((cat) => {
            const services = data.services.filter((s) => s.catId === cat.id);
            const prices = realPrices(services);
            const min = prices.length ? Math.min(...prices) : 0;
            const max = prices.length ? Math.max(...prices) : 0;
            return (
              <div key={cat.id}>
                <Link
                  to={`/catalog?category=${cat.id}`}
                  className="group flex h-full flex-col rounded-md border border-warm-200 bg-white p-5 shadow-sm transition-transform duration-short hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-title text-warm-900 group-hover:text-fox-700">{cat.name}</h3>
                    <ArrowRight size={15} className="mt-1 text-warm-300 transition-colors group-hover:text-fox-500" />
                  </div>
                  <p className="mt-0.5 text-body-sm text-sage-700">{services.length} services</p>
                  <p className="mt-4 price-tag text-body-lg text-warm-900">
                    {formatINR(min)} <span className="text-warm-400">–</span> {formatINR(max)}
                  </p>
                </Link>
              </div>
            );
          })}
        </div>

        <SectionHeading label="Packages" title="Bundle pricing" description="Curated bundles that save 15–30% versus picking the pieces one by one." center={false} />
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[36rem] text-body-sm">
            <thead>
              <tr className="border-b border-warm-200 text-label uppercase text-warm-500">
                <th className="py-3 pr-4 text-left font-medium">Package</th>
                <th className="py-3 px-4 text-right font-medium">Price</th>
                <th className="py-3 px-4 text-right font-medium">You save</th>
                <th className="py-3 px-4 text-center font-medium">Services</th>
                <th className="py-3 pl-4" />
              </tr>
            </thead>
            <tbody>
              {data.packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-warm-100 transition-colors hover:bg-warm-50">
                  <td className="py-3.5 pr-4">
                    <span className="font-medium text-warm-900">{pkg.name}</span>
                    {pkg.popular && <span className="badge-fx badge-fox ml-2 text-caption">Popular</span>}
                  </td>
                  <td className="py-3.5 px-4 text-right price-tag text-warm-900">{formatINR(pkg.price)}</td>
                  <td className="py-3.5 px-4 text-right price-tag text-sage-700">{formatINR(pkg.savings)}</td>
                  <td className="py-3.5 px-4 text-center text-warm-500">{pkg.items.length}</td>
                  <td className="py-3.5 pl-4 text-right">
                    <Link to="/packages" className="inline-flex items-center gap-1 text-body-sm font-medium text-fox-600 hover:text-fox-700">
                      Details <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section className="bg-white">
        <SectionHeading label="FAQ" title="Common questions" />
        <div className="mx-auto max-w-2xl space-y-2.5">
          {data.faq.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className="overflow-hidden rounded-md border border-warm-200 bg-warm-white">
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-body-md font-medium text-warm-900 hover:bg-warm-50"
                >
                  {item.q}
                  {open ? <Minus size={16} className="shrink-0 text-fox-500" /> : <Plus size={16} className="shrink-0 text-warm-400" />}
                </button>
                {open && (
                  <div className="animate-fade-in px-5 pb-4 text-body-sm leading-relaxed text-warm-600">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

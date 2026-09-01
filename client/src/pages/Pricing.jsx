import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { formatINR, cn } from '@lib/utils';
import { Section, SectionHeading } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';

export default function Pricing() {
  usePageTitle('Pricing');
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <>
      <Section>
        <SectionHeading title="Transparent pricing, no surprises" description="Every service is individually priced. All prices are indicative and exclusive of 18% GST." />

        {/* Price ranges by category */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {data.categories.map((cat) => {
            const services = data.services.filter((s) => s.catId === cat.id);
            const prices = services.map((s) => s.price);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            return (
              <Link key={cat.id} to={`/catalog?category=${cat.id}`} className="card-fx p-5 group">
                <h3 className="text-sm font-semibold text-warm-900 mb-1 group-hover:text-fox-500 transition-colors">{cat.name}</h3>
                <p className="text-xs text-warm-500 mb-3">{services.length} services</p>
                <div className="tabular-nums text-sm font-medium text-warm-700">
                  {formatINR(min)} – {formatINR(max)}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Package pricing */}
        <SectionHeading label="Packages" title="Bundle pricing" description="Save 15–30% with curated packages." center={false} />
        <div className="overflow-x-auto mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200">
                <th className="text-left py-3 px-4 font-semibold text-warm-700">Package</th>
                <th className="text-right py-3 px-4 font-semibold text-warm-700">Price</th>
                <th className="text-right py-3 px-4 font-semibold text-warm-700">Savings</th>
                <th className="text-center py-3 px-4 font-semibold text-warm-700">Services</th>
                <th className="text-right py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {data.packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-warm-100 hover:bg-warm-50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium text-warm-900">{pkg.name}</span>
                    {pkg.popular && <span className="badge-fx badge-fox ml-2 text-[10px]">Popular</span>}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium">{formatINR(pkg.price)}</td>
                  <td className="py-3 px-4 text-right text-success-700 tabular-nums">{formatINR(pkg.savings)}</td>
                  <td className="py-3 px-4 text-center text-warm-500">{pkg.items.length}</td>
                  <td className="py-3 px-4 text-right">
                    <Link to="/packages" className="text-fox-500 text-xs hover:underline">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="bg-white">
        <SectionHeading label="FAQ" title="Common questions" />
        <div className="max-w-2xl mx-auto space-y-2">
          {data.faq.map((item, i) => (
            <div key={i} className="border border-warm-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-warm-900 hover:bg-warm-50 transition-colors"
              >
                {item.q}
                <HelpCircle size={16} className={cn('text-warm-400 shrink-0 ml-2 transition-transform', openFaq === i && 'rotate-45')} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-warm-600 leading-relaxed animate-fade-in">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

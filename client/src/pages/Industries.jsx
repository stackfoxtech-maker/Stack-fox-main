import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ShoppingCart, ArrowRight, Heart, Building2, GraduationCap, UtensilsCrossed, Calendar, ShoppingBag } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Section, SectionHeading, Button } from '@components/ui/Primitives';
import { Reveal } from '@components/Reveal';
import CdnImage from '@components/CdnImage';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import data from '@data/stackfox-data.json';

const bundleIcons = { 'ind-healthcare': Heart, 'ind-realestate': Building2, 'ind-ecommerce': ShoppingBag, 'ind-education': GraduationCap, 'ind-food': UtensilsCrossed, 'ind-events': Calendar };

export default function Industries() {
  usePageTitle('Industry Solutions');
  const [expanded, setExpanded] = useState(null);
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <Section>
      <SectionHeading label="Industries" title="Solutions built for your industry" description="Pre-configured bundles with everything your industry needs. Customize further in the Service Builder." />

      <Reveal variant="fade" className="img-frame mb-12 aspect-[16/7]">
        <CdnImage
          name="industries-hero" w={1400} eager
          sizes="(min-width: 1200px) 1152px, 100vw"
          width={1400} height={612}
          alt="An independent shop owner in the doorway of her storefront at golden hour" />
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {data.industryBundles.map((bundle) => {
          const Icon = bundleIcons[bundle.id] || Building2;
          const isExpanded = expanded === bundle.id;

          return (
            <div key={bundle.id} className="card-fx-elevated p-6 flex flex-col">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-md bg-fox-50 text-fox-600 flex items-center justify-center shrink-0">
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-title text-warm-900">{bundle.name}</h3>
                  <p className="text-body-sm text-warm-600 mt-1">{bundle.description}</p>
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-4 ml-16">
                <span className="price-tag text-2xl text-warm-900">{formatINR(bundle.price)}</span>
                <span className="text-body-sm text-warm-500">+ GST</span>
              </div>

              {/* Features */}
              <div className="mb-4 ml-16">
                <h4 className="text-label uppercase text-warm-500 mb-2">What's included</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {bundle.features.slice(0, isExpanded ? bundle.features.length : 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-body-sm text-warm-700">
                      <Check size={14} className="text-success-500 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                {bundle.features.length > 4 && (
                  <button onClick={() => setExpanded(isExpanded ? null : bundle.id)} className="text-body-sm text-fox-600 font-medium hover:underline mt-2">
                    {isExpanded ? 'Show less' : `+${bundle.features.length - 4} more features`}
                  </button>
                )}
              </div>

              <div className="flex gap-2 mt-auto ml-16 pt-4 border-t border-warm-100">
                <Button variant="primary" onClick={() => addItem({ itemId: bundle.id, itemType: 'bundle', name: bundle.name, price: bundle.price }, isAuthenticated)}>
                  <ShoppingCart size={16} /> Add to Cart
                </Button>
                <Link to="/builder" className="btn-outline text-sm px-4">Customize</Link>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ShoppingCart,
  Heart,
  Building2,
  GraduationCap,
  UtensilsCrossed,
  Calendar,
  ShoppingBag,
} from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Section, Button } from '@components/ui/Primitives';
import { Reveal } from '@components/Reveal';
import { PageHero } from '@components/layout/PageHero';
import { SpotlightGlow, spotlightProps } from '@components/home/HomeMotion';
import CdnImage from '@components/CdnImage';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import data from '@data/stackfox-data.json';

const bundleIcons = {
  'ind-healthcare': Heart,
  'ind-realestate': Building2,
  'ind-ecommerce': ShoppingBag,
  'ind-education': GraduationCap,
  'ind-food': UtensilsCrossed,
  'ind-events': Calendar,
};

const SHOWN = 4;

export default function Industries() {
  usePageTitle('Industry Solutions');
  const [expanded, setExpanded] = useState(null);
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const bundles = data.industryBundles;
  const features = bundles.reduce((n, b) => n + b.features.length, 0);
  const from = Math.min(...bundles.map((b) => b.price));

  return (
    <Section>
      <PageHero
        eyebrow="Industries"
        title="Solutions built for your industry"
        accent="your industry"
        description="Pre-configured bundles with everything your industry needs. Customise further in the Service Builder."
        stats={[
          { end: bundles.length, label: 'industry bundles' },
          { end: features, suffix: '+', label: 'features included' },
          { end: from, prefix: '₹', label: 'bundles start at' },
          { end: 18, suffix: '%', label: 'GST shown upfront' },
        ]}
      />

      <Reveal variant="fade" className="img-frame mb-10 aspect-[16/8] md:mb-12 md:aspect-[16/7]">
        <CdnImage
          name="industries-hero"
          w={1400}
          eager
          sizes="(min-width: 1200px) 1152px, 100vw"
          width={1400}
          height={612}
          alt="An independent shop owner in the doorway of her storefront at golden hour"
        />
      </Reveal>

      <Reveal stagger className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-2">
        {bundles.map((bundle) => {
          const Icon = bundleIcons[bundle.id] || Building2;
          const isExpanded = expanded === bundle.id;
          const list = isExpanded ? bundle.features : bundle.features.slice(0, SHOWN);

          return (
            <Reveal.Item
              key={bundle.id}
              {...spotlightProps}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white p-5 shadow-sm transition-all duration-medium hover:-translate-y-0.5 hover:border-fox-200 hover:shadow-lg sm:p-6"
            >
              <SpotlightGlow />
              <div className="relative flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fox-50 text-fox-600 transition-all duration-medium group-hover:-rotate-6 group-hover:scale-105 group-hover:bg-fox-500 group-hover:text-white">
                  <Icon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-title text-warm-900">{bundle.name}</h3>
                  <p className="mt-1 text-body-sm text-warm-600">{bundle.description}</p>
                </div>
              </div>

              <div className="relative mt-5 flex items-baseline gap-2">
                <span className="price-tag text-3xl font-bold tracking-tight text-warm-900">
                  {formatINR(bundle.price)}
                </span>
                <span className="text-body-sm text-warm-500">+ GST</span>
              </div>

              <div className="relative mt-4">
                <h4 className="mb-2 text-label uppercase text-warm-500">What's included</h4>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {list.map((f) => (
                      <motion.li
                        key={f}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-2 text-body-sm text-warm-700"
                      >
                        <Check size={14} className="mt-0.5 shrink-0 text-success-500" /> {f}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                {bundle.features.length > SHOWN && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : bundle.id)}
                    aria-expanded={isExpanded}
                    className="mt-1 inline-flex min-h-11 items-center text-body-sm font-medium text-fox-600 hover:underline sm:mt-2 sm:min-h-0"
                  >
                    {isExpanded ? 'Show less' : `+${bundle.features.length - SHOWN} more features`}
                  </button>
                )}
              </div>

              <div className="relative mt-auto flex flex-wrap gap-2 border-t border-warm-100 pt-4">
                <Button
                  variant="primary"
                  onClick={() =>
                    addItem(
                      {
                        itemId: bundle.id,
                        itemType: 'bundle',
                        name: bundle.name,
                        price: bundle.price,
                      },
                      isAuthenticated,
                    )
                  }
                >
                  <ShoppingCart size={16} /> Add to Cart
                </Button>
                <Link to="/builder" className="btn-outline px-4 text-sm">
                  Customise
                </Link>
              </div>
            </Reveal.Item>
          );
        })}
      </Reveal>
    </Section>
  );
}

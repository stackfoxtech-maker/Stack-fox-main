import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ArrowRight,
  ShoppingCart,
  ChevronRight,
  X,
  Globe,
  ShoppingBag,
  Smartphone,
  Layers,
  Brain,
  Shield,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePageTitle, useMediaQuery } from '@lib/hooks';
import { formatINR, formatINRRounded } from '@lib/utils';
import { Section, SectionHeading, Button, Spinner } from '@components/ui/Primitives';
import BottomSheet from '@components/builder/BottomSheet';
import { haptic } from '@components/builder/MobileBuilder';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import { useCatalogue } from '@lib/useStorefrontData';

const PKG_ICON = {
  'pkg-starter': Globe,
  'pkg-business': Globe,
  'pkg-ecommerce': ShoppingBag,
  'pkg-mobile': Smartphone,
  'pkg-saas': Layers,
  'pkg-ai': Brain,
  'pkg-security': Shield,
  'pkg-growth': TrendingUp,
};

/* Phone card, laid out like an app store listing: an icon tile, the name and one-line pitch,
   the price with the saving as a badge, the first few included services as chips, and two
   48px actions. The full list lives in a sheet, so cards stay a scannable height.
   "Add" confirms itself in place (a tick for a moment) instead of silently changing the cart. */
function PackageCard({ pkg, individualTotal, items, onDetails, onAdd }) {
  const Icon = PKG_ICON[pkg.id] || Sparkles;
  const [added, setAdded] = useState(false);
  const pct = individualTotal > 0 ? Math.round((pkg.savings / individualTotal) * 100) : 0;
  const shown = items.slice(0, 3);
  const handleAdd = () => {
    onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-white p-4 shadow-[0_2px_14px_-6px_rgba(26,25,24,0.16)] ${
        pkg.popular ? 'border-fox-300 pt-9' : 'border-warm-200'
      }`}
    >
      {pkg.popular && (
        <span className="absolute right-0 top-0 rounded-bl-2xl bg-fox-500 px-3 py-1 text-[11px] font-bold tracking-wide text-white">
          MOST POPULAR
        </span>
      )}
      <div className="flex items-start gap-3.5">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
            pkg.popular ? 'bg-fox-500 text-white' : 'bg-fox-50 text-fox-600'
          }`}
        >
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[17px] font-semibold leading-snug text-warm-900">{pkg.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-warm-500">
            {pkg.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="price-tag text-[1.65rem] font-bold leading-none tracking-tight text-warm-900">
            {formatINRRounded(pkg.price)}
          </p>
          <p className="mt-1.5 text-xs text-warm-500">
            <span className="line-through">{formatINRRounded(individualTotal)}</span> · + 18% GST
          </p>
        </div>
        {pct > 0 && (
          <span className="rounded-full bg-success-50 px-3 py-1.5 text-[13px] font-bold text-success-700">
            Save {pct}%
          </span>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <span
            key={s.id}
            className="max-w-[11.5rem] truncate rounded-full bg-warm-50 px-2.5 py-1 text-xs text-warm-600"
          >
            {s.name}
          </span>
        ))}
        {items.length > shown.length && (
          <button
            type="button"
            onClick={onDetails}
            className="rounded-full bg-fox-50 px-2.5 py-1 text-xs font-semibold text-fox-600"
          >
            +{items.length - shown.length} more
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={onDetails}
          className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-warm-200 text-[15px] font-semibold text-warm-700 transition-colors active:bg-warm-50"
        >
          Details <ChevronRight size={16} />
        </button>
        <motion.button
          type="button"
          onClick={handleAdd}
          whileTap={{ scale: 0.96 }}
          className={`flex min-h-12 flex-[1.3] items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white shadow-md transition-colors ${
            added ? 'bg-sage-600' : 'bg-fox-500'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={added ? 'added' : 'add'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.14 }}
              className="flex items-center gap-2"
            >
              {added ? (
                <>
                  <Check size={18} strokeWidth={3} /> Added
                </>
              ) : (
                <>
                  <ShoppingCart size={17} /> Add to cart
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

function PackageSheet({ data, onClose, onAdd }) {
  const pkg = data?.pkg;
  return (
    <BottomSheet open={!!pkg} onClose={onClose} label={pkg?.name || 'Package details'}>
      {pkg && (
        <div className="px-5 pb-2 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {pkg.popular && <span className="badge-fx badge-fox mb-2 px-3">Most Popular</span>}
              <h2 className="text-xl font-semibold leading-snug text-warm-900">{pkg.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-warm-500 active:bg-warm-100"
            >
              <X size={20} />
            </button>
          </div>
          <p className="mt-2 text-body-md leading-relaxed text-warm-600">{pkg.description}</p>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-warm-500">
            {data.items.length} services included
          </p>
          <ul className="space-y-2.5">
            {data.items.map((s) => (
              <li key={s.id} className="flex items-start gap-2.5 text-[15px] text-warm-700">
                <Check size={16} className="mt-1 shrink-0 text-success-500" />
                <span className="flex-1">{s.name}</span>
                <span className="price-tag text-sm text-warm-400">{formatINRRounded(s.price)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-success-50 px-4 py-3 text-sm">
            <span className="text-warm-600 line-through">
              {formatINRRounded(data.individualTotal)}
            </span>
            <span className="font-semibold text-success-700">
              You save {formatINRRounded(pkg.savings)}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div>
              <p className="price-tag text-2xl text-warm-900">{formatINRRounded(pkg.price)}</p>
              <p className="text-xs text-warm-500">+ 18% GST</p>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic();
                onAdd(pkg);
                onClose();
              }}
              className="flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-fox-500 text-base font-bold text-white shadow-md transition-transform active:scale-[0.98]"
            >
              <ShoppingCart size={18} /> Add to cart
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

export default function Packages() {
  usePageTitle('Packages');
  const { services, packages, loading } = useCatalogue();
  const serviceMap = services.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const [expanded, setExpanded] = useState(null);
  const [sheet, setSheet] = useState(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  if (loading)
    return (
      <Section>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Section>
    );

  const handleAddPackage = (pkg) => {
    addItem(
      { itemId: pkg.id, itemType: 'package', name: pkg.name, price: pkg.price },
      isAuthenticated,
    );
  };

  const resolve = (pkg) => {
    const items = pkg.items.map((id) => serviceMap[id]).filter(Boolean);
    return { pkg, items, individualTotal: items.reduce((sum, s) => sum + s.price, 0) };
  };

  return (
    <Section className="!pt-5 md:!pt-24">
      {/* Compact left-aligned header on phones so packages start in the first screen */}
      <div className="mb-5 md:hidden">
        <h1 className="text-[1.65rem] leading-tight text-warm-900">
          Pre-built packages, better value
        </h1>
        <p className="mt-1.5 text-body-sm text-warm-600">
          Curated bundles that save you 15–30% versus picking services one by one.
        </p>
      </div>
      <div className="hidden md:block">
        <SectionHeading
          label="Packages"
          title="Pre-built packages, better value"
          description="Curated bundles that save you 15–30% compared to picking services individually."
        />
      </div>

      {isMobile ? (
        <div className="space-y-4 pt-1">
          {packages.map((pkg) => {
            const r = resolve(pkg);
            return (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                individualTotal={r.individualTotal}
                items={r.items}
                onDetails={() => setSheet(r)}
                onAdd={() => {
                  haptic();
                  handleAddPackage(pkg);
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const resolvedItems = pkg.items.map((id) => serviceMap[id]).filter(Boolean);
            const individualTotal = resolvedItems.reduce((sum, s) => sum + s.price, 0);
            const isExpanded = expanded === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`card-fx-elevated flex flex-col ${pkg.popular ? 'ring-2 ring-fox-500 relative' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-fx badge-fox px-4">Most Popular</span>
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-semibold text-warm-900 mb-2">{pkg.name}</h3>
                  <p className="text-sm text-warm-500 mb-5">{pkg.description}</p>

                  <div className="mb-5">
                    <div className="flex items-baseline gap-2">
                      <span className="price-tag text-3xl text-warm-900">
                        {formatINR(pkg.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-body-sm text-warm-500 line-through">
                        {formatINR(individualTotal)}
                      </span>
                      <span className="badge-fx badge-success">Save {formatINR(pkg.savings)}</span>
                    </div>
                    <p className="text-caption text-warm-500 mt-1">+ 18% GST</p>
                  </div>

                  <div className="mb-5">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : pkg.id)}
                      className="text-sm text-fox-500 font-medium hover:underline mb-2"
                    >
                      {isExpanded ? 'Hide' : 'Show'} {resolvedItems.length} included services
                    </button>
                    {isExpanded && (
                      <ul className="space-y-1.5 animate-fade-in">
                        {resolvedItems.map((s) => (
                          <li key={s.id} className="flex items-start gap-2 text-xs text-warm-600">
                            <Check size={14} className="text-success-500 shrink-0 mt-0.5" />
                            <span>
                              {s.name} <span className="text-warm-400">({formatINR(s.price)})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => handleAddPackage(pkg)}
                    >
                      <ShoppingCart size={16} /> Add to Cart
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-center md:mt-12">
        <p className="mb-4 text-warm-500">
          Need something custom? Pick individual services instead.
        </p>
        <Link to="/builder" className="btn-outline px-8">
          Open Service Builder <ArrowRight size={16} />
        </Link>
      </div>

      <PackageSheet data={sheet} onClose={() => setSheet(null)} onAdd={handleAddPackage} />
    </Section>
  );
}

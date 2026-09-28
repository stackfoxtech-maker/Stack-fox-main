import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, ShoppingCart, ChevronRight, X } from 'lucide-react';
import { usePageTitle, useMediaQuery } from '@lib/hooks';
import { formatINR, formatINRRounded } from '@lib/utils';
import { Section, SectionHeading, Button, Spinner } from '@components/ui/Primitives';
import BottomSheet from '@components/builder/BottomSheet';
import { haptic } from '@components/builder/MobileBuilder';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import { useCatalogue } from '@lib/useStorefrontData';

/* Phone card: name · price up top, one-line pitch, savings, and two 44px
   actions. The included-services list lives in a sheet, not inline, so cards
   stay a fixed, scannable height. */
function PackageCard({ pkg, individualTotal, count, onDetails, onAdd }) {
  return (
    <div
      className={`relative rounded-2xl border bg-white p-4 ${
        pkg.popular ? 'border-fox-500 ring-1 ring-fox-500/30' : 'border-warm-200'
      }`}
    >
      {pkg.popular && (
        <span className="badge-fx badge-fox absolute -top-2.5 left-4 px-3 py-0.5 text-[11px]">
          Most Popular
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[17px] font-semibold leading-snug text-warm-900">{pkg.name}</h3>
        <div className="shrink-0 text-right">
          <p className="price-tag text-xl leading-tight text-warm-900">
            {formatINRRounded(pkg.price)}
          </p>
          <p className="text-xs text-warm-400 line-through">{formatINRRounded(individualTotal)}</p>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-warm-500">
        {pkg.description}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="badge-fx badge-success">Save {formatINRRounded(pkg.savings)}</span>
        <span className="text-xs text-warm-500">{count} services · + 18% GST</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDetails}
          className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-warm-200 text-sm font-semibold text-warm-700 active:bg-warm-50"
        >
          Details <ChevronRight size={16} />
        </button>
        <Button variant="primary" className="flex-1" onClick={onAdd}>
          <ShoppingCart size={16} /> Add
        </Button>
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
        <div className="space-y-5 pt-2">
          {packages.map((pkg) => {
            const r = resolve(pkg);
            return (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                individualTotal={r.individualTotal}
                count={r.items.length}
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

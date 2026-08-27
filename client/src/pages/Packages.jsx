import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, ShoppingCart } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { formatINR } from '@lib/utils';
import { Section, SectionHeading, Button, Spinner } from '@components/ui/Primitives';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import { useCatalogue } from '@lib/useStorefrontData';

export default function Packages() {
  usePageTitle('Packages');
  const { services, packages, loading } = useCatalogue();
  const serviceMap = services.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});
  const [expanded, setExpanded] = useState(null);
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  if (loading) return <Section><div className="flex justify-center py-20"><Spinner size="lg" /></div></Section>;

  const handleAddPackage = (pkg) => {
    addItem({ itemId: pkg.id, itemType: 'package', name: pkg.name, price: pkg.price }, isAuthenticated);
  };

  return (
    <Section>
      <SectionHeading label="Packages" title="Pre-built packages, better value" description="Curated bundles that save you 15–30% compared to picking services individually." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => {
          const resolvedItems = pkg.items.map((id) => serviceMap[id]).filter(Boolean);
          const individualTotal = resolvedItems.reduce((sum, s) => sum + s.price, 0);
          const isExpanded = expanded === pkg.id;

          return (
            <div key={pkg.id} className={`card-fx-elevated flex flex-col ${pkg.popular ? 'ring-2 ring-fox-500 relative' : ''}`}>
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
                    <span className="text-3xl font-bold font-mono text-warm-900">{formatINR(pkg.price)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-warm-400 line-through">{formatINR(individualTotal)}</span>
                    <span className="badge-fx badge-success">Save {formatINR(pkg.savings)}</span>
                  </div>
                  <p className="text-[10px] text-warm-400 mt-1">+ 18% GST</p>
                </div>

                <div className="mb-5">
                  <button onClick={() => setExpanded(isExpanded ? null : pkg.id)} className="text-sm text-fox-500 font-medium hover:underline mb-2">
                    {isExpanded ? 'Hide' : 'Show'} {resolvedItems.length} included services
                  </button>
                  {isExpanded && (
                    <ul className="space-y-1.5 animate-fade-in">
                      {resolvedItems.map((s) => (
                        <li key={s.id} className="flex items-start gap-2 text-xs text-warm-600">
                          <Check size={14} className="text-success-500 shrink-0 mt-0.5" />
                          <span>{s.name} <span className="text-warm-400">({formatINR(s.price)})</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-auto flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={() => handleAddPackage(pkg)}>
                    <ShoppingCart size={16} /> Add to Cart
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-12">
        <p className="text-warm-500 mb-4">Need something custom? Pick individual services instead.</p>
        <Link to="/builder" className="btn-outline px-8">Open Service Builder <ArrowRight size={16} /></Link>
      </div>
    </Section>
  );
}

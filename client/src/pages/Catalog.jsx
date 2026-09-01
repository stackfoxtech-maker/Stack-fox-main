import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, X, ArrowRight } from 'lucide-react';
import { usePageTitle, useDebounce } from '@lib/hooks';
import { cn, formatINR } from '@lib/utils';
import { Section, SectionHeading, Button, Spinner } from '@components/ui/Primitives';
import { useCatalogue } from '@lib/useStorefrontData';
import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 24;

export default function Catalog() {
  usePageTitle('All Services');
  const { services, categories, loading, error } = useCatalogue();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [page, setPage] = useState(1);
  const q = useDebounce(search, 200);
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const filtered = useMemo(() => {
    let result = services;
    if (activeCat !== 'all') result = result.filter((s) => s.catId === activeCat);
    if (priceRange === 'under10k') result = result.filter((s) => s.price < 10000);
    else if (priceRange === '10k-25k') result = result.filter((s) => s.price >= 10000 && s.price <= 25000);
    else if (priceRange === '25k-50k') result = result.filter((s) => s.price >= 25000 && s.price <= 50000);
    else if (priceRange === 'above50k') result = result.filter((s) => s.price > 50000);
    if (q) {
      const lower = q.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(lower) || s.lay?.toLowerCase().includes(lower));
    }
    return result;
  }, [services, activeCat, priceRange, q]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <Section><div className="flex justify-center py-20"><Spinner size="lg" /></div></Section>;
  if (error) return <Section><p className="text-danger-600">Failed to load catalogue.</p></Section>;

  return (
    <Section>
      <SectionHeading label="Catalog" title="All services" description={`${services.length} services across ${categories.length} categories. All prices indicative.`} />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-20 space-y-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-fx pl-9 text-sm" />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-2">Category</h4>
              <div className="space-y-1">
                <button onClick={() => { setActiveCat('all'); setPage(1); }} className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', activeCat === 'all' ? 'bg-fox-50 text-fox-600 font-medium' : 'text-warm-600 hover:bg-warm-50')}>
                  All ({services.length})
                </button>
                {categories.map((cat) => {
                  const count = services.filter((s) => s.catId === cat.id).length;
                  return (
                    <button key={cat.id} onClick={() => { setActiveCat(cat.id); setPage(1); }} className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', activeCat === cat.id ? 'bg-fox-50 text-fox-600 font-medium' : 'text-warm-600 hover:bg-warm-50')}>
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-2">Price range</h4>
              <div className="space-y-1">
                {[['all', 'Any price'], ['under10k', 'Under 10K'], ['10k-25k', '10K – 25K'], ['25k-50k', '25K – 50K'], ['above50k', 'Above 50K']].map(([val, label]) => (
                  <button key={val} onClick={() => { setPriceRange(val); setPage(1); }} className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', priceRange === val ? 'bg-fox-50 text-fox-600 font-medium' : 'text-warm-600 hover:bg-warm-50')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          <p className="text-sm text-warm-500 mb-4">{filtered.length} results</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((svc) => (
              <div key={svc.id} className="card-fx p-4 flex flex-col">
                <span className="badge-fx badge-neutral text-[10px] self-start mb-2">
                  {categories.find((c) => c.id === svc.catId)?.name}
                </span>
                <h3 className="text-sm font-semibold text-warm-900 mb-1">{svc.name}</h3>
                {svc.lay && <p className="text-xs text-warm-500 line-clamp-2 mb-3">{svc.lay}</p>}
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-warm-100">
                  <span className="price-tag text-warm-900">{formatINR(svc.price)}</span>
                  <button 
                    onClick={() => addItem({ 
                      itemId: svc.id, 
                      itemType: 'service', 
                      name: svc.name, 
                      price: svc.price 
                    }, isAuthenticated)}
                    className="text-xs text-fox-500 font-bold hover:text-fox-700 flex items-center gap-1 group/btn"
                  >
                    Add to cart <ArrowRight size={12} className="group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={cn('w-9 h-9 rounded-lg text-sm font-medium transition-colors', page === i + 1 ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200')}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, ShoppingCart, Info, X, Plus, Check,
  Edit3, Sparkles, Share2, ArrowRight, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle, useDebounce } from '@lib/hooks';
import { cn } from '@lib/utils';
import { CURRENCIES, FBT_PAIRS } from '@lib/constants';

import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import useUiStore from '@store/uiStore';
import { Button, Section, SectionHeading } from '@components/ui/Primitives';
import { BrandLogo } from '@components/ui/BrandLogo';
import SF_DATA from '@data/stackfox-data.json';
import api from '@lib/api';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT: Guided Tour
   ───────────────────────────────────────────────────────────────────────────── */
function Tour({ steps, active, onComplete }) {
  const [step, setStep] = useState(0);

  if (!active || !steps || steps.length === 0) return null;

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-md shadow-2xl max-w-md w-full overflow-hidden border border-warm-200 animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">{current.icon}</span>
            <span className="text-xs font-bold text-warm-400 uppercase tracking-widest">Step {step + 1} of {steps.length}</span>
          </div>
          <h3 className="text-xl font-bold text-warm-900 mb-2">{current.title}</h3>
          <p className="text-warm-600 text-sm leading-relaxed mb-6">{current.description}</p>
          
          {current.tip && (
            <div className="bg-fox-50 border border-fox-100 rounded-xl p-3 flex gap-3 mb-6">
              <Sparkles size={18} className="text-fox-500 shrink-0" />
              <p className="text-xs text-fox-700 font-medium">{current.tip}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button 
              onClick={onComplete}
              className="text-xs font-medium text-warm-400 hover:text-warm-600 transition-colors"
            >
              Skip Tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                  Back
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : onComplete()}>
                {step === steps.length - 1 ? "Start Building" : "Next Step"} <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </div>
        <div className="h-1 bg-warm-100 w-full relative">
          <div 
            className="h-full bg-fox-500 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE: Builder
   ───────────────────────────────────────────────────────────────────────────── */
export default function Builder() {
  usePageTitle('Service Builder');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 1. Stores
  const { 
    items, addItem, removeItem, updateQuantity, toggleCart, itemCount, clearCart,
    curIdx, setCurIdx, setMetadata
  } = useCartStore();
  const { user, isAuthenticated, isAdmin } = useAuthStore();

  // 2. Local States
  const [activeCat, setActiveCat] = useState(params.get('category') || 'all');
  const [search, setSearch] = useState(params.get('q') || '');
  const [showTour, setShowTour] = useState(false);
  const [tourHintDismissed, setTourHintDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('fox_tour_seen') === 'true'
  );
  const dismissTourHint = () => { localStorage.setItem('fox_tour_seen', 'true'); setTourHintDismissed(true); };
  const [catalog, setCatalog] = useState({ services: [], categories: [], packages: [], bundles: [] });
  const [isLoading, setIsLoading] = useState(true);
  

  // Category chip rail: horizontal scroll controls
  const catRailRef = useRef(null);
  const [railScroll, setRailScroll] = useState({ left: false, right: false });

  // 3. Derived State & Memos
  const debouncedSearch = useDebounce(search, 200);
  const cur = CURRENCIES[curIdx];

  const fmt = (n) => {
    const converted = Math.round(Number(n) * (cur?.rate || 1));
    return (cur?.symbol || '$') + converted.toLocaleString(cur?.locale || 'en-US');
  };

  // 4. Effects
  // URL Sync
  useEffect(() => {
    const newParams = new URLSearchParams(params);
    if (activeCat !== 'all') newParams.set('category', activeCat);
    else newParams.delete('category');
    
    if (debouncedSearch) newParams.set('q', debouncedSearch);
    else newParams.delete('q');
    
    setParams(newParams, { replace: true });
  }, [activeCat, debouncedSearch, setParams]);

  // Category rail: track how far it can still scroll, so the arrows only
  // show on the side that actually has more chips off-screen.
  const syncRailScroll = () => {
    const el = catRailRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setRailScroll({
      left: el.scrollLeft > 4,
      right: max > 4 && el.scrollLeft < max - 4,
    });
  };

  const scrollRail = (dir) => {
    const el = catRailRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  useEffect(() => {
    syncRailScroll();
    window.addEventListener('resize', syncRailScroll);
    return () => window.removeEventListener('resize', syncRailScroll);
  }, [catalog.categories.length, isLoading]);

  // Initialization: Load catalog data.
  //
  // This intentionally reads the local catalog file, not a live endpoint.
  // The backend's /catalog/* routes serve a different, incompatible dataset
  // (a generic SDP service-unit table, priced in paise, with no consumer
  // copy) — mapping that onto this storefront's friendly package catalog is
  // a real content/schema project, not something to fake via a fetch that
  // happens to 500 into a fallback. See PR/commit notes for the follow-up.
  useEffect(() => {
    const fetchData = async () => {
      setCatalog({
        services: SF_DATA.services.map(s => ({ ...s, dataId: s.id })),
        categories: SF_DATA.categories.map(c => ({ ...c, dataId: c.id })),
        packages: (SF_DATA.packages || []).map(p => ({ ...p, dataId: p.id })),
        bundles: (SF_DATA.industryBundles || []).map(b => ({ ...b, dataId: b.id }))
      });
      setIsLoading(false);
    };

    fetchData();

    // Tour is opt-in via the dismissible hint bar — auto-popping a full-screen
    // modal over the builder blocked the task on every first visit.

    const cartParam = params.get('cart');
    if (cartParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(cartParam))));
        if (Array.isArray(decoded) && decoded.length > 0) {
          clearCart();
          decoded.forEach(item => addItem(item, isAuthenticated));
          params.delete('cart');
          setParams(params);
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  // Handle Scroll to Item from Search
  useEffect(() => {
    const itemId = params.get('item');
    if (itemId && !isLoading && catalog.services.length > 0) {
      const svc = catalog.services.find(s => s.id === itemId);
      if (svc) {
        // Ensure category doesn't filter it out
        if (activeCat !== 'all' && activeCat !== svc.catId) {
          setActiveCat('all');
        }
        
        setTimeout(() => {
          const element = document.getElementById(`service-${itemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-fox-500/30', 'ring-offset-8', 'transition-all', 'duration-700');
            toast.success(`Selected: ${svc.name}`, { icon: '🎯', position: 'bottom-center' });
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-fox-500/30', 'ring-offset-8');
            }, 4000);
          }
        }, 600);
      }
    }
  }, [params, isLoading, catalog.services]);

  // Filter Logic
  const filteredServices = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    
    // Virtual Categories logic
    if (activeCat === 'industry-bundles') {
       return catalog.bundles.filter(b => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q));
    }
    if (activeCat === 'service-packages') {
       return catalog.packages.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }

    let result = catalog.services;
    if (activeCat !== 'all') {
      result = result.filter((s) => s.catId === activeCat);
    }
    if (debouncedSearch) {
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.lay?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCat, debouncedSearch, catalog]);

  const cartItemIds = useMemo(() => new Set(items.map((i) => i.itemId)), [items]);

  // Warnings & ROI
  const cartWarnings = useMemo(() => {
    if (items.length === 0 || catalog.services.length === 0) return [];
    const warns = [];
    items.forEach(c => {
      const svc = catalog.services.find(s => s.id === c.itemId);
      if (!svc) return;
      (svc.conflicts || []).forEach(cid => {
        if (cartItemIds.has(cid)) {
          const other = catalog.services.find(s => s.id === cid);
          warns.push({ type: "conflict", id: svc.id, otherId: cid, msg: `${svc.name} conflicts with ${other?.name || cid}` });
        }
      });
      (svc.requires || []).forEach(rid => {
        if (!cartItemIds.has(rid)) {
          const dep = catalog.services.find(s => s.id === rid);
          warns.push({ type: "requires", id: svc.id, otherId: rid, msg: `${svc.name} requires ${dep?.name || rid}` });
        }
      });
    });
    const seen = new Set();
    return warns.filter(w => {
      const key = w.type === "conflict" ? [w.id, w.otherId].sort().join("-") : w.id + "-" + w.otherId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items, catalog, cartItemIds]);

  const cartRoi = useMemo(() => {
    return items
      .map(i => catalog.services.find(s => s.id === i.itemId))
      .filter(s => s && s.roi)
      .map(s => ({ ...s.roi, n: s.name, id: s.id }));
  }, [items, catalog]);

  useEffect(() => {
    setMetadata({ warnings: cartWarnings, roiItems: cartRoi });
  }, [cartWarnings, cartRoi, setMetadata]);

  const suggestions = useMemo(() => {
    if (items.length === 0 || catalog.services.length === 0) return [];
    const suggestedIds = new Set();
    items.forEach(i => {
      (FBT_PAIRS[i.itemId] || []).forEach(rid => {
        if (!cartItemIds.has(rid)) suggestedIds.add(rid);
      });
    });
    if (suggestedIds.size === 0) {
      const activeCatIds = [...new Set(items.map(i => catalog.services.find(s => s.id === i.itemId)?.catId))];
      return catalog.services.filter(s => !cartItemIds.has(s.id) && s.catId && !activeCatIds.includes(s.catId)).slice(0, 3);
    }
    return Array.from(suggestedIds).map(id => catalog.services.find(s => s.id === id)).filter(Boolean).slice(0, 3);
  }, [items, catalog, cartItemIds]);

  // Handlers
  const handleAdd = (svc) => {
    addItem({ itemId: svc.id, itemType: 'service', name: svc.name, price: svc.price }, isAuthenticated);
  };

  const handleShare = () => {
    if (items.length === 0) { toast.error('Cart is empty'); return; }
    try {
      const cartString = btoa(unescape(encodeURIComponent(JSON.stringify(items))));
      const shareUrl = `${window.location.origin}${window.location.pathname}?cart=${cartString}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch (e) { toast.error('Failed to generate link'); }
  };

  return (
    <Section className="relative">
      <Tour steps={SF_DATA.tourSteps} active={showTour} onComplete={() => { dismissTourHint(); setShowTour(false); }} />

      {!tourHintDismissed && !showTour && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fox-200 bg-fox-50 px-4 py-3">
          <p className="text-sm text-warm-700">
            New here? Pick exactly the services you need and watch your total update live.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setShowTour(true)}>
              Take a 60-second tour <ArrowRight size={14} />
            </Button>
            <button
              onClick={dismissTourHint}
              className="rounded-lg px-3 py-2 text-sm font-medium text-warm-500 hover:bg-warm-100 hover:text-warm-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/*
        Catalogue editing lives in the admin app (/app/admin/catalog), which is
        wired to the real /admin/* endpoints. The old inline editor here spoke
        to /admin/catalog/* routes that never existed and was gated on a role
        string ("admin") the API never emits ("ADMIN"), so it was unreachable
        and non-functional. Admins get a shortcut to the real editor instead.
      */}
      {isAuthenticated && isAdmin() && (
        <div className="fixed top-24 right-4 z-40">
          <Link
            to="/app/admin/catalog"
            className="flex items-center gap-2 bg-white border border-warm-200 px-3 py-2 rounded-xl shadow-sm text-xs font-semibold text-warm-600 hover:text-fox-600"
          >
            <Edit3 size={15} /> Edit catalogue
          </Link>
        </div>
      )}

      <SectionHeading
        label="Build & Price"
        title="Service Builder"
        description="Browse and select services."
      />

      {/* Search Bar */}
      <div className="max-w-4xl mx-auto mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-fx pl-11 pr-4"
          />
        </div>
        
        <div className="flex gap-2 shrink-0">
          <select value={curIdx} onChange={(e) => setCurIdx(Number(e.target.value))} className="bg-white border border-warm-200 rounded-xl px-2 text-xs font-bold">
            {CURRENCIES.map((c, i) => <option key={c.code} value={i}>{c.code}</option>)}
          </select>
          <Button variant="ghost" onClick={handleShare}><Share2 size={16} /></Button>
          {itemCount > 0 && (
            <Button variant="primary" onClick={toggleCart}><ShoppingCart size={16} /> {itemCount}</Button>
          )}
        </div>
      </div>

      {/* Category Chips */}
      <div className="relative mb-8">
        {/* Left scroll control */}
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 bottom-6 z-10 flex items-center pr-10 transition-opacity duration-200',
            'bg-gradient-to-r from-warm-white via-warm-white/90 to-transparent',
            railScroll.left ? 'opacity-100' : 'opacity-0'
          )}
        >
          <button
            type="button"
            aria-label="Scroll categories left"
            tabIndex={railScroll.left ? 0 : -1}
            onClick={() => scrollRail(-1)}
            className={cn(
              'grid place-items-center h-10 w-10 rounded-full bg-white text-warm-600 shadow-md border border-warm-200',
              'hover:text-warm-900 hover:border-warm-300 active:scale-95 transition-all',
              railScroll.left && 'pointer-events-auto'
            )}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Right scroll control */}
        <div
          className={cn(
            'pointer-events-none absolute right-0 top-0 bottom-6 z-10 flex items-center pl-10 transition-opacity duration-200',
            'bg-gradient-to-l from-warm-white via-warm-white/90 to-transparent',
            railScroll.right ? 'opacity-100' : 'opacity-0'
          )}
        >
          <button
            type="button"
            aria-label="Scroll categories right"
            tabIndex={railScroll.right ? 0 : -1}
            onClick={() => scrollRail(1)}
            className={cn(
              'grid place-items-center h-10 w-10 rounded-full bg-white text-warm-600 shadow-md border border-warm-200',
              'hover:text-warm-900 hover:border-warm-300 active:scale-95 transition-all',
              railScroll.right && 'pointer-events-auto'
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div ref={catRailRef} onScroll={syncRailScroll} className="flex gap-3 overflow-x-auto pb-6 hide-scrollbar scroll-smooth">
        <button
          onClick={() => setActiveCat('all')}
          className={cn(
            'px-5 py-2.5 rounded-md text-sm font-semibold transition-all shrink-0',
            activeCat === 'all' ? 'bg-warm-900 text-white' : 'bg-white text-warm-600 border border-warm-200 hover:border-warm-300'
          )}
        >
          All Services <span className="opacity-50 ml-1">({catalog.services.length})</span>
        </button>
        <button
          onClick={() => setActiveCat('industry-bundles')}
          className={cn(
            'px-5 py-2.5 rounded-md text-sm font-semibold transition-all shrink-0 whitespace-nowrap',
            activeCat === 'industry-bundles' ? 'bg-fox-500 text-white ring-4 ring-fox-50' : 'bg-white text-warm-600 border border-warm-200 hover:border-warm-300'
          )}
        >
          Special Bundles <span className="opacity-50 ml-1">({catalog.bundles.length})</span>
        </button>
        <button
          onClick={() => setActiveCat('service-packages')}
          className={cn(
            'px-5 py-2.5 rounded-md text-sm font-semibold transition-all shrink-0 whitespace-nowrap',
            activeCat === 'service-packages' ? 'bg-fox-500 text-white ring-4 ring-fox-50' : 'bg-white text-warm-600 border border-warm-200 hover:border-warm-300'
          )}
        >
          Packages <span className="opacity-50 ml-1">({catalog.packages.length})</span>
        </button>
        <div className="w-px h-8 bg-warm-100 mx-2 shrink-0" />
        {catalog.categories.map((cat) => (
          <button
            key={cat.dataId}
            onClick={() => setActiveCat(cat.dataId)}
            className={cn(
              'px-5 py-2.5 rounded-md text-sm font-semibold transition-all shrink-0 whitespace-nowrap',
              activeCat === cat.dataId ? 'bg-fox-500 text-white ring-4 ring-fox-50' : 'bg-white text-warm-600 border border-warm-200 hover:border-warm-300'
            )}
          >
            {cat.name} <span className="opacity-50 ml-1">({catalog.services.filter(s => s.catId === cat.dataId).length})</span>
          </button>
        ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-12">
          {isLoading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-lg p-5 h-40 animate-pulse border border-warm-100" />)}
             </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg border border-warm-100">
               <p className="text-warm-500">No services found.</p>
               <Button variant="ghost" className="mt-4" onClick={() => { setSearch(''); setActiveCat('all'); }}>Reset</Button>
            </div>
          ) : (
            <div className="space-y-16">
              {activeCat === 'industry-bundles' && (
                <div className="space-y-6">
                   <h2 className="text-2xl font-semibold text-warm-900">Industry-Specific Bundles</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {filteredServices.map(b => (
                       <div key={b.id} className="card-fx p-6 bg-white border border-warm-200 rounded-lg relative">
                          <h3 className="text-lg font-bold text-warm-900">{b.name}</h3>
                          <p className="text-sm text-warm-500 mt-2 line-clamp-2 leading-relaxed">{b.description}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xl font-semibold">{fmt(b.price)}</span>
                            <Button size="sm" variant="outline" onClick={() => (b.items || []).forEach(id => {
                              const svc = catalog.services.find(s => s.id === id);
                              if (svc) addItem({ itemId: id, itemType: 'service', name: svc.name, price: svc.price }, isAuthenticated);
                            })}>Select All</Button>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>
              )}
              {activeCat === 'service-packages' && (
                <div className="space-y-6">
                   <h2 className="text-2xl font-semibold text-warm-900">Recommended Packages</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {filteredServices.map(p => (
                       <div key={p.id} className="card-fx p-6 bg-white border border-warm-200 rounded-lg relative">
                          <h3 className="text-lg font-bold text-warm-900">{p.name}</h3>
                          <p className="text-sm text-warm-500 mt-2 leading-relaxed">{p.description}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xl font-semibold">{fmt(p.price)}</span>
                            <Button size="sm" variant="outline" onClick={() => (p.items || []).forEach(id => {
                              const svc = catalog.services.find(s => s.id === id);
                              if (svc) addItem({ itemId: id, itemType: 'service', name: svc.name, price: svc.price }, isAuthenticated);
                            })}>Add to Cart</Button>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {(activeCat !== 'industry-bundles' && activeCat !== 'service-packages') && 
               (activeCat === 'all' ? catalog.categories : catalog.categories.filter(c => c.dataId === activeCat)).map(cat => {
                const catServices = filteredServices.filter(s => s.catId === cat.dataId);
                if (catServices.length === 0) return null;

                return (
                  <div key={cat.dataId} className="space-y-6">
                    <div className="border-b border-warm-100 pb-4">
                      <div className="flex items-center justify-between">
                         <h2 className="text-2xl font-semibold text-warm-900 flex items-center gap-2">
                           {cat.name}
                           <span className="text-[10px] bg-warm-100 text-warm-500 px-2 py-0.5 rounded-full">{catServices.length} items</span>
                         </h2>
                      </div>
                      {cat.laymanTip && (
                        <p className="text-warm-500 text-sm mt-1 italic">“{cat.laymanTip}”</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catServices.map(svc => {
                        const isInCart = cartItemIds.has(svc.id);
                        return (
                          <div
                            key={svc.id}
                            id={`service-${svc.id}`}
                            className={cn(
                              'flex min-h-[150px] flex-col rounded-md border bg-white p-5 transition-colors duration-short',
                              isInCart ? 'border-sage-300 bg-sage-50/40' : 'border-warm-200 hover:border-warm-300'
                            )}
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <span className="block text-body-md font-semibold text-warm-900">{svc.name}</span>
                                <span className="mt-1 block text-caption font-medium uppercase tracking-wide text-warm-400">{svc.estimatedTime || '3-5 days'}</span>
                              </div>
                              <div className="text-right">
                                <span className="price-tag block text-body-lg text-warm-900">{fmt(svc.price)}</span>
                                <p className="text-caption uppercase tracking-wide text-warm-400">Starting</p>
                              </div>
                            </div>

                            <p className="mb-4 flex-1 text-body-sm leading-relaxed text-warm-500">{svc.lay || 'A single, individually priced piece of your build.'}</p>

                            <div className="flex items-center justify-between gap-2 border-t border-warm-100 pt-3">
                               <span className="text-caption font-medium uppercase tracking-wide text-warm-400">{svc.unit || 'Standard'}</span>
                               <button
                                 onClick={() => !isInCart && handleAdd(svc)}
                                 aria-label={isInCart ? 'Added' : `Add ${svc.name}`}
                                 className={cn(
                                   'grid h-8 w-8 place-items-center rounded-sm transition-colors',
                                   isInCart ? 'bg-sage-100 text-sage-700' : 'bg-fox-50 text-fox-600 hover:bg-fox-500 hover:text-white'
                                 )}
                               >
                                 {isInCart ? <Check size={15} /> : <Plus size={15} />}
                               </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-warm-200 bg-white p-6">
               <h3 className="mb-4 flex items-center gap-2 text-title text-warm-900"><Sparkles size={16} className="text-fox-500" /> Often added together</h3>
               <div className="space-y-2">
                 {suggestions.map(s => (
                   <button key={s.id} onClick={() => handleAdd(s)} className="flex w-full items-center justify-between gap-2 rounded-sm border border-warm-200 bg-warm-white px-3 py-2.5 text-left transition-colors hover:border-fox-300">
                     <span className="truncate text-body-sm font-medium text-warm-800">{s.name}</span>
                     <Plus size={14} className="shrink-0 text-fox-500" />
                   </button>
                 ))}
               </div>
            </div>
          )}
           <Link to="/advisor" className="group block rounded-lg border border-sage-200 bg-sage-50 p-6 transition-transform duration-short hover:-translate-y-0.5">
             <div className="mb-2 flex items-center gap-2 text-title text-sage-800">
               <Sparkles className="h-5 w-5 text-sage-600" />
               Not sure what you need?
             </div>
             <p className="max-w-sm text-body-sm leading-relaxed text-sage-800/90">
               Answer 10 quick questions and our advisor suggests a configuration for your project.
             </p>
             <span className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-sage-800">
               Start advisor <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
             </span>
           </Link>
          <div className="rounded-lg border border-warm-200 bg-white p-6">
            <h3 className="text-title text-warm-900 mb-4">How building works</h3>
            <div className="space-y-4">
               {[
                  'Browse 240+ services and pick exactly what your project needs.',
                  'Watch your indicative quote update as you add or remove pieces.',
                  'Submit your cart to get a detailed proposal within 24 hours.',
               ].map((text, i) => (
                 <div key={i} className="flex gap-3">
                   <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-sage-50 font-mono text-[11px] text-sage-700">{i + 1}</span>
                   <p className="text-body-sm leading-relaxed text-warm-600">{text}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden">
          <div className="bg-fox-600 text-white rounded-lg p-4 flex items-center justify-between" onClick={toggleCart}>
            <div className="flex items-center gap-3">
              <ShoppingCart size={24} />
              <div className="font-bold">{itemCount} items Selected</div>
            </div>
            <div className="font-semibold text-lg">→</div>
          </div>
        </div>
      )}
    </Section>
  );
}

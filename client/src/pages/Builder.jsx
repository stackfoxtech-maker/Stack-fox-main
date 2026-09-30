import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Plus,
  Check,
  Edit3,
  Sparkles,
  Share2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePageTitle, useDebounce, useMediaQuery } from '@lib/hooks';
import { cn } from '@lib/utils';
import { CURRENCIES, FBT_PAIRS } from '@lib/constants';

import useCartStore from '@store/cartStore';
import useAuthStore from '@store/authStore';
import { Button, Section } from '@components/ui/Primitives';
import SF_DATA from '@data/stackfox-data.json';
import {
  ServiceRow,
  ServiceSheet,
  CartBar,
  SuggestionStrip,
} from '@components/builder/MobileBuilder';
import { PlanPanel, QuickStart, SortBar, categoryIcon } from '@components/builder/BuilderExtras';
import { DrawnUnderline, SpotlightGlow, spotlightProps } from '@components/home/HomeMotion';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT: Guided Tour
   ───────────────────────────────────────────────────────────────────────────── */
function Tour({ steps, active, onComplete }) {
  const [step, setStep] = useState(0);

  if (!active || !steps || steps.length === 0) return null;

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-warm-900/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="w-full max-w-md animate-slide-up overflow-hidden rounded-t-3xl border border-warm-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:animate-scale-in sm:rounded-md sm:pb-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">{current.icon}</span>
            <span className="text-xs font-bold text-warm-400 uppercase tracking-widest">
              Step {step + 1} of {steps.length}
            </span>
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
              className="min-h-11 px-1 text-xs font-medium text-warm-400 transition-colors hover:text-warm-600"
            >
              Skip Tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => (step < steps.length - 1 ? setStep((s) => s + 1) : onComplete())}
              >
                {step === steps.length - 1 ? 'Start Building' : 'Next Step'}{' '}
                <ArrowRight size={14} />
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
   Service card — memoised so a debounced search keystroke (or any cart change)
   doesn't re-render every card in the list. Only re-renders when this card's
   own props change.
   ───────────────────────────────────────────────────────────────────────────── */
const PREVIEW_COUNT = 6; // cards shown per category in the "All" overview

/* Compact 3-up tile on phones (name · price · add), the fuller card from
   sm: up (adds the plain-language blurb, timing, and unit meta). */
const ServiceCard = memo(function ServiceCard({ svc, price, inCart, onAdd, Icon }) {
  return (
    <motion.div
      id={`service-${svc.id}`}
      {...spotlightProps}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-colors duration-short sm:min-h-[172px] sm:p-5',
        inCart ? 'border-sage-300 bg-sage-50/40' : 'border-warm-200 hover:border-fox-300',
      )}
    >
      <SpotlightGlow />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-medium group-hover:-rotate-6 group-hover:scale-105',
            inCart ? 'bg-sage-100 text-sage-700' : 'bg-fox-50 text-fox-600',
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-body-md font-semibold leading-snug text-warm-900">
            {svc.name}
          </h3>
          <span className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-warm-500">
            <Clock size={11} /> {svc.estimatedTime || svc.est || '3-5 days'}
          </span>
        </div>
      </div>

      <p className="relative mt-3 line-clamp-2 flex-1 text-body-sm leading-relaxed text-warm-600">
        {svc.lay || 'A single, individually priced piece of your build.'}
      </p>

      <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-warm-100 pt-3">
        <div>
          <span className="text-caption font-medium uppercase tracking-wide text-warm-400">
            From{' '}
          </span>
          <span className="price-tag text-body-lg text-warm-900">{price}</span>
        </div>
        <motion.button
          type="button"
          onClick={() => !inCart && onAdd(svc)}
          whileTap={{ scale: 0.92 }}
          aria-label={inCart ? `${svc.name} is in your plan` : `Add ${svc.name}`}
          className={cn(
            'inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors',
            inCart
              ? 'bg-sage-100 text-sage-700'
              : 'bg-fox-500 text-white shadow-sm shadow-fox-500/30 hover:bg-fox-600',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={inCart ? 'in' : 'out'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-1.5"
            >
              {inCart ? (
                <>
                  <Check size={14} strokeWidth={3} /> Added
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={3} /> Add
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE: Builder
   ───────────────────────────────────────────────────────────────────────────── */
export default function Builder() {
  usePageTitle('Service Builder');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // 1. Stores
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    toggleCart,
    itemCount,
    clearCart,
    curIdx,
    setCurIdx,
    setMetadata,
    subtotal: cartSubtotal,
  } = useCartStore();
  const { user, isAuthenticated, isAdmin } = useAuthStore();

  // 2. Local States
  const [activeCat, setActiveCat] = useState(params.get('category') || 'all');
  const [search, setSearch] = useState(params.get('q') || '');
  const [showTour, setShowTour] = useState(false);
  const [sort, setSort] = useState('popular');
  const [cheap, setCheap] = useState(false);
  const [tourHintDismissed, setTourHintDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('fox_tour_seen') === 'true',
  );
  const dismissTourHint = () => {
    localStorage.setItem('fox_tour_seen', 'true');
    setTourHintDismissed(true);
  };
  const [catalog, setCatalog] = useState({
    services: [],
    categories: [],
    packages: [],
    bundles: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [sheetSvc, setSheetSvc] = useState(null);
  const resultsRef = useRef(null);
  const firstCat = useRef(true);

  // Category chip rail: horizontal scroll controls
  const catRailRef = useRef(null);
  const [railScroll, setRailScroll] = useState({ left: false, right: false });

  // 3. Derived State & Memos
  const debouncedSearch = useDebounce(search, 200);
  const cur = CURRENCIES[curIdx];

  const fmt = useCallback(
    (n) => {
      const converted = Math.round(Number(n) * (cur?.rate || 1));
      return (cur?.symbol || '$') + converted.toLocaleString(cur?.locale || 'en-US');
    },
    [cur],
  );

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

  // Phones: centre the active chip in the rail, and if the list is scrolled
  // past the top, jump back to the start of the new category's results.
  useEffect(() => {
    const rail = catRailRef.current;
    const chip = rail?.querySelector(`[data-chip="${activeCat}"]`);
    if (rail && chip) {
      rail.scrollTo({
        left: chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2,
        behavior: 'smooth',
      });
    }
    if (firstCat.current) {
      firstCat.current = false;
      return;
    }
    const el = resultsRef.current;
    if (el && el.getBoundingClientRect().top < 180) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeCat]);

  // Lets the FoxBot fab lift itself above the phone cart bar.
  useEffect(() => {
    document.body.classList.toggle('has-cartbar', itemCount > 0);
    return () => document.body.classList.remove('has-cartbar');
  }, [itemCount]);

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
        services: SF_DATA.services.map((s) => ({ ...s, dataId: s.id })),
        categories: SF_DATA.categories.map((c) => ({ ...c, dataId: c.id })),
        packages: (SF_DATA.packages || []).map((p) => ({ ...p, dataId: p.id })),
        bundles: (SF_DATA.industryBundles || []).map((b) => ({ ...b, dataId: b.id })),
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
          decoded.forEach((item) => addItem(item, isAuthenticated));
          params.delete('cart');
          setParams(params);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Handle Scroll to Item from Search
  useEffect(() => {
    const itemId = params.get('item');
    if (itemId && !isLoading && catalog.services.length > 0) {
      const svc = catalog.services.find((s) => s.id === itemId);
      if (svc) {
        // Ensure category doesn't filter it out
        if (activeCat !== 'all' && activeCat !== svc.catId) {
          setActiveCat('all');
        }

        setTimeout(() => {
          const element = document.getElementById(`service-${itemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add(
              'ring-4',
              'ring-fox-500/30',
              'ring-offset-8',
              'transition-all',
              'duration-700',
            );
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
      return catalog.bundles.filter(
        (b) => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q),
      );
    }
    if (activeCat === 'service-packages') {
      return catalog.packages.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
      );
    }

    let result = catalog.services;
    if (activeCat !== 'all') {
      result = result.filter((s) => s.catId === activeCat);
    }
    if (debouncedSearch) {
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.lay?.toLowerCase().includes(q),
      );
    }
    if (cheap) result = result.filter((sv) => sv.price < 10000);
    if (sort !== 'popular') {
      const days = (e) => {
        const m = String(e || '').match(/\d+/);
        return m ? Number(m[0]) : 99;
      };
      result = [...result].sort((x, y) =>
        sort === 'low'
          ? x.price - y.price
          : sort === 'high'
            ? y.price - x.price
            : days(x.est) - days(y.est) || x.price - y.price,
      );
    }
    return result;
  }, [activeCat, debouncedSearch, catalog, cheap, sort]);

  const cartItemIds = useMemo(() => new Set(items.map((i) => i.itemId)), [items]);

  // Group the (filtered) services by category once per change, instead of
  // running `filteredServices.filter(catId)` 13× inside the render map.
  const servicesByCat = useMemo(() => {
    const m = new Map();
    for (const s of filteredServices) {
      const arr = m.get(s.catId);
      if (arr) arr.push(s);
      else m.set(s.catId, [s]);
    }
    return m;
  }, [filteredServices]);

  // Total count per category (unfiltered) — for the chip-rail badges.
  const catCounts = useMemo(() => {
    const m = new Map();
    for (const s of catalog.services) m.set(s.catId, (m.get(s.catId) || 0) + 1);
    return m;
  }, [catalog.services]);

  // Warnings & ROI
  const cartWarnings = useMemo(() => {
    if (items.length === 0 || catalog.services.length === 0) return [];
    const warns = [];
    items.forEach((c) => {
      const svc = catalog.services.find((s) => s.id === c.itemId);
      if (!svc) return;
      (svc.conflicts || []).forEach((cid) => {
        if (cartItemIds.has(cid)) {
          const other = catalog.services.find((s) => s.id === cid);
          warns.push({
            type: 'conflict',
            id: svc.id,
            otherId: cid,
            msg: `${svc.name} conflicts with ${other?.name || cid}`,
          });
        }
      });
      (svc.requires || []).forEach((rid) => {
        if (!cartItemIds.has(rid)) {
          const dep = catalog.services.find((s) => s.id === rid);
          warns.push({
            type: 'requires',
            id: svc.id,
            otherId: rid,
            msg: `${svc.name} requires ${dep?.name || rid}`,
          });
        }
      });
    });
    const seen = new Set();
    return warns.filter((w) => {
      const key =
        w.type === 'conflict' ? [w.id, w.otherId].sort().join('-') : w.id + '-' + w.otherId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items, catalog, cartItemIds]);

  const cartRoi = useMemo(() => {
    return items
      .map((i) => catalog.services.find((s) => s.id === i.itemId))
      .filter((s) => s && s.roi)
      .map((s) => ({ ...s.roi, n: s.name, id: s.id }));
  }, [items, catalog]);

  useEffect(() => {
    setMetadata({ warnings: cartWarnings, roiItems: cartRoi });
  }, [cartWarnings, cartRoi, setMetadata]);

  const suggestions = useMemo(() => {
    if (items.length === 0 || catalog.services.length === 0) return [];
    const suggestedIds = new Set();
    items.forEach((i) => {
      (FBT_PAIRS[i.itemId] || []).forEach((rid) => {
        if (!cartItemIds.has(rid)) suggestedIds.add(rid);
      });
    });
    if (suggestedIds.size === 0) {
      const activeCatIds = [
        ...new Set(items.map((i) => catalog.services.find((s) => s.id === i.itemId)?.catId)),
      ];
      return catalog.services
        .filter((s) => !cartItemIds.has(s.id) && s.catId && !activeCatIds.includes(s.catId))
        .slice(0, 3);
    }
    return Array.from(suggestedIds)
      .map((id) => catalog.services.find((s) => s.id === id))
      .filter(Boolean)
      .slice(0, 3);
  }, [items, catalog, cartItemIds]);

  // Handlers. On phones adds are silent (no drawer pop-up, no toast) so a
  // person can add several pieces in a row; the CartBar shows the result.
  const handleAdd = useCallback(
    (svc) => {
      addItem(
        { itemId: svc.id, itemType: 'service', name: svc.name, price: svc.price, silent: isMobile },
        isAuthenticated,
      );
    },
    [addItem, isAuthenticated, isMobile],
  );

  // Phone rows toggle: tapping a piece already in the project removes it.
  const handleToggle = useCallback(
    (svc) => {
      const inCart = useCartStore.getState().items.find((i) => i.itemId === svc.id);
      if (inCart) removeItem(inCart._id, isAuthenticated);
      else handleAdd(svc);
    },
    [removeItem, isAuthenticated, handleAdd],
  );

  const addMany = (ids) => {
    let n = 0;
    (ids || []).forEach((id) => {
      const svc = catalog.services.find((s) => s.id === id);
      if (!svc) return;
      n += 1;
      handleAdd(svc);
    });
    if (isMobile && n) toast.success(`Added ${n} piece${n > 1 ? 's' : ''}`);
  };

  const cartTotalLabel = fmt(cartSubtotal || items.reduce((s, i) => s + i.price * i.quantity, 0));
  const chips = [
    { id: 'all', label: 'All Services', count: catalog.services.length },
    { id: 'industry-bundles', label: 'Special Bundles', count: catalog.bundles.length },
    { id: 'service-packages', label: 'Packages', count: catalog.packages.length },
    'divider',
    ...catalog.categories.map((c) => ({
      id: c.dataId,
      label: c.name,
      count: catCounts.get(c.dataId) || 0,
      Icon: categoryIcon(c.icon),
    })),
  ];
  const nameOf = (id) => catalog.services.find((s) => s.id === id)?.name || id;

  const handleShare = () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    try {
      const cartString = btoa(unescape(encodeURIComponent(JSON.stringify(items))));
      const shareUrl = `${window.location.origin}${window.location.pathname}?cart=${cartString}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch (e) {
      toast.error('Failed to generate link');
    }
  };

  return (
    <Section className="relative !pb-44 !pt-5 md:!pb-24 md:!pt-24">
      <Tour
        steps={SF_DATA.tourSteps}
        active={showTour}
        onComplete={() => {
          dismissTourHint();
          setShowTour(false);
        }}
      />

      {/*
        Catalogue editing lives in the admin app (/app/admin/catalog), which is
        wired to the real /admin/* endpoints. The old inline editor here spoke
        to /admin/catalog/* routes that never existed and was gated on a role
        string ("admin") the API never emits ("ADMIN"), so it was unreachable
        and non-functional. Admins get a shortcut to the real editor instead.
      */}
      {isAuthenticated && isAdmin() && (
        <div className="fixed right-4 top-24 z-40 hidden sm:block">
          <Link
            to="/app/admin/catalog"
            className="flex items-center gap-2 bg-white border border-warm-200 px-3 py-2 rounded-xl shadow-sm text-xs font-semibold text-warm-600 hover:text-fox-600"
          >
            <Edit3 size={15} /> Edit catalogue
          </Link>
        </div>
      )}

      {/* Hero: what this page is for, and one tap to start in the right part of the catalogue */}
      <div className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-warm-200 bg-gradient-to-br from-fox-50 via-white to-sage-50 p-5 md:mb-8 md:p-8">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fox-200/40 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 14, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-sage-200/40 blur-3xl"
          animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="max-w-xl">
              <span className="eyebrow mb-3 hidden md:inline-flex">Build &amp; price</span>
              <h1 className="text-[1.65rem] leading-tight text-warm-900 md:text-display-lg">
                Assemble your project,{' '}
                <span className="relative inline-block">
                  piece by piece
                  <DrawnUnderline delay={0.5} />
                </span>
              </h1>
              <p className="mt-3 hidden text-body-lg text-warm-600 md:block">
                {catalog.services.length}+ individually priced pieces across{' '}
                {catalog.categories.length} domains. Add what you need and watch the total update,
                GST and all.
              </p>
              <p className="mt-1.5 text-body-sm text-warm-600 md:hidden">
                {catalog.services.length}+ priced pieces. Add what you need, the total updates live.
              </p>
            </div>

            {/* Tablet: the running total (desktop has the full plan panel beside the list). */}
            {itemCount > 0 ? (
              <button
                onClick={toggleCart}
                className="hidden shrink-0 items-center gap-3 self-start rounded-2xl border border-warm-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md md:flex lg:hidden"
              >
                <ShoppingCart size={18} className="text-fox-600" />
                <span className="text-left">
                  <span className="block text-caption uppercase tracking-wide text-warm-500">
                    {itemCount} piece{itemCount > 1 ? 's' : ''}
                  </span>
                  <span className="price-tag block text-body-md text-warm-900">
                    {cartTotalLabel}
                  </span>
                </span>
                <ArrowRight size={15} className="text-warm-400" />
              </button>
            ) : !tourHintDismissed && !showTour ? (
              <div className="hidden w-full shrink-0 rounded-2xl border border-fox-200 bg-white/80 p-4 backdrop-blur md:block md:w-72">
                <p className="text-body-sm text-warm-700">
                  New here? A 60-second tour shows how to price your project.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={() => setShowTour(true)}>
                    Take the tour <ArrowRight size={14} />
                  </Button>
                  <button
                    onClick={dismissTourHint}
                    className="rounded-sm px-3 py-2 text-body-sm font-medium text-warm-500 transition-colors hover:bg-fox-100 hover:text-warm-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 md:mt-6">
            <QuickStart active={activeCat} onPick={setActiveCat} />
          </div>
        </div>
      </div>

      {/* Phone helper strip: one slim line instead of a tall card */}
      {!tourHintDismissed && !showTour && itemCount === 0 && (
        <div className="mb-3 flex items-center rounded-2xl bg-fox-50 pl-4 md:hidden">
          <Sparkles size={16} className="mr-2 shrink-0 text-fox-500" />
          <button
            onClick={() => setShowTour(true)}
            className="min-h-11 flex-1 whitespace-nowrap px-1 text-left text-[13px] font-semibold text-fox-700"
          >
            Take the tour
          </button>
          <Link
            to="/advisor"
            className="flex min-h-11 items-center whitespace-nowrap px-2 text-[13px] font-semibold text-fox-700"
          >
            Ask the advisor
          </Link>
          <button
            onClick={dismissTourHint}
            aria-label="Dismiss"
            className="grid h-11 w-11 place-items-center text-warm-400"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Toolbar — sticks under the navbar on phones so search and categories
          stay one thumb-reach away however deep the list is. */}
      <div className="sticky top-[4.25rem] z-30 -mx-6 mb-4 border-b border-warm-200/70 bg-warm-white/95 px-6 pb-2 pt-3 backdrop-blur-md md:static md:mx-0 md:mb-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mb-3 flex gap-2 md:mb-8 md:gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-warm-400"
            />
            <input
              type="search"
              enterKeyHint="search"
              placeholder={
                isMobile ? 'Search services…' : `Search ${catalog.services.length || 255} services…`
              }
              aria-label="Search services"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-fx pl-11 pr-4"
            />
          </div>
          <select
            value={curIdx}
            onChange={(e) => setCurIdx(Number(e.target.value))}
            aria-label="Currency"
            className="min-h-11 rounded-sm border border-warm-200 bg-white px-2 text-base font-semibold text-warm-700 md:px-3 md:text-body-sm"
          >
            {CURRENCIES.map((c, i) => (
              <option key={c.code} value={i}>
                {c.code}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            onClick={handleShare}
            aria-label="Copy a shareable link"
            className="!px-3"
          >
            <Share2 size={18} />
          </Button>
        </div>

        {/* Category chips — swipe on phones, arrows from md up */}
        <div className="relative md:mb-8">
          {['left', 'right'].map((side) => (
            <div
              key={side}
              className={cn(
                'pointer-events-none absolute bottom-6 top-0 z-10 hidden items-center transition-opacity duration-200 md:flex',
                side === 'left'
                  ? 'left-0 bg-gradient-to-r pr-10'
                  : 'right-0 bg-gradient-to-l pl-10',
                'from-warm-white via-warm-white/90 to-transparent',
                railScroll[side] ? 'opacity-100' : 'opacity-0',
              )}
            >
              <button
                type="button"
                aria-label={`Scroll categories ${side}`}
                tabIndex={railScroll[side] ? 0 : -1}
                onClick={() => scrollRail(side === 'left' ? -1 : 1)}
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-full border border-warm-200 bg-white text-warm-600 shadow-md transition-all',
                  'hover:border-warm-300 hover:text-warm-900 active:scale-95',
                  railScroll[side] && 'pointer-events-auto',
                )}
              >
                {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>
          ))}

          <div
            ref={catRailRef}
            onScroll={syncRailScroll}
            className="hide-scrollbar relative flex snap-x gap-2 overflow-x-auto scroll-smooth pb-1 md:gap-3 md:pb-6"
          >
            {chips.map((chip, i) =>
              chip === 'divider' ? (
                <div key={`d${i}`} className="mx-1 h-8 w-px shrink-0 self-center bg-warm-100" />
              ) : (
                <button
                  key={chip.id}
                  data-chip={chip.id}
                  onClick={() => setActiveCat(chip.id)}
                  className={cn(
                    'min-h-11 shrink-0 snap-start whitespace-nowrap rounded-md border px-4 py-2.5 text-sm font-semibold transition-all md:min-h-0 md:px-5',
                    activeCat === chip.id
                      ? chip.id === 'all'
                        ? 'border-warm-900 bg-warm-900 text-white'
                        : 'border-fox-500 bg-fox-500 text-white md:ring-4 md:ring-fox-50'
                      : 'border-warm-200 bg-white text-warm-600 hover:border-warm-300',
                  )}
                >
                  {chip.Icon && <chip.Icon size={14} className="mr-1.5 inline -mt-0.5" />}
                  {chip.label} <span className="ml-1 opacity-50">({chip.count})</span>
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <SuggestionStrip suggestions={suggestions} fmt={fmt} onAdd={handleAdd} />

      {activeCat !== 'industry-bundles' && activeCat !== 'service-packages' && (
        <SortBar
          sort={sort}
          onSort={setSort}
          cheap={cheap}
          onCheap={setCheap}
          count={filteredServices.length}
        />
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div ref={resultsRef} className="scroll-mt-44 space-y-12 md:scroll-mt-24 lg:col-span-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-[76px] animate-pulse rounded-2xl border border-warm-100 bg-white sm:h-40 sm:rounded-md"
                />
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg border border-warm-100">
              <p className="text-warm-500">No services found.</p>
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => {
                  setSearch('');
                  setActiveCat('all');
                }}
              >
                Reset
              </Button>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-16">
              {activeCat === 'industry-bundles' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-warm-900">
                    Industry-Specific Bundles
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredServices.map((b) => (
                      <div
                        key={b.id}
                        className="card-fx p-6 bg-white border border-warm-200 rounded-lg relative"
                      >
                        <h3 className="text-lg font-bold text-warm-900">{b.name}</h3>
                        <p className="text-sm text-warm-500 mt-2 line-clamp-2 leading-relaxed">
                          {b.description}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xl font-semibold">{fmt(b.price)}</span>
                          <Button size="sm" variant="outline" onClick={() => addMany(b.items)}>
                            Select All
                          </Button>
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
                    {filteredServices.map((p) => (
                      <div
                        key={p.id}
                        className="card-fx p-6 bg-white border border-warm-200 rounded-lg relative"
                      >
                        <h3 className="text-lg font-bold text-warm-900">{p.name}</h3>
                        <p className="text-sm text-warm-500 mt-2 leading-relaxed">
                          {p.description}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xl font-semibold">{fmt(p.price)}</span>
                          <Button size="sm" variant="outline" onClick={() => addMany(p.items)}>
                            Add to Cart
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeCat !== 'industry-bundles' &&
                activeCat !== 'service-packages' &&
                (activeCat === 'all'
                  ? catalog.categories
                  : catalog.categories.filter((c) => c.dataId === activeCat)
                ).map((cat) => {
                  const catServices = servicesByCat.get(cat.dataId) || [];
                  if (catServices.length === 0) return null;

                  // In the "All" overview (no active search) show a preview per
                  // category instead of all ~255 cards — the "View all" chip jumps
                  // straight into that category. A search already narrows things,
                  // so show every match then.
                  const isOverview = activeCat === 'all' && !debouncedSearch;
                  const shown = isOverview
                    ? catServices.slice(0, isMobile ? 4 : PREVIEW_COUNT)
                    : catServices;
                  const hidden = catServices.length - shown.length;

                  return (
                    <div key={cat.dataId} className="space-y-3 md:space-y-6">
                      <div className="border-b border-warm-100 pb-3 md:pb-4">
                        <div className="flex items-center justify-between gap-2 md:flex-wrap">
                          <h2 className="flex items-center gap-2 text-xl font-semibold text-warm-900 md:text-2xl">
                            {cat.name}
                            <span className="hidden rounded-full bg-warm-100 px-2 py-0.5 text-caption text-warm-600 md:inline">
                              {catServices.length} items
                            </span>
                          </h2>
                          {isOverview && hidden > 0 && (
                            <button
                              onClick={() => {
                                setActiveCat(cat.dataId);
                              }}
                              className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-fox-600 hover:text-fox-700"
                            >
                              View all {catServices.length} <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                        {cat.laymanTip && (
                          <p className="text-warm-600 text-sm mt-1 italic">
                            &ldquo;{cat.laymanTip}&rdquo;
                          </p>
                        )}
                      </div>

                      {isMobile ? (
                        <div className="space-y-2.5">
                          {shown.map((svc) => (
                            <ServiceRow
                              key={svc.id}
                              svc={svc}
                              price={fmt(svc.price)}
                              inCart={cartItemIds.has(svc.id)}
                              onToggle={handleToggle}
                              onOpen={setSheetSvc}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {shown.map((svc) => (
                            <ServiceCard
                              key={svc.id}
                              svc={svc}
                              price={fmt(svc.price)}
                              inCart={cartItemIds.has(svc.id)}
                              onAdd={handleAdd}
                              Icon={categoryIcon(cat.icon)}
                            />
                          ))}
                        </div>
                      )}

                      {isOverview && hidden > 0 && (
                        <button
                          onClick={() => {
                            setActiveCat(cat.dataId);
                          }}
                          className="min-h-12 w-full rounded-md border border-dashed border-warm-300 py-3 text-body-sm font-medium text-warm-600 hover:border-fox-300 hover:text-fox-600 transition-colors"
                        >
                          + {hidden} more in {cat.name}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <div className="hidden lg:block">
            <PlanPanel
              items={items}
              catalog={catalog}
              fmt={fmt}
              subtotal={cartSubtotal || items.reduce((t, i) => t + i.price * i.quantity, 0)}
              onRemove={(it) => removeItem(it._id, isAuthenticated)}
              onCheckout={toggleCart}
              onShare={handleShare}
              onClear={() => clearCart(isAuthenticated)}
              onBrowse={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="hidden rounded-lg border border-warm-200 bg-white p-6 md:block">
              <h3 className="mb-4 flex items-center gap-2 text-title text-warm-900">
                <Sparkles size={16} className="text-fox-500" /> Often added together
              </h3>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAdd(s)}
                    className="flex w-full items-center justify-between gap-2 rounded-sm border border-warm-200 bg-warm-white px-3 py-2.5 text-left transition-colors hover:border-fox-300"
                  >
                    <span className="truncate text-body-sm font-medium text-warm-800">
                      {s.name}
                    </span>
                    <Plus size={14} className="shrink-0 text-fox-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <Link
            to="/advisor"
            className="group block rounded-lg border border-sage-200 bg-sage-50 p-6 transition-transform duration-short hover:-translate-y-0.5"
          >
            <div className="mb-2 flex items-center gap-2 text-title text-sage-800">
              <Sparkles className="h-5 w-5 text-sage-600" />
              Not sure what you need?
            </div>
            <p className="max-w-sm text-body-sm leading-relaxed text-sage-800/90">
              Answer 10 quick questions and our advisor suggests a configuration for your project.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-sage-800">
              Start advisor{' '}
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
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
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-sage-50 font-mono text-[11px] text-sage-700">
                    {i + 1}
                  </span>
                  <p className="text-body-sm leading-relaxed text-warm-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CartBar count={itemCount} total={cartTotalLabel} onOpen={toggleCart} />
      <ServiceSheet
        svc={sheetSvc}
        catName={catalog.categories.find((c) => c.dataId === sheetSvc?.catId)?.name}
        price={sheetSvc ? fmt(sheetSvc.price) : ''}
        inCart={!!sheetSvc && cartItemIds.has(sheetSvc.id)}
        nameOf={nameOf}
        onToggle={handleToggle}
        onClose={() => setSheetSvc(null)}
      />
    </Section>
  );
}

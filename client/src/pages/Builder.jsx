import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, ShoppingCart, Info, X, Plus, Check, 
  ChevronDown, ChevronUp, Edit3, Save, Lock, 
  Eye, CornerDownRight, Sparkles, Share2, 
  Layout, ArrowRight, ShieldCheck, Mail, Loader2,
  FileText, Download, Upload, Globe, Trash2,
  Package, Briefcase, ChevronLeft, ChevronRight
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
   HELPER: Inline Edit Field (Ef)
   Only visible/active in Admin Mode
   ───────────────────────────────────────────────────────────────────────────── */
function EditableField({ value, onSave, isAdmin, className, type = "text", displayValue }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  if (!isAdmin) return <span className={className}>{displayValue || value}</span>;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 inline-flex">
        {type === "textarea" ? (
          <textarea
            ref={inputRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="input-fx text-xs py-1 px-2 min-h-[60px]"
          />
        ) : (
          <input
            ref={inputRef}
            type={type === "number" ? "number" : "text"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="input-fx text-xs py-1 px-2 h-7"
          />
        )}
        <div className="flex flex-col gap-1">
          <button 
            onClick={() => { onSave(val); setIsEditing(false); }}
            className="p-1 bg-success-500 text-white rounded hover:bg-success-600 shadow-sm"
          >
            <Check size={12} />
          </button>
          <button 
            onClick={() => { setVal(value); setIsEditing(false); }}
            className="p-1 bg-warm-200 text-warm-700 rounded hover:bg-warm-300"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <span 
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className={cn(className, "cursor-edit hover:bg-fox-50 border-b border-dashed border-fox-200 px-1 rounded transition-colors group/ef inline-flex items-center gap-1")}
    >
      {displayValue || value}
      <Edit3 size={10} className="opacity-0 group-hover/ef:opacity-50" />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT: Guided Tour
   ───────────────────────────────────────────────────────────────────────────── */
function Tour({ steps, active, onComplete }) {
  const [step, setStep] = useState(0);

  if (!active || !steps || steps.length === 0) return null;

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-warm-200 animate-scale-in">
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
   COMPONENT: Admin Auth Modal
   ───────────────────────────────────────────────────────────────────────────── */
function AdminAuth({ onClose, onVerified }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/request-otp', { email });
      setStep(2);
      toast.success('Code sent to your email');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Admin email required.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      if (res.data.data.isAdminVerified) {
        toast.success('Admin mode enabled');
        onVerified(email);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-warm-200 animate-scale-in relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-fox-100 text-fox-600 rounded-lg">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="font-bold text-warm-900 leading-none">Admin Verification</h3>
            <p className="text-xs text-warm-500 mt-1">Secondary security layer required.</p>
          </div>
        </div>

        {error && (
          <div className="bg-error-50 text-error-700 text-xs p-3 rounded-lg mb-4 border border-error-100">
            {error}
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-1 block">Admin Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stackfox.in" 
                  className="input-fx pl-10"
                />
              </div>
            </div>
            <Button variant="primary" className="w-full" disabled={loading} onClick={handleRequestOtp}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Send OTP'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-1 block">Enter 6-Digit Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={otp} 
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" 
                className="input-fx text-center text-xl tracking-[0.5em] font-mono"
              />
              <p className="text-[10px] text-warm-400 mt-2 text-center">Sent to {email}</p>
            </div>
            <Button variant="primary" className="w-full" disabled={loading} onClick={handleVerifyOtp}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify & Enable'}
            </Button>
            <button onClick={() => setStep(1)} className="w-full text-xs text-warm-400 hover:text-fox-500 transition-colors">
              Try different email
            </button>
          </div>
        )}

        <button onClick={onClose} className="absolute top-4 right-4 text-warm-400 hover:text-warm-600">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function AddCategoryModal({ onClose, onSave, loading }) {
  const [name, setName] = useState('');
  const [laymanTip, setLaymanTip] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 border border-warm-200 animate-scale-in relative">
        <h3 className="text-xl font-bold text-warm-900 mb-4">New Category</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Internal Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Development" className="input-fx" />
          </div>
          <div>
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Layman Tip</label>
            <textarea value={laymanTip} onChange={e => setLaymanTip(e.target.value)} placeholder="e.g. Think of this as your digital showroom..." className="input-fx min-h-[80px]" />
          </div>
          <Button variant="primary" className="w-full" disabled={loading} onClick={() => onSave({ name, laymanTip, dataId: name.toLowerCase().replace(/\s+/g, '-') })}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Category'}
          </Button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-warm-400 hover:text-warm-600"><X size={18} /></button>
      </div>
    </div>
  );
}

function AddServiceModal({ onClose, onSave, loading, categories, initialCatId }) {
  const [form, setForm] = useState({ name: '', price: 0, catId: initialCatId || '', lay: '', estimatedTime: '', unit: '' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-warm-200 animate-scale-in relative">
        <h3 className="text-xl font-bold text-warm-900 mb-4">New Service</h3>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div>
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Service Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-fx" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Category</label>
               <select value={form.catId} onChange={e => setForm({...form, catId: e.target.value})} className="input-fx">
                 <option value="">Select...</option>
                 {categories.map(c => <option key={c.dataId} value={c.dataId}>{c.name}</option>)}
               </select>
             </div>
             <div>
               <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Starting Price</label>
               <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="input-fx" />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
               <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Delivery Est.</label>
               <input value={form.estimatedTime} onChange={e => setForm({...form, estimatedTime: e.target.value})} placeholder="e.g. 3-5 days" className="input-fx" />
            </div>
            <div>
               <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Price Unit</label>
               <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="e.g. Per Page" className="input-fx" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Layman Explanation</label>
            <textarea value={form.lay} onChange={e => setForm({...form, lay: e.target.value})} className="input-fx min-h-[60px]" />
          </div>
          <Button variant="primary" className="w-full" disabled={loading} onClick={() => onSave({ ...form, dataId: form.name.toLowerCase().replace(/\s+/g, '-') })}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Service'}
          </Button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-warm-400 hover:text-warm-600"><X size={18} /></button>
      </div>
    </div>
  );
}


function AddPackageModal({ onClose, onSave, loading, allServices }) {
  const [form, setForm] = useState({ name: '', price: 0, savings: 0, items: [], isPopular: false });
  const toggleItem = (id) => {
    setForm(f => ({ ...f, items: f.items.includes(id) ? f.items.filter(x => x !== id) : [...f.items, id] }));
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-warm-200 animate-scale-in relative">
        <h3 className="text-xl font-bold text-warm-900 mb-4">New Package</h3>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div>
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Package Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-fx" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Price</label>
               <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="input-fx" />
             </div>
             <div>
               <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Savings Text</label>
               <input type="number" value={form.savings} onChange={e => setForm({...form, savings: Number(e.target.value)})} placeholder="e.g. 5000" className="input-fx" />
             </div>
          </div>
          <div>
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Select Services</label>
            <div className="grid grid-cols-1 gap-2 border border-warm-100 rounded-xl p-3 max-h-[200px] overflow-y-auto">
               {allServices.map(s => (
                 <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-warm-50 p-1 rounded">
                   <input type="checkbox" checked={form.items.includes(s.id)} onChange={() => toggleItem(s.id)} />
                   {s.name}
                 </label>
               ))}
            </div>
          </div>
          <Button variant="primary" className="w-full" disabled={loading} onClick={() => onSave({ ...form, dataId: form.name.toLowerCase().replace(/\s+/g, '-') })}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Package'}
          </Button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-warm-400 hover:text-warm-600"><X size={18} /></button>
      </div>
    </div>
  );
}

function AddBundleModal({ onClose, onSave, loading, allServices }) {
  const [form, setForm] = useState({ name: '', price: 0, description: '', items: [], features: [] });
  const [feature, setFeature] = useState('');
  const toggleItem = (id) => {
    setForm(f => ({ ...f, items: f.items.includes(id) ? f.items.filter(x => x !== id) : [...f.items, id] }));
  };
  const addFeature = () => {
    if (!feature) return;
    setForm(f => ({ ...f, features: [...f.features, feature] }));
    setFeature('');
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 border border-warm-200 animate-scale-in relative">
        <h3 className="text-xl font-bold text-warm-900 mb-4">Industry Bundle Editor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto px-1">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Bundle Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-fx" />
            </div>
            <div>
              <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Price</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="input-fx" />
            </div>
            <div>
              <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-fx min-h-[60px]" />
            </div>
            <div>
              <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Marketing Features</label>
              <div className="flex gap-2 mb-2">
                <input value={feature} onChange={e => setFeature(e.target.value)} className="input-fx" placeholder="e.g. 24/7 Support" />
                <Button variant="ghost" size="sm" onClick={addFeature}><Plus size={14} /></Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.features.map((f, i) => <span key={i} className="badge-fx badge-neutral flex gap-1 items-center">{f} <X size={10} className="cursor-pointer" onClick={() => setForm(prev => ({...prev, features: prev.features.filter((_, idx) => idx !== i)}))} /></span>)}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-1 block">Component Services</label>
            <div className="border border-warm-100 rounded-xl p-3 h-full max-h-[400px] overflow-y-auto space-y-1">
               {allServices.map(s => (
                 <label key={s.id} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-warm-50 p-1.5 rounded transition-colors group">
                   <input type="checkbox" checked={form.items.includes(s.id)} onChange={() => toggleItem(s.id)} />
                   <span className="flex-1 truncate">{s.name}</span>
                   <span className="text-[10px] text-warm-300 font-bold opacity-0 group-hover:opacity-100">+{s.price}</span>
                 </label>
               ))}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Button variant="primary" className="w-full" disabled={loading} onClick={() => onSave({ ...form, dataId: form.name.toLowerCase().replace(/\s+/g, '-') })}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Publish Bundle'}
          </Button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-warm-400 hover:text-warm-600"><X size={18} /></button>
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
  const { user, isAuthenticated } = useAuthStore();

  // 2. Local States
  const [activeCat, setActiveCat] = useState(params.get('category') || 'all');
  const [search, setSearch] = useState(params.get('q') || '');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [catalog, setCatalog] = useState({ services: [], categories: [], packages: [], bundles: [] });
  const [isLoading, setIsLoading] = useState(true);
  
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(null); 
  const [addPkgOpen, setAddPkgOpen] = useState(false);
  const [addBndlOpen, setAddBndlOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);

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

    const hasSeenTour = localStorage.getItem('fox_tour_seen');
    if (!hasSeenTour) setShowTour(true);

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

  // -- Catalog Management Handlers --
  const handleCreateCategory = async (catData) => {
    setFormBusy(true);
    try {
      const res = await api.post('/admin/catalog/categories', catData);
      setCatalog(prev => ({ ...prev, categories: [...prev.categories, res.data.data.category] }));
      toast.success('Category created!');
      setAddCatOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    } finally {
      setFormBusy(false);
    }
  };

  const updateService = async (id, updates) => {
    try {
      const fieldMap = { lay: 'laymanExplanation' };
      const apiUpdates = {};
      Object.keys(updates).forEach(k => {
        apiUpdates[fieldMap[k] || k] = updates[k];
      });
      
      const svc = catalog.services.find(s => s.id === id);
      if (!svc?._dbId) throw new Error("No DB ID");

      await api.patch(`/admin/catalog/services/${svc._dbId}`, apiUpdates);
      
      setCatalog(prev => ({
        ...prev,
        services: prev.services.map(s => s.id === id ? { ...s, ...updates } : s)
      }));
      toast.success('Updated');
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleCreateService = async (svcData) => {
    setFormBusy(true);
    try {
      const res = await api.post('/admin/catalog/services', svcData);
      const s = res.data.data.service;
      const mapped = { ...s, id: s.dataId, lay: s.laymanExplanation, _dbId: s._id };
      setCatalog(prev => ({ ...prev, services: [...prev.services, mapped] }));
      toast.success('Service created!');
      setAddItemOpen(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create service');
    } finally {
      setFormBusy(false);
    }
  };

  const handleCreatePackage = async (pkgData) => {
    setFormBusy(true);
    try {
      const res = await api.post('/admin/catalog/packages', pkgData);
      const p = res.data.data.package;
      setCatalog(prev => ({ ...prev, packages: [...prev.packages, { ...p, id: p.dataId, _dbId: p._id }] }));
      toast.success('Package published!');
      setAddPkgOpen(false);
    } catch (err) {
      toast.error('Failed to create package');
    } finally {
      setFormBusy(false);
    }
  };

  const handleCreateBundle = async (bndlData) => {
    setFormBusy(true);
    try {
      const res = await api.post('/admin/catalog/bundles', bndlData);
      const b = res.data.data.bundle;
      setCatalog(prev => ({ ...prev, bundles: [...prev.bundles, { ...b, id: b.dataId, _dbId: b._id }] }));
      toast.success('Industry bundle published!');
      setAddBndlOpen(false);
    } catch (err) {
      toast.error('Failed to create bundle');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeactivate = async (type, id, dbId) => {
    if (!window.confirm(`Deactivate this ${type}? It will no longer be visible to customers.`)) return;
    try {
      await api.delete(`/admin/catalog/${type}s/${dbId}`);
      setCatalog(prev => ({
        ...prev,
        [type + 's']: prev[type + 's'].filter(item => (item._dbId || item._id) !== dbId)
      }));
      toast.success(`${type} deactivated`);
    } catch (err) {
      toast.error(`Failed to deactivate ${type}`);
    }
  };

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
      <Tour steps={SF_DATA.tourSteps} active={showTour} onComplete={() => { localStorage.setItem('fox_tour_seen', 'true'); setShowTour(false); }} />
      
      {showAdminAuth && (
        <AdminAuth 
          onClose={() => setShowAdminAuth(false)} 
          onVerified={() => { setIsAdminMode(true); setShowAdminAuth(false); }}
        />
      )}

      {/* CRUD Modals */}
      {addCatOpen && (
        <AddCategoryModal 
          onClose={() => setAddCatOpen(false)} 
          loading={formBusy} 
          onSave={handleCreateCategory} 
        />
      )}
      {addItemOpen && (
        <AddServiceModal 
          onClose={() => setAddItemOpen(null)} 
          categories={catalog.categories} 
          initialCatId={addItemOpen}
          loading={formBusy} 
          onSave={handleCreateService} 
        />
      )}
      {addPkgOpen && (
        <AddPackageModal
          onClose={() => setAddPkgOpen(false)}
          allServices={catalog.services}
          loading={formBusy}
          onSave={handleCreatePackage}
        />
      )}
      {addBndlOpen && (
        <AddBundleModal
          onClose={() => setAddBndlOpen(false)}
          allServices={catalog.services}
          loading={formBusy}
          onSave={handleCreateBundle}
        />
      )}

      {/* Admin Floating Trigger */}
      <div className="fixed top-24 right-4 z-40 flex flex-col gap-2">
        {isAdminMode ? (
          <>
            <div className="bg-success-600 text-white p-2 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in">
              <ShieldCheck size={18} />
              <span className="text-xs font-bold uppercase">Admin Mode</span>
              <button onClick={() => setIsAdminMode(false)} className="p-1.5 hover:bg-white/20 rounded-lg">
                <Lock size={16} />
              </button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white border-fox-200 text-fox-600 shadow-sm justify-start"
              onClick={() => setAddCatOpen(true)}
            >
              <Plus size={14} className="mr-1" /> Category
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white border-fox-200 text-fox-600 shadow-sm justify-start"
              onClick={() => setAddPkgOpen(true)}
            >
              <Plus size={14} className="mr-1" /> Package
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white border-fox-200 text-fox-600 shadow-sm justify-start"
              onClick={() => setAddBndlOpen(true)}
            >
              <Plus size={14} className="mr-1" /> Bundle
            </Button>
          </>
        ) : (
          isAuthenticated && user?.role === 'admin' && (
            <button onClick={() => setShowAdminAuth(true)} className="bg-white border border-warm-200 p-2 rounded-xl shadow-sm hover:text-fox-600 text-warm-400">
              <Edit3 size={18} />
            </button>
          )
        )}
      </div>

      <SectionHeading
        label="Build & Price"
        title={isAdminMode ? "Catalog Editor" : "Service Builder"}
        description={isAdminMode ? "Edit catalog items directly. Changes are live." : "Browse and select services."}
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
            'px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all shrink-0',
            activeCat === 'all' ? 'bg-warm-900 text-white' : 'bg-white text-warm-600 border border-warm-200 hover:border-warm-300'
          )}
        >
          All Services <span className="opacity-50 ml-1">({catalog.services.length})</span>
        </button>
        <button
          onClick={() => setActiveCat('industry-bundles')}
          className={cn(
            'px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all shrink-0 whitespace-nowrap',
            activeCat === 'industry-bundles' ? 'bg-fox-500 text-white ring-4 ring-fox-50' : 'bg-white text-warm-600 border border-warm-200 hover:border-warm-300'
          )}
        >
          Special Bundles <span className="opacity-50 ml-1">({catalog.bundles.length})</span>
        </button>
        <button
          onClick={() => setActiveCat('service-packages')}
          className={cn(
            'px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all shrink-0 whitespace-nowrap',
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
              'px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all shrink-0 whitespace-nowrap',
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
               {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-3xl p-5 h-40 animate-pulse border border-warm-100" />)}
             </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-warm-100">
               <p className="text-warm-500">No services found.</p>
               <Button variant="ghost" className="mt-4" onClick={() => { setSearch(''); setActiveCat('all'); }}>Reset</Button>
            </div>
          ) : (
            <div className="space-y-16">
              {activeCat === 'industry-bundles' && (
                <div className="space-y-6">
                   <h2 className="text-2xl font-black text-warm-900">Industry-Specific Bundles</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {filteredServices.map(b => (
                       <div key={b.id} className="card-fx p-6 bg-white border border-warm-200 rounded-3xl relative">
                          {isAdminMode && (
                            <button onClick={() => handleDeactivate('bundle', b.id, b._dbId || b._id)} className="absolute top-4 right-4 text-[10px] text-red-400 hover:text-red-700 font-black uppercase tracking-widest">Deactivate</button>
                          )}
                          <h3 className="text-lg font-bold text-warm-900">{b.name}</h3>
                          <p className="text-sm text-warm-500 mt-2 line-clamp-2 leading-relaxed">{b.description}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xl font-black">{fmt(b.price)}</span>
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
                   <h2 className="text-2xl font-black text-warm-900">Recommended Packages</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {filteredServices.map(p => (
                       <div key={p.id} className="card-fx p-6 bg-white border border-warm-200 rounded-3xl relative">
                          {isAdminMode && (
                            <button onClick={() => handleDeactivate('package', p.id, p._dbId || p._id)} className="absolute top-4 right-4 text-[10px] text-red-400 hover:text-red-700 font-black uppercase tracking-widest">Deactivate</button>
                          )}
                          <h3 className="text-lg font-bold text-warm-900">{p.name}</h3>
                          <p className="text-sm text-warm-500 mt-2 leading-relaxed">{p.description}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xl font-black">{fmt(p.price)}</span>
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
                if (catServices.length === 0 && !isAdminMode) return null;

                return (
                  <div key={cat.dataId} className="space-y-6">
                    <div className="border-b border-warm-100 pb-4">
                      <div className="flex items-center justify-between">
                         <h2 className="text-2xl font-black text-warm-900 flex items-center gap-2">
                           {cat.name}
                           <span className="text-[10px] bg-warm-100 text-warm-500 px-2 py-0.5 rounded-full">{catServices.length} items</span>
                         </h2>
                         {isAdminMode && (
                           <Button variant="ghost" size="sm" onClick={() => setAddItemOpen(cat.dataId)} className="text-fox-600">
                             <Plus size={14} className="mr-1" /> Add Service
                           </Button>
                         )}
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
                            className="card-fx p-5 flex flex-col group min-h-[160px] bg-white border border-warm-200 rounded-3xl hover:border-fox-300 transition-all"
                          >
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div className="flex-1">
                                <EditableField isAdmin={isAdminMode} value={svc.name} className="font-bold text-warm-900 block" onSave={(v) => updateService(svc.id, { name: v })} />
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-warm-400 font-bold uppercase">{svc.estimatedTime || '3-5 days'}</span>
                                  {svc.lay && <Info size={12} className="text-warm-300" title={svc.lay} />}
                                </div>
                              </div>
                              <div className="text-right">
                                <EditableField isAdmin={isAdminMode} type="number" value={svc.price} className="text-lg font-black text-warm-900" displayValue={fmt(svc.price)} onSave={(v) => updateService(svc.id, { price: Number(v) })} />
                                <p className="text-[9px] text-warm-300 font-bold uppercase tracking-widest">Starting</p>
                              </div>
                            </div>

                            <div className="bg-warm-50 rounded-2xl p-3 mb-4 flex-1">
                               <EditableField isAdmin={isAdminMode} type="textarea" value={svc.lay || "Explaining this service..."} className="text-xs text-warm-600 block leading-relaxed italic" onSave={(v) => updateService(svc.id, { lay: v })} />
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-warm-100 gap-2">
                               {isAdminMode && (
                                 <button onClick={() => handleDeactivate('service', svc.id, svc._dbId || svc._id)} className="text-[10px] text-red-500 hover:text-red-700 font-black uppercase tracking-tighter">Deactivate</button>
                               )}
                               <div className="flex-1 flex justify-between items-center text-[9px] font-bold text-warm-400 uppercase">
                                 <span>{svc.unit || 'Standard'}</span>
                                 <button onClick={() => !isInCart && handleAdd(svc)} className={cn("p-1.5 rounded-xl transition-all", isInCart ? "bg-success-50 text-success-600" : "bg-fox-50 text-fox-600 hover:bg-fox-500 hover:text-white")}>
                                   {isInCart ? <Check size={14} /> : <Plus size={14} />}
                                 </button>
                               </div>
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
            <div className="bg-fox-50 rounded-3xl p-6 border border-fox-100">
               <h3 className="font-bold text-fox-900 mb-4 flex items-center gap-2"><Sparkles size={18} /> Recommended</h3>
               <div className="space-y-3">
                 {suggestions.map(s => (
                   <button key={s.id} onClick={() => handleAdd(s)} className="w-full text-left bg-white/60 p-3 rounded-2xl border border-fox-200 hover:border-fox-500 flex items-center justify-between">
                     <span className="text-xs font-bold truncate">{s.name}</span>
                     <Plus size={14} className="text-fox-500" />
                   </button>
                 ))}
               </div>
            </div>
          )}
           <Link to="/advisor" className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-fox-500 to-fox-600 p-6 text-white shadow-lg shadow-fox-500/20 transition-all hover:shadow-xl hover:shadow-fox-500/30 hover:-translate-y-0.5">
             <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 transition-transform group-hover:scale-150" />
             <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 transition-transform group-hover:scale-125" />
             <div className="relative z-10">
               <div className="flex items-center gap-2 mb-2 font-bold text-lg">
                 <Sparkles className="h-5 w-5 text-yellow-200" />
                 Not sure what you need?
               </div>
               <p className="text-sm text-white/85 leading-relaxed max-w-sm">Answer 10 quick questions and let our AI advisor recommend the perfect configuration for your project.</p>
               <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                 Start advisor <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
               </div>
             </div>
           </Link>
          <div className="bg-white rounded-3xl border border-warm-200 p-6">
            <h3 className="font-bold text-warm-900 mb-4">Building Guidance</h3>
            <div className="space-y-4">
               {[
                  { step: 1, text: 'Browse our catalog of 240+ services and select exactly what your project needs.' },
                 { step: 2, text: 'Watch your indicative quote update in real-time as you add or remove atomic pieces.' },
                 { step: 3, text: 'Submit your cart to receive a final, detailed technical proposal within 24 hours.' }
               ].map((item) => (
                 <div key={item.step} className="flex gap-3">
                   <div className="w-5 h-5 bg-fox-500 text-white rounded text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm shadow-fox-100">{item.step}</div>
                   <p className="text-xs text-warm-600 leading-relaxed">{item.text}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden">
          <div className="bg-fox-600 text-white rounded-3xl p-4 flex items-center justify-between" onClick={toggleCart}>
            <div className="flex items-center gap-3">
              <ShoppingCart size={24} />
              <div className="font-bold">{itemCount} items Selected</div>
            </div>
            <div className="font-black text-lg">→</div>
          </div>
        </div>
      )}
    </Section>
  );
}

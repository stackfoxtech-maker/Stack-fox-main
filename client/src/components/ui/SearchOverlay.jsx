import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, X, ArrowRight, CornerDownLeft, Sparkles, 
  Clock, TrendingUp, Rocket, Cloud, Smartphone, 
  Database, Zap, Globe 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@lib/utils';
import { useCatalogue } from '@lib/useStorefrontData';

export default function SearchOverlay({ isOpen, onClose }) {
  const { services, categories } = useCatalogue();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Derive results during render — deriving via setState in an effect caused an
  // infinite render loop when useCatalogue returned fresh [] refs each render.
  const results = useMemo(() => {
    if (query.trim().length < 2) return [];

    const q = query.toLowerCase();
    const allServices = services.map(s => {
      const category = categories.find(c => c.id === s.catId);
      return { ...s, category: category?.name || 'Other' };
    });

    return allServices.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      (s.lay || s.description || '').toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query, services, categories]);

  // Handle Hotkeys
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[150] animate-in slide-in-from-top duration-500 ease-out-expo">
      {/* Search Header Bar - Sleek & Modern */}
      <div className="w-full bg-white/80 backdrop-blur-2xl border-b border-warm-200/50 shadow-2xl px-4 py-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 group-focus-within:text-fox-500 transition-colors" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are we building today? Search 'SaaS', 'Mobile App', 'E-commerce'..."
              className="w-full bg-warm-50/50 border-none rounded-2xl pl-12 pr-12 py-4 text-lg font-medium text-warm-900 placeholder-warm-400 transition-all outline-none focus:bg-white focus:ring-2 focus:ring-fox-500/20"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-warm-100 rounded-full text-warm-400 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 bg-warm-900 text-white rounded-full text-sm font-bold hover:bg-warm-800 transition-all shadow-lg shadow-warm-900/20 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>

      {/* Results Slider Area - Glass Backdrop */}
      <div className="w-full min-h-[400px] bg-gradient-to-b from-white/95 to-warm-50/95 backdrop-blur-xl border-b border-warm-200/50 overflow-hidden">
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-8">
          {query.trim().length === 0 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-bold text-warm-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={14} className="text-fox-500" /> Trending Explorations
                </h3>
              </div>
              
              {/* Horizontal Slider for Popular Searches */}
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
                {[
                  { label: 'SaaS MVP', icon: <Rocket size={24} /> },
                  { label: 'AI Integration', icon: <Sparkles size={24} /> },
                  { label: 'Cloud Migration', icon: <Cloud size={24} /> },
                  { label: 'Mobile Mastery', icon: <Smartphone size={24} /> },
                  { label: 'Web Experience', icon: <Globe size={24} /> },
                  { label: 'Custom CRM', icon: <Database size={24} /> },
                  { label: 'Fintech Engine', icon: <Zap size={24} /> }
                ].map((item, idx) => (
                  <button 
                    key={item.label}
                    onClick={() => setQuery(item.label)}
                    className="flex-shrink-0 px-8 py-10 bg-white border border-warm-200 rounded-[2rem] text-center transition-all hover:border-fox-500 hover:shadow-xl hover:shadow-fox-500/10 group animate-in fade-in zoom-in-95"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-warm-50 group-hover:bg-fox-500/10 flex items-center justify-center text-warm-400 group-hover:text-fox-500 mx-auto mb-4 transition-colors">
                      {item.icon}
                    </div>
                    <span className="text-sm font-bold text-warm-900 group-hover:text-fox-500 transition-colors">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-bold text-warm-400 uppercase tracking-[0.2em]">
                  Matched Solutions ({results.length})
                </h3>
              </div>

              {/* Horizontal Slider for Results */}
              <div className="flex gap-6 overflow-x-auto pb-8 no-scrollbar -mx-4 px-4">
                {results.map((item, idx) => (
                  <Link
                    key={item.id}
                    to={`/builder?item=${item.id}`}
                    onClick={onClose}
                    className="flex-shrink-0 w-80 group bg-white border border-warm-200 hover:border-fox-500 rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-fox-500/10 animate-in fade-in slide-in-from-right-4"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="w-16 h-16 rounded-3xl bg-fox-500/5 group-hover:bg-fox-500 flex items-center justify-center text-fox-500 group-hover:text-white transition-all mb-6">
                      <Search size={28} />
                    </div>
                    
                    <div className="mb-6">
                      <span className="text-[10px] font-bold text-fox-500 uppercase tracking-widest block mb-2">{item.category}</span>
                      <h4 className="text-xl font-black text-warm-900 group-hover:text-fox-600 transition-colors leading-tight mb-2">
                        {item.name}
                      </h4>
                      <p className="text-sm text-warm-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-warm-100">
                      <div>
                        <div className="text-[10px] font-bold text-warm-400 uppercase">Starting at</div>
                        <div className="text-lg font-black text-warm-900">₹{item.price?.toLocaleString()}</div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-warm-900 text-white flex items-center justify-center group-hover:bg-fox-500 transition-colors">
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </Link>
                ))}
                
                {/* View All Card */}
                <Link
                  to={`/builder?q=${query}`}
                  onClick={onClose}
                  className="flex-shrink-0 w-64 bg-warm-900 rounded-[2.5rem] p-8 flex flex-col justify-center items-center text-center group transition-all hover:bg-fox-600"
                >
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                    <ArrowRight size={24} />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">View Full Catalog</h4>
                   <p className="text-white/60 text-xs">Explore 240+ ready-to-ship digital services</p>
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center animate-in fade-in zoom-in-95">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-warm-100 text-warm-400 mb-6">
                <Search size={36} />
              </div>
              <h3 className="text-2xl font-black text-warm-900 mb-2">No results for "{query}"</h3>
              <p className="text-sm text-warm-500 max-w-xs mx-auto">Try a different keyword or browse our trending solutions above.</p>
              <button 
                onClick={() => setQuery('')}
                className="mt-8 px-8 py-3 bg-fox-500 text-white rounded-full text-sm font-bold hover:bg-fox-600 transition-colors shadow-lg shadow-fox-500/20"
              >
                Clear and try again
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Dark Overlay for the rest of the page */}
      <div 
        className="fixed inset-0 bg-warm-900/40 backdrop-blur-sm -z-10 animate-in fade-in duration-500" 
        onClick={onClose}
      />
    </div>
  );
}

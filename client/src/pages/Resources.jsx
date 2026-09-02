import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, User, ArrowRight, Search, Tag, Loader2 } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Button, Input, Spinner } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';
import { cn } from '@lib/utils';
import api from '@lib/api';

export default function Resources() {
  usePageTitle('Resources & Blog');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await api.get('/blog');
        setPosts(res.data.data || []);
      } catch (err) {
        setPosts(data.resources || []);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const categories = ['All', ...new Set(posts.map(p => p.category))];

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(search.toLowerCase()) || 
                         post.excerpt.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || post.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Section className="bg-warm-50/30">
      <div className="container-fx">
        <div className="max-w-4xl mx-auto mb-16 text-center">
          <SectionHeading 
            label="Resources" 
            title="Learn, Build & Grow" 
            subtitle="Expert insights on Web Development, AI, and Product Strategy curated by the StackFox team." 
          />
          
          {/* Search and Filters */}
          <div className="mt-10 flex flex-col md:flex-row gap-4 items-center justify-center">
            <div className="relative w-full max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400" />
              <Input 
                placeholder="Search articles..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 bg-white border-warm-200"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border",
                    activeCategory === cat 
                      ? "bg-fox-500 text-white border-fox-600 shadow-md shadow-fox-200" 
                      : "bg-white text-warm-600 border-warm-200 hover:border-fox-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, i) => (
              <Link 
                key={post._id || post.id} 
                to={`/resources/${post.slug || post.id}`}
                className="group bg-white rounded-3xl border border-warm-200 overflow-hidden hover:shadow-xl hover:border-fox-200 transition-all duration-300 flex flex-col"
              >
                {/* Image Placeholder with Category */}
                <div className="aspect-video bg-warm-100 relative overflow-hidden">
                  {post.coverImage ? (
                    <img 
                      src={post.coverImage} 
                      alt={post.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-fox-500/10 to-warm-900/10 group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                        <BookOpen size={48} className="text-warm-900" />
                      </div>
                    </>
                  )}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-bold text-fox-600 uppercase tracking-widest border border-fox-100 shadow-sm">
                      {post.category}
                    </span>
                    {post.status && post.status !== 'published' && (
                      <span className="px-2 py-1 rounded-md bg-amber-500 text-white text-[9px] font-black uppercase tracking-tighter shadow-sm">
                        Draft
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-4 text-[10px] text-warm-400 font-bold uppercase tracking-wider mb-3">
                    <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime} min read</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : post.date}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-warm-900 mb-3 group-hover:text-fox-600 transition-colors line-clamp-2 leading-tight">
                    {post.title}
                  </h3>
                  
                  <p className="text-sm text-warm-500 line-clamp-3 mb-6 leading-relaxed">
                    {post.excerpt}
                  </p>

                  <div className="mt-auto pt-6 border-t border-warm-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-fox-50 flex items-center justify-center text-[10px] font-bold text-fox-600 overflow-hidden">
                        {post.author?.avatar ? (
                          <img src={post.author.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (post.author?.name || post.author || 'A').charAt(0)
                        )}
                      </div>
                      <span className="text-xs font-medium text-warm-600">{post.author?.name || post.author || 'StackFox Team'}</span>
                    </div>
                    <span className="text-fox-500 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Read <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-warm-200">
            <Search size={40} className="mx-auto text-warm-200 mb-4" />
            <h3 className="text-lg font-bold text-warm-900">No articles found</h3>
            <p className="text-warm-500 text-sm mb-6">Try adjusting your search or category filter.</p>
            <Button variant="ghost" onClick={() => { setSearch(''); setActiveCategory('All'); }}>
              Clear all filters
            </Button>
          </div>
        )}

        {/* Newsletter Signup */}
        <div className="mt-24 bg-warm-900 rounded-lg p-8 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-fox-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-display-lg text-white mb-4">Stay ahead of the curve.</h2>
            <p className="text-warm-300 mb-8 leading-relaxed">
              Get our monthly briefing on tech trends, automation hacks, and scaling strategies delivered straight to your inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1 px-6 py-4 rounded-sm bg-white/10 border border-white/15 text-white placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fox-500 transition-all"
              />
              <Button variant="primary" size="lg" className="px-10">
                Join 500+ builders
              </Button>
            </form>
            <p className="text-label text-warm-300 mt-4 uppercase">
              No spam. Just value. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

const Calendar = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

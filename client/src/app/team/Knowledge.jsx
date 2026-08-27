import { useEffect, useState } from 'react';
import { Search, BookOpen, Code2, Palette, Cog, Wrench, Plus, ExternalLink } from 'lucide-react';
import { Badge, EmptyState } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';

const categories = [
  { key: 'all', label: 'All', icon: BookOpen },
  { key: 'Development', label: 'Development', icon: Code2 },
  { key: 'Design', label: 'Design', icon: Palette },
  { key: 'DevOps', label: 'Process', icon: Cog },
  { key: 'E-Commerce', label: 'Tools', icon: Wrench },
];

const categoryColor = { Development: 'info', Design: 'default', DevOps: 'warning', 'E-Commerce': 'success', AI: 'info' };

function mapPostToArticle(post) {
  const excerpt = post.excerpt || (post.content ? post.content.substring(0, 120) + '...' : '');
  const date = post.publishedAt || post.createdAt;
  return {
    id: post._id || post.id,
    title: post.title,
    category: post.category,
    author: post.author?.name || 'StackFox',
    date,
    views: post.views || 0,
    excerpt,
  };
}

export default function Knowledge() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestBody, setSuggestBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/blog').then((r) => setArticles((r.data.data || []).map(mapPostToArticle))).catch(() => toast.error('Failed to load articles.')).finally(() => setLoading(false));
  }, []);

  const filtered = articles.filter((a) => {
    if (category !== 'all' && a.category !== category) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.excerpt.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSuggest = async (e) => {
    e.preventDefault();
    if (!suggestTitle.trim() || !suggestBody.trim()) {
      toast.error('Please fill in both title and description.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/blog/suggest', { title: suggestTitle, content: suggestBody, category: category === 'all' ? 'Development' : category });
      toast.success('Article suggestion submitted!');
      setShowSuggest(false);
      setSuggestTitle('');
      setSuggestBody('');
    } catch {
      toast.error('Failed to submit suggestion.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-warm-200 border-t-fox-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-900">Knowledge Base</h2>
      </div>

      {showSuggest && (
        <form onSubmit={handleSuggest} className="bg-white rounded-2xl border border-warm-200 p-6 space-y-3">
          <input placeholder="Article title" value={suggestTitle} onChange={(e) => setSuggestTitle(e.target.value)} className="w-full border border-warm-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
          <textarea rows={3} placeholder="What should this article cover?" value={suggestBody} onChange={(e) => setSuggestBody(e.target.value)} className="w-full border border-warm-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none" />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-fox-500 text-white text-sm font-medium hover:bg-fox-600 transition disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit'}</button>
            <button type="button" onClick={() => setShowSuggest(false)} className="px-4 py-2 rounded-xl bg-warm-100 text-warm-600 text-sm font-medium hover:bg-warm-200 transition">Cancel</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
      </div>

      <div className="flex gap-2">
        {categories.map((c) => (
          <button key={c.key} onClick={() => { setCategory(c.key); setShowSuggest(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${category === c.key ? 'bg-fox-500 text-white' : 'bg-warm-50 text-warm-600 hover:bg-warm-100'}`}>
            <c.icon size={14} /> {c.label}
          </button>
        ))}
      </div>

      <button onClick={() => setShowSuggest(!showSuggest)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-fox-500 text-white text-sm font-medium hover:bg-fox-600 transition">
        <Plus size={14} /> Suggest Article
      </button>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No articles found" description="Try a different search or category." />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-warm-200 p-5 hover:shadow-sm transition cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={categoryColor[a.category] || 'default'}>{a.category}</Badge>
                <ExternalLink size={14} className="text-warm-300 group-hover:text-fox-500 transition" />
              </div>
              <h3 className="font-medium text-warm-900 text-sm mb-1">{a.title}</h3>
              <p className="text-xs text-warm-500 mb-3 line-clamp-2">{a.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-warm-400">
                <span>{a.author}</span>
                <span>{a.views} views</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

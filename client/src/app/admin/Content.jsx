import { useState, useEffect } from 'react';
import { usePageTitle } from '@lib/hooks';
import { FileText, Plus, Search, Edit3, Trash2, Eye, Sparkles, Wand2, X, Save, AlertCircle, Loader2, Star } from 'lucide-react';
import { Button, Input, Spinner, Badge } from '@components/ui/Primitives';
import api from '@lib/api';
import toast from 'react-hot-toast';
import { formatDate } from '@lib/utils';
import { Link } from 'react-router-dom';

export default function Content() {
  usePageTitle('Admin Content');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [genModal, setGenModal] = useState(false);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  
  const [editModal, setEditModal] = useState(false);
  const [currentPost, setCurrentPost] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await api.get('/blog/admin/all');
      setPosts(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error('Please enter a topic');
    setGenerating(true);
    try {
      const res = await api.post('/blog/generate', { topic });
      setCurrentPost(res.data.data.post);
      setEditModal(true);
      setGenModal(false);
      setTopic('');
      toast.success('Draft generated! Review and save it.');
    } catch (err) {
      toast.error('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (currentPost._id) {
        await api.put(`/blog/${currentPost._id}`, currentPost);
        toast.success('Post updated');
      } else {
        const res = await api.post('/blog', currentPost);
        const newPost = res.data.data.post;
        toast.success((t) => (
          <span>
            Post created! <Link to={`/resources/${newPost.slug}`} target="_blank" className="text-fox-500 font-bold underline underline-offset-4" onClick={() => toast.dismiss(t.id)}>View live</Link>
          </span>
        ), { duration: 5000 });
      }
      fetchPosts();
      setEditModal(false);
      setCurrentPost(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    const isArchived = post.status === 'archived';
    const msg = isArchived 
      ? 'This will PERMANENTLY delete the post from the database. Proceed?' 
      : 'Move this post to archives? It will no longer be visible to users.';
      
    if (!window.confirm(msg)) return;
    
    try {
      await api.delete(`/blog/${post._id}`);
      toast.success(isArchived ? 'Deleted permanently' : 'Post archived');
      fetchPosts();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const filteredPosts = posts.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-warm-900">Content Management</h2>
          <p className="text-sm text-warm-500">Manage blog posts and AI-generated insights.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setGenModal(true)}>
            <Sparkles size={16} className="mr-2 text-fox-500" /> AI Generate
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setCurrentPost({ title: '', content: '', category: 'Engineering', status: 'draft' }); setEditModal(true); }}>
            <Plus size={16} className="mr-1" /> New Post
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-warm-200 overflow-hidden">
        <div className="p-4 border-b border-warm-100 bg-warm-50/50 flex gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
            <Input 
              placeholder="Search posts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 py-2 h-10 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-warm-400 uppercase tracking-widest bg-warm-50/30 border-b border-warm-100">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {filteredPosts.length === 0 && (
                  <tr><td colSpan="5" className="py-20 text-center text-warm-400 text-sm">No posts found.</td></tr>
                )}
                {filteredPosts.map(post => (
                  <tr key={post._id} className="hover:bg-warm-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {post.featured && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                        <div className="text-sm font-semibold text-warm-900 line-clamp-1">{post.title}</div>
                      </div>
                      <div className="text-[10px] text-warm-400 font-bold">{post.readTime} min read</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">{post.category}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={post.status === 'published' ? 'success' : 'warning'}>
                        {post.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-warm-600">{formatDate(post.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/resources/${post.slug}`} target="_blank" className="p-1.5 hover:bg-warm-100 rounded-lg text-warm-400 hover:text-warm-700">
                          <Eye size={16} />
                        </Link>
                        <button onClick={() => { setCurrentPost(post); setEditModal(true); }} className="p-2 hover:bg-fox-50 rounded-xl text-warm-400 hover:text-fox-600 transition-colors shadow-sm border border-transparent hover:border-fox-100 bg-white">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => handleDelete(post)} className="p-2 hover:bg-red-50 rounded-xl text-warm-400 hover:text-red-600 transition-colors shadow-sm border border-transparent hover:border-red-100 bg-white">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Generation Modal */}
      {genModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-fox-500 text-white flex items-center justify-center">
                  <Wand2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-warm-900">AI Post Generator</h3>
                  <p className="text-xs text-warm-500">Auto-write industry insights.</p>
                </div>
              </div>
              <button onClick={() => setGenModal(false)} className="text-warm-400 hover:text-warm-900"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">Topic / Keyword</label>
                <Input 
                  placeholder="e.g. Future of SaaS, E-commerce trends..." 
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="rounded-2xl"
                />
              </div>
              <Button 
                variant="primary" 
                className="w-full py-6 rounded-2xl h-auto" 
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles size={18} className="mr-2" />}
                {generating ? 'Generating Content...' : 'Generate Draft'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Review Modal */}
      {editModal && currentPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-warm-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-warm-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-warm-900">{currentPost._id ? 'Edit Post' : 'Review & Save'}</h3>
              <button onClick={() => setEditModal(false)} className="text-warm-400 hover:text-warm-900"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">Title</label>
                  <Input 
                    value={currentPost.title} 
                    onChange={e => setCurrentPost({...currentPost, title: e.target.value})}
                    className="rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">Category</label>
                  <select 
                    value={currentPost.category}
                    onChange={e => setCurrentPost({...currentPost, category: e.target.value})}
                    className="w-full h-12 bg-warm-50 border border-warm-200 rounded-xl px-4 text-sm focus:outline-none focus:border-fox-500"
                  >
                    <option>Engineering</option>
                    <option>Design</option>
                    <option>Business</option>
                    <option>AI & Future</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">Status</label>
                  <select 
                    value={currentPost.status}
                    onChange={e => setCurrentPost({...currentPost, status: e.target.value})}
                    className="w-full h-12 bg-warm-50 border border-warm-200 rounded-xl px-4 text-sm focus:outline-none focus:border-fox-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-3 bg-warm-50 p-4 rounded-2xl border border-warm-100">
                  <input 
                    type="checkbox" 
                    id="featured"
                    checked={currentPost.featured || false}
                    onChange={e => setCurrentPost({...currentPost, featured: e.target.checked})}
                    className="w-5 h-5 accent-fox-500 rounded-lg cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="featured" className="text-sm font-bold text-warm-900 cursor-pointer block">Featured Insight</label>
                    <p className="text-[10px] text-warm-500 font-medium">If checked, this post will appear in the "Latest Insights" section on the homepage.</p>
                  </div>
                  <Star size={20} className={currentPost.featured ? "text-amber-400 fill-amber-400" : "text-warm-200"} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">Content (HTML/Rich Text)</label>
                <textarea 
                  value={currentPost.content}
                  onChange={e => setCurrentPost({...currentPost, content: e.target.value})}
                  rows={10}
                  className="w-full bg-warm-50 border border-warm-200 rounded-2xl p-4 text-sm font-mono focus:outline-none focus:border-fox-500"
                />
              </div>
            </div>

            <div className="p-8 border-t border-warm-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving} className="px-8">
                {saving ? <Loader2 className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                {currentPost._id ? 'Update Post' : 'Save & Publish'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

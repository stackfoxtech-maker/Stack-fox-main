import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, Calendar, User, Share2, 
  Linkedin, Twitter, MessageCircle, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, Button, Spinner } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';
import { useEffect, useState } from 'react';
import api from '@lib/api';

export default function BlogPost() {
  const { id } = useParams(); // This is the slug
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  
  usePageTitle(post?.title || 'Blog Post');

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await api.get(`/blog/${id}`);
        setPost(res.data.data.post);
      } catch (err) {
        // Try to find in static data as fallback
        const staticPost = data.resources?.find(p => p.id === id);
        if (staticPost) {
          setPost(staticPost);
        } else {
          toast.error('Post not found');
          navigate('/resources');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
    window.scrollTo(0, 0);
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!post) {
    return (
      <Section className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-warm-900 mb-2">Post not found</h2>
        <p className="text-warm-500 mb-6">The article you're looking for might have been moved or removed.</p>
        <Link to="/resources" className="btn-fox px-6 py-2">Back to Blog</Link>
      </Section>
    );
  }

  const relatedPosts = data.resources
    ?.filter(p => p.id !== post.id && p.category === post.category)
    .slice(0, 2);

  return (
    <div className="bg-white min-h-screen">
      {/* Article Header */}
      <div className="bg-warm-50/50 border-b border-warm-100 py-12 md:py-20">
        <div className="container-fx">
          <Link 
            to="/resources" 
            className="inline-flex items-center gap-2 text-sm font-bold text-warm-500 hover:text-fox-500 transition-colors mb-8 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
            Back to Articles
          </Link>

          <div className="max-w-3xl">
            <span className="px-3 py-1 rounded-full bg-fox-500 text-[10px] font-bold text-white uppercase tracking-widest mb-6 inline-block">
              {post.category}
            </span>
            <h1 className="text-display-md md:text-display-lg text-warm-900 mb-8 leading-[1.1] tracking-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-fox-50 border border-fox-100 overflow-hidden flex items-center justify-center text-sm font-bold text-fox-600">
                  {post.author?.avatar ? (
                    <img src={post.author.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (post.author?.name || post.author || 'A').charAt(0)
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-warm-900">{post.author?.name || post.author || 'StackFox Team'}</div>
                  <div className="text-[10px] text-warm-400 font-bold uppercase tracking-wider">Expert Contributor</div>
                </div>
              </div>
              <div className="h-8 w-px bg-warm-200 hidden sm:block" />
              <div className="flex items-center gap-4 text-xs text-warm-500 font-medium">
                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-warm-300" /> {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : post.date}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-warm-300" /> {post.readTime} min read</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section className="py-12 md:py-20">
        <div className="container-fx">
          <div className="grid lg:grid-cols-12 gap-12">
            {/* Sidebar / Sharing */}
            <div className="lg:col-span-1 lg:sticky lg:top-32 h-fit">
              <div className="flex lg:flex-col gap-4 items-center justify-center lg:justify-start">
                <span className="text-[10px] font-black uppercase text-warm-400 lg:mb-2 vertical-text lg:rotate-0">Share</span>
                <button className="w-10 h-10 rounded-full border border-warm-200 flex items-center justify-center text-warm-400 hover:border-fox-500 hover:text-fox-500 transition-all">
                  <Linkedin size={18} />
                </button>
                <button className="w-10 h-10 rounded-full border border-warm-200 flex items-center justify-center text-warm-400 hover:border-blue-400 hover:text-blue-400 transition-all">
                  <Twitter size={18} />
                </button>
                <button className="w-10 h-10 rounded-full border border-warm-200 flex items-center justify-center text-warm-400 hover:border-green-500 hover:text-green-500 transition-all">
                  <MessageCircle size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <article className="lg:col-span-8 max-w-none">
              <div 
                className="blog-content text-body-lg text-warm-700"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Author Bio Section */}
              <div className="mt-20 p-8 rounded-3xl bg-warm-50 border border-warm-100 flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-fox-500 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0 overflow-hidden">
                  {post.author?.avatar ? (
                    <img src={post.author.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (post.author?.name || post.author || 'A').charAt(0)
                  )}
                </div>
                <div className="text-center md:text-left">
                  <h4 className="text-lg font-bold text-warm-900 mb-2">Written by {post.author?.name || post.author || 'StackFox Team'}</h4>
                  <p className="text-sm text-warm-500 leading-relaxed mb-4">
                    The StackFox team focuses on delivering high-performance, scalable tech solutions for modern businesses. We share our learnings to help the Indian ecosystem build better products.
                  </p>
                  <Link to="/contact" className="text-fox-500 text-sm font-bold hover:underline">Work with us →</Link>
                </div>
              </div>
            </article>

            {/* Related Sidebar */}
            <div className="lg:col-span-3 space-y-8">
              <h4 className="text-xs font-black uppercase tracking-widest text-warm-900 border-b border-warm-100 pb-4">
                Related Reading
              </h4>
              <div className="space-y-6">
                {relatedPosts?.map(rp => (
                  <Link key={rp.id} to={`/resources/${rp.id}`} className="group block">
                    <span className="text-[10px] font-bold text-fox-500 uppercase mb-1 block">{rp.category}</span>
                    <h5 className="text-sm font-bold text-warm-900 group-hover:text-fox-600 transition-colors leading-snug">
                      {rp.title}
                    </h5>
                    <p className="text-xs text-warm-500 mt-2 line-clamp-2">{rp.excerpt}</p>
                  </Link>
                ))}
                
                <div className="bg-fox-500 rounded-2xl p-6 text-white">
                  <h5 className="text-lg font-bold mb-2">Have a project in mind?</h5>
                  <p className="text-white/80 text-xs mb-4 leading-relaxed">Let's turn your idea into a high-performance reality.</p>
                  <Link to="/builder" className="inline-block bg-white text-fox-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-warm-50 transition-colors">
                    Start Building
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

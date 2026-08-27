import { useEffect, useState } from 'react';
import { Star, ClipboardCheck, Clock, Send } from 'lucide-react';
import { Badge } from '@components/ui/Primitives';
import { formatDate } from '@lib/utils';
import api from '@lib/api';
import toast from 'react-hot-toast';

export default function Reviews() {
  const [tab, setTab] = useState('completed');
  const [formRating, setFormRating] = useState(0);
  const [formHover, setFormHover] = useState(0);
  const [formText, setFormText] = useState('');
  const [reviewFor, setReviewFor] = useState('');
  const [completedReviews, setCompletedReviews] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/reviews/my').then((r) => setCompletedReviews(r.data.data || [])).catch(() => toast.error('Failed to load reviews.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get('/reviews/pending').then((r) => {
      const pending = r.data.data || [];
      setPendingRequests(pending);
      if (pending.length > 0 && !reviewFor) setReviewFor(pending[0].revieweeId);
    }).catch(() => toast.error('Failed to load pending reviews.'));
  }, []);

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} className={s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-warm-200'} />
      ))}
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formRating || !formText || !reviewFor) return;
    setSubmitting(true);
    try {
      await api.post('/reviews', { revieweeId: reviewFor, rating: formRating, comment: formText, period: new Date().getFullYear().toString() });
      toast.success('Review submitted successfully');
      setFormRating(0);
      setFormText('');
      setTab('completed');
      api.get('/reviews/my').then((r) => setCompletedReviews(r.data.data || [])).catch(() => toast.error('Failed to refresh reviews.'));
      api.get('/reviews/pending').then((r) => setPendingRequests(r.data.data || [])).catch(() => toast.error('Failed to refresh pending reviews.'));
    } catch {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-warm-200 border-t-fox-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-warm-900">Performance Reviews</h2>

      <div className="flex gap-1 bg-warm-50 rounded-xl p-1">
        {[{ key: 'completed', label: 'Completed', icon: ClipboardCheck }, { key: 'pending', label: 'Pending', icon: Clock }, { key: 'submit', label: 'Submit Review', icon: Send }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white text-fox-500 shadow-sm' : 'text-warm-500 hover:text-warm-700'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'completed' && (
        <div className="space-y-3">
          {completedReviews.length === 0 ? (
            <p className="text-sm text-warm-400 text-center py-8">No completed reviews yet.</p>
          ) : (
            completedReviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-warm-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-warm-900 text-sm">{r.period} Review</h3>
                    <p className="text-xs text-warm-500">By {r.reviewer?.name || r.reviewerId?.slice(-4)} &middot; {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(r.rating)}
                    <span className="text-sm font-bold text-warm-800">{r.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-warm-600 bg-warm-50 rounded-xl p-3">{r.comment}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'pending' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-warm-400 text-center py-8">No pending review requests.</p>
          ) : (
            pendingRequests.map((r) => (
              <div key={r.projectId || r.revieweeId} className="bg-white rounded-2xl border border-warm-200 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-fox-500/10 flex items-center justify-center text-fox-500 text-xs font-bold">{(r.revieweeName || '?')[0]}</div>
                  <div>
                    <p className="text-sm font-medium text-warm-900">{r.revieweeName || 'Unknown'}</p>
                    <p className="text-xs text-warm-500">Project: {r.projectId || r.period}</p>
                  </div>
                </div>
                <div className="text-right">
                  <button onClick={() => { setReviewFor(r.revieweeId); setTab('submit'); }} className="block text-xs text-fox-500 hover:underline">Write Review</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'submit' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-warm-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">Review For</label>
            <select value={reviewFor} onChange={(e) => setReviewFor(e.target.value)} className="w-full border border-warm-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30">
              {pendingRequests.map((p) => <option key={p.revieweeId || p.projectId} value={p.revieweeId}>{p.revieweeName} - {p.projectId || p.period}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button type="button" key={s} onClick={() => setFormRating(s)} onMouseEnter={() => setFormHover(s)} onMouseLeave={() => setFormHover(0)}>
                  <Star size={28} className={`${(formHover || formRating) >= s ? 'text-amber-400 fill-amber-400' : 'text-warm-200'} transition-colors`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">Feedback</label>
            <textarea value={formText} onChange={(e) => setFormText(e.target.value)} rows={4} placeholder="Share your observations about their performance..."
              className="w-full border border-warm-200 rounded-xl px-4 py-3 text-sm placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none" />
          </div>
          <button type="submit" disabled={!formRating || !formText || submitting} className="px-6 py-2.5 rounded-xl bg-fox-500 text-white text-sm font-medium hover:bg-fox-600 transition disabled:opacity-40 flex items-center gap-2">
            <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      )}
    </div>
  );
}

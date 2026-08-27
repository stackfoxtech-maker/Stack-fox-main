import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@lib/api';

const QUESTIONS = [
  { id: 'q1', label: 'What do you need?' },
  { id: 'q2', label: 'Describe your project briefly' },
  { id: 'q3', label: 'Select features (AI-suggested)' },
  { id: 'q4', label: 'Budget range', options: ['< Rs 25K', 'Rs 25K-1L', 'Rs 1L-3L', 'Rs 3L-5L', 'Rs 5L-10L', 'Rs 10L+'] },
  { id: 'q5', label: 'Timeline', options: ['ASAP', '1 month', '1-3 months', '3+ months'] },
];

const TIERS = [
  { id: 'STARTER', name: 'Starter', range: 'Rs 5K - 1L' },
  { id: 'GROWTH', name: 'Growth', range: 'Rs 1L - 1.5L' },
  { id: 'PREMIUM', name: 'Premium', range: 'Rs 1.5L+' },
];

export default function Estimator() {
  const [answers, setAnswers] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (qid, val) => setAnswers((prev) => ({ ...prev, [qid]: val }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/tools/estimate', answers);
      setRecommendation(res.data.recommendation);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate estimate. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm text-orange-600 font-semibold mb-2">Free Tool · Powered by StackFox</p>
      <h1 className="text-4xl font-bold mb-3">Instant Project Estimator</h1>
      <p className="text-gray-600 mb-8">Answer 5 quick questions and get a recommended service tier + range in under 2 seconds.</p>

      <form onSubmit={submit} className="bg-white border rounded-2xl p-6 mb-10 space-y-6">
        {QUESTIONS.map((q, qi) => (
          <div key={q.id} className="pb-4">
            <label className="block text-lg font-semibold mb-2">{qi + 1}. {q.label}</label>
            {q.options ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update(q.id, opt)}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                      answers[q.id] === opt
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-gray-300 text-gray-600 hover:border-orange-500 hover:text-orange-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                value={answers[q.id] || ''}
                onChange={(e) => update(q.id, e.target.value)}
                placeholder="Type here…"
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
          </div>
        ))}

        <button type="submit" disabled={loading} className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
          {loading ? 'Calculating…' : 'Get Instant Estimate'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      {recommendation && (
        <div className="bg-[#FAFAF8] border rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Recommended for you</h2>
          <div className="text-3xl font-extrabold text-orange-600 mb-1">{recommendation.recommendedTier || recommendation.tierName || 'GROWTH'}</div>
          <div className="text-sm text-gray-500 mb-6">{recommendation.priceRange || ''}</div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={`/builder?tier=${recommendation.tier || 'GROWTH'}`} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Configure & Price</Link>
            <Link to="/contact" className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">Talk to Expert</Link>
          </div>
        </div>
      )}
    </div>
  );
}

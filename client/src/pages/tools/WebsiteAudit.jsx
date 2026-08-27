import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@lib/api';

const DIMENSIONS = [
  { key: 'performance', label: 'Performance', weight: 25 },
  { key: 'seo', label: 'SEO', weight: 25 },
  { key: 'security', label: 'Security', weight: 20 },
  { key: 'accessibility', label: 'Accessibility', weight: 15 },
  { key: 'mobile', label: 'Mobile', weight: 10 },
  { key: 'design', label: 'Design/UX', weight: 5 },
];

export default function WebsiteAudit() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const runAudit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/tools/audit', { url: url.trim(), email: email.trim() || undefined });
      setReport(res.data.report);
    } catch (err) {
      setError(err.response?.data?.error || 'Audit failed. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p className="text-sm text-orange-600 font-semibold mb-2">Free Tool · Powered by StackFox</p>
      <h1 className="text-4xl font-bold mb-3">Free AI Website Audit</h1>
      <p className="text-gray-600 mb-8">Enter your URL and get a scored report across 6 dimensions — with actionable fixes mapped to StackFox services.</p>

      <form onSubmit={runAudit} className="bg-white border rounded-2xl p-6 mb-10">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Website URL</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email (for full report)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running audit…' : 'Run Free Audit'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="bg-[#FAFAF8] border rounded-xl p-3 text-center">
            <div className="font-semibold text-sm">{d.label}</div>
            <div className="text-xs text-gray-500">{d.weight}% of score</div>
          </div>
        ))}
      </div>

      {report && (
        <div className="bg-white border rounded-2xl p-6 mb-10">
          <h2 className="text-2xl font-bold mb-4">Your Audit Report</h2>
          {typeof report === 'string' ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-xl p-4">{report}</pre>
          ) : (
            <div className="space-y-4">
              {Object.entries(report).map(([k, v]) => (
                <div key={k} className="border-b pb-3">
                  <h3 className="font-semibold capitalize mb-1">{k.replace(/_/g, ' ')}</h3>
                  <div className="text-sm text-gray-600">{typeof v === 'string' ? v : JSON.stringify(v)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/catalog" className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Fix Issues — View Services</Link>
            <Link to="/tools/estimator" className="px-5 py-2.5 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">Get an Estimate</Link>
          </div>
        </div>
      )}
    </div>
  );
}
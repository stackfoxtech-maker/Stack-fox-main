import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@lib/api';

const INPUT_MODES = ['Voice note', 'Sketch/image', 'Competitor URL', 'Free text'];

export default function BriefBuilder() {
  const [mode, setMode] = useState('Voice note');
  const [inputValue, setInputValue] = useState('');
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/tools/brief', { mode, input: inputValue.trim() });
      setBrief(res.data.brief);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate brief. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm text-orange-600 font-semibold mb-2">Free Tool · Powered by StackFox</p>
      <h1 className="text-4xl font-bold mb-3">AI Brief Generator</h1>
      <p className="text-gray-600 mb-8">Turn a rough idea into a structured project brief in under 30 seconds.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {INPUT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setInputValue(''); }}
            className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
              mode === m ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 text-gray-600 hover:border-purple-500 hover:text-purple-600'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <form onSubmit={generate} className="bg-white border rounded-2xl p-6 mb-10">
        <label className="block text-sm font-semibold mb-2">
          {mode === 'Voice note' ? 'Record your voice note' : mode === 'Competitor URL' ? 'Enter competitor URL' : mode === 'Sketch/image' ? 'Upload a sketch or image' : 'Describe your project'}
        </label>
        {mode === 'Voice note' ? (
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe your business, services, contact details, SEO keywords…"
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[140px]"
          />
        ) : mode === 'Competitor URL' ? (
          <input
            type="url"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="https://competitor.com"
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        ) : mode === 'Sketch/image' ? (
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setInputValue(f.name);
            }}
            className="w-full border rounded-xl px-4 py-3"
          />
        ) : (
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe your project…"
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[140px]"
          />
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate Brief'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      {brief && (
        <div className="bg-[#FAFAF8] border rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Your Brief</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-xl p-4">{brief}</pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/builder" className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700">Load into Builder</Link>
            <Link to="/tools/estimator" className="px-5 py-2.5 border-2 border-purple-500 text-purple-600 rounded-xl font-semibold hover:bg-purple-50">Estimate This Brief</Link>
          </div>
        </div>
      )}
    </div>
  );
}
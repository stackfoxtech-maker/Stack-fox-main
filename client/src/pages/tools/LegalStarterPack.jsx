import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiPost } from '@lib/api';

const FIELDS = [
  { id: 'businessName', label: 'Business name' },
  { id: 'website', label: 'Website URL' },
  { id: 'email', label: 'Contact email' },
  { id: 'address', label: 'Registered address' },
  { id: 'gstin', label: 'GSTIN (optional)' },
  { id: 'governance', label: 'Governing state (e.g. Rajasthan)' },
];

export default function LegalStarterPack() {
  const [form, setForm] = useState({});
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (id, val) => setForm((p) => ({ ...p, [id]: val }));

  const generate = async (e) => {
    e.preventDefault();
    if (!form.businessName || !form.email) {
      setError('Please fill business name and email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/tools/legal', { templateType: 'starter-pack', params: form });
      setDocs(res.data.document);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate documents. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm text-orange-600 font-semibold mb-2">Free Tool · Powered by StackFox</p>
      <h1 className="text-4xl font-bold mb-3">Legal Starter Pack</h1>
      <p className="text-gray-600 mb-8">Generate DPDP Act 2023 compliant Privacy Policy, Terms & Conditions, and Refund Policy for your business instantly.</p>

      <form onSubmit={generate} className="bg-white border rounded-2xl p-6 mb-8">
        <div className="grid md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.id} className={f.id === 'governance' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-semibold mb-1">{f.label}</label>
              <input
                value={form[f.id] || ''}
                onChange={(e) => update(f.id, e.target.value)}
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors mt-4"
        >
          {loading ? 'Generating…' : 'Generate Legal Documents'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      {docs && (
        <div className="bg-[#FAFAF8] border rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Your Legal Documents</h2>

          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-xl p-4 max-h-[400px] overflow-auto">
            {docs}
          </pre>

          <p className="mt-4 text-xs text-gray-500">
            AI-generated starter templates — have a lawyer review before use.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigator.clipboard?.writeText(docs).then(
                () => toast.success('Copied to clipboard'),
                () => {},
              )}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600"
            >
              Copy Documents
            </button>
            <Link to="/contact" className="px-5 py-2.5 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">
              Get Expert Legal Review
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
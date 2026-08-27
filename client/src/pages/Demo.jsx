import { useState } from 'react';
import { apiPost } from '@lib/api';

export default function Demo() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [team, setTeam] = useState('small');
  const [challenge, setChallenge] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiPost('/lead/demo', { name, email, phone, team, challenge });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Thanks, {name}!</h1>
        <p className="text-gray-600 mb-8">A StackFox expert will reach out within 2 business hours to schedule your personalized demo.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Book a demo</p>
      <h1 className="text-3xl font-bold mb-8">See StackFox in action</h1>
      <p className="text-gray-600 mb-8">30-minute walkthrough of how StackFox accelerates software delivery with AI.</p>

      <form onSubmit={submit} className="bg-white border rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Work email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Team size</label>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="small">1-10 employees</option>
            <option value="medium">11-100 employees</option>
            <option value="large">100+ employees</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Biggest challenge</label>
          <textarea value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder="e.g. hiring slow, missed deadlines, budget overruns…" className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[100px]" />
        </div>
        <button type="submit" disabled={loading} className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
          {loading ? 'Scheduling…' : 'Schedule My Demo'}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

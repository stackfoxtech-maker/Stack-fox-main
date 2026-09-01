import { useState } from 'react';
import { FileUp, Send } from 'lucide-react';
import { apiPost } from '@lib/api';
import toast from 'react-hot-toast';

const industries = ['Technology', 'Healthcare', 'E-Commerce', 'Education', 'Finance', 'Real Estate', 'Manufacturing', 'Other'];
const budgets = ['Under ₹50,000', '₹50,000 – ₹2,00,000', '₹2,00,000 – ₹5,00,000', '₹5,00,000 – ₹10,00,000', 'Above ₹10,00,000'];
const timelines = ['Less than 1 month', '1 – 3 months', '3 – 6 months', '6 – 12 months', 'Ongoing / Retainer'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RFPSubmit() {
  const [form, setForm] = useState({ name: '', email: '', company: '', industry: '', description: '', budget: '', timeline: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit =
    form.name && EMAIL_RE.test(form.email) && form.company &&
    form.industry && form.description && form.budget && form.timeline;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await apiPost('/lead/demo', {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        source: 'rfp',
        message: [
          `Industry: ${form.industry}`,
          `Budget: ${form.budget}`,
          `Timeline: ${form.timeline}`,
          '',
          form.description.trim(),
        ].join('\n'),
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-fox-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="text-fox-500" size={28} />
          </div>
          <h2 className="text-2xl font-bold text-warm-900 mb-2">RFP received</h2>
          <p className="text-warm-500 text-sm">
            Our team will review it and get back to <strong>{form.email}</strong> within 2 business days.
            Have a brief document? Reply to our confirmation email with it attached.
          </p>
          <a href="/" className="inline-block mt-5 text-fox-500 font-semibold text-sm hover:underline">Back to home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-warm-900 mb-2 flex items-center gap-3">
          <FileUp className="text-fox-500" /> Submit an RFP
        </h1>
        <p className="text-warm-500 mb-8">Tell us about your project and we will prepare a detailed proposal.</p>

        <div className="bg-white rounded-2xl border border-warm-200 p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">Your Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">Work Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Company Name *</label>
            <input value={form.company} onChange={e => set('company', e.target.value)} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Industry *</label>
            <select value={form.industry} onChange={e => set('industry', e.target.value)} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 bg-white">
              <option value="">Select industry</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Project Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none" placeholder="Describe your project requirements, goals, and any specific needs..." />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">Budget Range *</label>
              <select value={form.budget} onChange={e => set('budget', e.target.value)} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 bg-white">
                <option value="">Select budget</option>
                {budgets.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">Timeline *</label>
              <select value={form.timeline} onChange={e => set('timeline', e.target.value)} className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 bg-white">
                <option value="">Select timeline</option>
                {timelines.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button onClick={submit} disabled={!canSubmit || busy} className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition ${canSubmit && !busy ? 'bg-fox-500 text-white hover:bg-fox-600' : 'bg-warm-200 text-warm-400 cursor-not-allowed'}`}>
            <Send size={18} /> {busy ? 'Submitting…' : 'Submit RFP'}
          </button>
        </div>
      </div>
    </div>
  );
}

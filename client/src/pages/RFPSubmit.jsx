import { useState } from 'react';
import { FileUp, Send, Upload } from 'lucide-react';

const industries = ['Technology', 'Healthcare', 'E-Commerce', 'Education', 'Finance', 'Real Estate', 'Manufacturing', 'Other'];
const budgets = ['Under ₹50,000', '₹50,000 – ₹2,00,000', '₹2,00,000 – ₹5,00,000', '₹5,00,000 – ₹10,00,000', 'Above ₹10,00,000'];
const timelines = ['Less than 1 month', '1 – 3 months', '3 – 6 months', '6 – 12 months', 'Ongoing / Retainer'];

export default function RFPSubmit() {
  const [form, setForm] = useState({ company: '', industry: '', description: '', budget: '', timeline: '', file: null });
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });
  const canSubmit = form.company && form.industry && form.description && form.budget && form.timeline;

  if (submitted) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-warm-200 p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-fox-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="text-fox-500" size={28} />
          </div>
          <h2 className="text-2xl font-bold text-warm-900 mb-2">RFP Submitted!</h2>
          <p className="text-warm-500 text-sm">Our team will review your proposal and get back within 2 business days.</p>
          <a href="/rfp" className="inline-block mt-5 text-fox-500 font-semibold text-sm hover:underline">View My Submissions</a>
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

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Attachments (Optional)</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-warm-200 rounded-xl py-6 cursor-pointer hover:border-fox-500/40 transition text-sm text-warm-500">
              <Upload size={18} />
              {form.file ? form.file.name : 'Click to upload files (PDF, DOC, images)'}
              <input type="file" className="hidden" onChange={e => set('file', e.target.files[0])} />
            </label>
          </div>

          <button onClick={() => canSubmit && setSubmitted(true)} disabled={!canSubmit} className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition ${canSubmit ? 'bg-fox-500 text-white hover:bg-fox-600' : 'bg-warm-200 text-warm-400 cursor-not-allowed'}`}>
            <Send size={18} /> Submit RFP
          </button>
        </div>
      </div>
    </div>
  );
}

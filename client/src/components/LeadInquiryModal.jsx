import { useState } from 'react';
import { X } from 'lucide-react';
import { apiPost } from '@lib/api';
import toast from 'react-hot-toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Small "get in touch" modal used by the public marketing pages. Submissions
 * land in the Lead table (via /lead/demo) and show up in the sales CRM.
 *
 * Props: { title, subtitle?, source, context?, onClose }
 */
export default function LeadInquiryModal({ title, subtitle, source, context, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = form.name && EMAIL_RE.test(form.email);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await apiPost('/lead/demo', {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        source,
        message: [context, form.message.trim()].filter(Boolean).join('\n\n'),
      });
      setDone(true);
    } catch {
      toast.error('Could not submit — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-warm-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-5 right-5 p-1.5 rounded-full text-warm-400 hover:bg-warm-100" aria-label="Close"><X size={18} /></button>

        {done ? (
          <div className="text-center py-4">
            <h3 className="text-xl font-bold text-warm-900 mb-2">Thanks — we&apos;ve got it</h3>
            <p className="text-sm text-warm-500 mb-6">Someone from the team will reach out to <strong>{form.email}</strong> within 2 business days.</p>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-fox-500 text-white text-sm font-semibold hover:bg-fox-600">Close</button>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-warm-900 mb-1">{title}</h3>
            {subtitle && <p className="text-sm text-warm-500 mb-5">{subtitle}</p>}
            <div className="space-y-3">
              <input placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-warm-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
              <input placeholder="Work email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-warm-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
              <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full border border-warm-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30" />
              <textarea placeholder="Tell us a bit about what you need" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full border border-warm-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/30 resize-none" />
            </div>
            <button onClick={submit} disabled={!canSubmit || busy} className={`w-full mt-4 py-3 rounded-xl font-semibold transition ${canSubmit && !busy ? 'bg-fox-500 text-white hover:bg-fox-600' : 'bg-warm-200 text-warm-400 cursor-not-allowed'}`}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

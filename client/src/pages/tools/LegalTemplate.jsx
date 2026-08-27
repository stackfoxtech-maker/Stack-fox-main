import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Scale, FileText, Eye, ArrowRight } from 'lucide-react';

const templates = [
  { id: 'nda', name: 'Non-Disclosure Agreement', desc: 'Protect confidential information shared between parties.', sections: ['Definitions', 'Obligations', 'Term & Termination', 'Remedies'] },
  { id: 'sla', name: 'Service Level Agreement', desc: 'Define service expectations, uptime guarantees, and support response times.', sections: ['Service Scope', 'Performance Metrics', 'Penalties', 'Reporting'] },
  { id: 'msa', name: 'Master Service Agreement', desc: 'Establish the overarching terms for an ongoing business relationship.', sections: ['Scope of Work', 'Payment Terms', 'IP Rights', 'Liability'] },
  { id: 'privacy', name: 'Privacy Policy', desc: 'Comply with data protection regulations and inform users of data practices.', sections: ['Data Collection', 'Usage', 'Third Parties', 'User Rights'] },
  { id: 'tos', name: 'Terms of Service', desc: 'Set the rules and guidelines users agree to when using your platform.', sections: ['Eligibility', 'Acceptable Use', 'Termination', 'Disclaimers'] },
];

export default function LegalTemplate() {
  usePageTitle('Legal Templates');
  const [preview, setPreview] = useState(null);

  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <Scale className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">Legal Templates</h1>
        <p className="text-warm-600">Professional legal documents ready for customization.</p>
      </div>

      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-warm-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-fox-500" />
                  <h3 className="font-semibold text-warm-900">{t.name}</h3>
                </div>
                <p className="text-sm text-warm-600 mb-3">{t.desc}</p>
                {preview === t.id && (
                  <div className="bg-warm-50 rounded-xl p-4 mb-3">
                    <p className="text-xs text-warm-500 uppercase tracking-wide mb-2">Sections Included</p>
                    <div className="flex flex-wrap gap-2">
                      {t.sections.map((s) => (
                        <span key={s} className="text-xs bg-white border border-warm-200 rounded-full px-3 py-1 text-warm-700">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button onClick={() => setPreview(preview === t.id ? null : t.id)} className="flex items-center gap-1 text-sm text-warm-500 hover:text-warm-700 border border-warm-200 rounded-xl px-4 py-2">
                  <Eye className="w-4 h-4" /> {preview === t.id ? 'Hide' : 'Preview'}
                </button>
                <button className="flex items-center gap-1 text-sm bg-fox-500 text-white rounded-xl px-4 py-2 hover:bg-fox-600 transition">
                  Request <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

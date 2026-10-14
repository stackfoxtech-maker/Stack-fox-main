import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import faqs from '@data/faqs.json';
import { usePageTitle } from '@lib/hooks';

export default function FAQ() {
  usePageTitle(
    'FAQ: pricing, timelines, payments and support',
    'Answers on how StackFox pricing works, payment methods, project timelines, refunds, revisions, NDAs and ongoing support.',
  );
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const filtered = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold text-warm-900 text-center mb-2">
        Frequently Asked Questions
      </h1>
      <p className="text-warm-500 text-center mb-8">
        Everything you need to know about working with StackFox.
      </p>

      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-warm-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fox-500/20 focus:border-fox-500"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((f, i) => (
          <div key={i} className="bg-white rounded-md border border-warm-200 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <span className="font-medium text-warm-900 text-sm">{f.q}</span>
              <ChevronDown
                size={18}
                className={`text-warm-400 transition-transform ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            {open === i && (
              <div className="px-6 pb-4 text-sm text-warm-600 leading-relaxed">{f.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

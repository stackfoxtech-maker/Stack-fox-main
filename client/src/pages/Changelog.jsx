import { Link } from 'react-router-dom';

const versions = [
  {
    version: 'v3.1',
    date: '2026-08-15',
    changes: [
      'Added 5 free acquisition tools (audit, estimator, brief, legal, invoice)',
      'Express checkout for the Starter tier',
      '625+ SEO content pages for services (cost/timeline)',
      'Public roadmap and changelog pages',
      'Quiz lead-capture funnel',
    ],
  },
  {
    version: 'v3.0',
    date: '2026-07-01',
    changes: [
      'Catalogue v2: 123 services mapped with cost/timeline',
      'Builder drag-and-drop interface',
      'Instant estimates engine',
      'Razorpay integration',
    ],
  },
  {
    version: 'v2.9',
    date: '2026-05-12',
    changes: [
      'Client dashboard scaffold (G1-G11)',
      'Team dashboard scaffold (H1-H8)',
      'Admin dashboard scaffold',
    ],
  },
  {
    version: 'v2.5',
    date: '2024-09-10',
    changes: ['Initial public site launch', 'Catalogue MVP'],
  },
];

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Changelog</p>
      <h1 className="text-3xl font-bold mb-8">What we shipped</h1>
      <p className="text-gray-600 mb-10">All notable changes to the StackFox platform.</p>

      <div className="space-y-10">
        {versions.map((v) => (
          <div key={v.version} className="border-b pb-4">
            <div className="flex items-baseline gap-4">
              <span className="text-xl font-bold">{v.version}</span>
              <span className="text-sm text-gray-500">{v.date}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc list-inside">
              {v.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Ideas welcome</h2>
        <p className="text-gray-600 mb-4">
          <Link to="/roadmap" className="text-orange-600 underline">View our roadmap</Link> or <Link to="/contact" className="text-orange-600 underline">tell us what you want</Link>.
        </p>
      </div>
    </div>
  );
}

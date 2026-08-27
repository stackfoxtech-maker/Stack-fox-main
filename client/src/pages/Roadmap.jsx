import { Link } from 'react-router-dom';

const QUARTERS = [
  {
    q: 'Q3 2025',
    items: [
      { t: 'Catalogue MVP', status: 'done' },
      { t: 'Builder (drag-drop)', status: 'done' },
      { t: 'Instant Estimates', status: 'done' },
    ],
  },
  {
    q: 'Q4 2025',
    items: [
      { t: 'Starter tier (flat price)', status: 'done' },
      { t: 'Express checkout', status: 'inprogress' },
      { t: '5 acquisition tools', status: 'inprogress' },
      { t: 'Aadhaar eSign', status: 'pending' },
    ],
  },
  {
    q: 'Q1 2026',
    items: [
      { t: 'Growth tier', status: 'pending' },
      { t: 'Tier-adaptive checkout', status: 'pending' },
      { t: 'Client dashboard G1-G11', status: 'pending' },
    ],
  },
  {
    q: 'Q2 2026',
    items: [
      { t: 'Premium tier', status: 'pending' },
      { t: 'Public API and webhooks', status: 'pending' },
      { t: 'WhatsApp Commerce', status: 'pending' },
    ],
  },
  {
    q: 'Q3 2026',
    items: [
      { t: '168 remaining SDPs', status: 'pending' },
      { t: 'Referral engine', status: 'pending' },
      { t: '625+ SEO pages', status: 'pending' },
    ],
  },
];

const STATUS_COLOR = {
  done: 'bg-green-500',
  inprogress: 'bg-orange-500',
  pending: 'bg-gray-300',
};

export default function Roadmap() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Public Roadmap</p>
      <h1 className="text-3xl font-bold mb-8">StackFox - What is next?</h1>
      <p className="text-gray-600 mb-10 max-w-2xl">Our public Now / Next / Later board. Everything shipped, in progress, and on the horizon.</p>

      <div className="space-y-10">
        {QUARTERS.map((q) => (
          <div key={q.q}>
            <h2 className="text-xl font-bold text-gray-800 mb-3">{q.q}</h2>
            {q.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[item.status]}`} />
                <span className={item.status === 'done' ? 'line-through text-gray-500' : 'text-gray-800'}>{item.t}</span>
                {item.status === 'inprogress' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">In progress</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-12 bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Have an idea?</h2>
        <p className="text-gray-600 mb-4">Missing something? Tell us what you want to see next.</p>
        <Link to="/contact" className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Request a Feature</Link>
      </div>
    </div>
  );
}

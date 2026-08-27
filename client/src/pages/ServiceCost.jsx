import { useParams, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useCatalogue } from '@lib/useStorefrontData';
import { Spinner } from '@components/ui/Primitives';

const TIERS = [
  { id: 'STARTER', name: 'Starter', tag: 'AI-accelerated, flat price', card: 'border-orange-500', btn: 'bg-orange-500 hover:bg-orange-600', text: 'text-orange-600' },
  { id: 'GROWTH', name: 'Growth', tag: 'Balanced human + AI', card: 'border-blue-500', btn: 'bg-blue-500 hover:bg-blue-600', text: 'text-blue-600' },
  { id: 'PREMIUM', name: 'Premium', tag: 'Dedicated team, white-glove', card: 'border-purple-500', btn: 'bg-purple-600 hover:bg-purple-700', text: 'text-purple-600' },
];

export default function ServiceCost() {
  const { services, categories, addons, loading } = useCatalogue();
  const { category, slug } = useParams();
  const service = services.find(s => (s.slug || s.id) === slug);
  const cat = categories.find(c => c.id === category) || categories[0];

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-24 text-center"><div className="flex justify-center"><Spinner size="lg" /></div></div>;
  if (!service) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Service not found</h1>
        <Link to="/catalog" className="text-orange-600 font-semibold">← Browse all services</Link>
      </div>
    );
  }

  const price = service.price ?? 0;
  const growthLow = Math.round(price * 0.85);
  const growthHigh = Math.round(price * 1.15);
  const premiumLow = Math.round(price * 1.6);
  const premiumHigh = Math.round(price * 2.5);

  const tierData = {
    STARTER: {
      display: `₹${price.toLocaleString('en-IN')}`,
      bullets: ['Flat price — no surprises', `${service.est || '5-7 day'} delivery`, '1 revision round', '30-day warranty'],
      cta: `/checkout/express?service=${service.id}`,
    },
    GROWTH: {
      display: `₹${growthLow.toLocaleString('en-IN')} – ₹${growthHigh.toLocaleString('en-IN')}`,
      bullets: ['±15% price band', 'Named project manager', '2 revision rounds', '30-day warranty'],
      cta: `/builder?service=${service.id}&tier=GROWTH`,
    },
    PREMIUM: {
      display: `₹${premiumLow.toLocaleString('en-IN')} – ₹${premiumHigh.toLocaleString('en-IN')}+`,
      bullets: ['Dedicated team + strategy phase', 'Unlimited revisions', 'White-glove service', 'SLA-backed delivery'],
      cta: `/builder?service=${service.id}&tier=PREMIUM`,
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-500 mb-6 flex flex-wrap gap-1 items-center">
        <Link to="/" className="hover:text-orange-600">Home</Link> <span>›</span>
        <Link to="/catalog" className="hover:text-orange-600">Services</Link> <span>›</span>
        <Link to={`/services/${category}`} className="hover:text-orange-600">{cat?.name}</Link> <span>›</span>
        <span className="text-gray-800">{service.name}</span> <span>›</span>
        <span className="text-gray-800 font-medium">Cost</span>
      </nav>

      <h1 className="text-4xl font-bold mb-2">{service.name} — Cost in India (2026)</h1>
      <p className="text-gray-600 mb-8 max-w-3xl">{service.lay}</p>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {TIERS.map(t => {
          const td = tierData[t.id];
          return (
            <div key={t.id} className={`border-2 ${t.card} bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">{t.name}</h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.text} bg-gray-50`}>{t.tag}</span>
              </div>
              <div className="text-3xl font-extrabold my-4">{td.display}</div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
                {td.bullets.map(b => (
                  <li key={b}>✓ {b}</li>
                ))}
              </ul>
              <Link
                to={td.cta}
                className={`block text-center py-3 rounded-xl font-semibold text-white ${t.btn} transition-colors`}
              >
                Get Started
              </Link>
            </div>
          );
        })}
      </div>

      <h2 className="text-2xl font-bold mb-4">What affects the price?</h2>
      <div className="bg-white rounded-2xl border p-6 mb-12 grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">Always included</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Project management & QA</li>
            <li>• 2 feedback rounds</li>
            <li>• 30-day warranty</li>
            <li>• Staging environment</li>
            <li>• Basic documentation</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Priced separately</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Content creation & copywriting</li>
            <li>• Stock photos & licences</li>
            <li>• Domain & hosting</li>
            <li>• Third-party integrations</li>
          </ul>
        </div>
      </div>

      {addons?.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mb-4">Popular add-ons</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {addons.slice(0, 6).map(a => (
              <div key={a.id} className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold mb-1">{a.name}</h3>
                {a.price != null && <div className="text-lg font-bold text-orange-600">₹{(a.price ?? 0).toLocaleString('en-IN')}</div>}
                {a.desc && <p className="text-sm text-gray-500 mt-1">{a.desc}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-gradient-to-br from-fox-500 to-fox-600 rounded-2xl p-8 text-center mb-12 shadow-lg shadow-fox-500/20">
        <h2 className="text-2xl font-bold mb-2 text-white">Not sure what you need?</h2>
        <p className="text-white/85 mb-6 max-w-md mx-auto">Answer 10 quick questions and let our AI advisor recommend the perfect services for your project.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/advisor" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-fox-600 shadow transition hover:bg-white/90 hover:shadow-lg">
            <Sparkles size={18} /> Start Advisor
          </Link>
          <Link to="/builder" className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
            Open the Builder
          </Link>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Related services in {cat?.name}</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {services.filter(s => s.catId === category && s.id !== service.id).slice(0, 6).map(s => (
          <Link key={s.id} to={`/services/${category}/${s.slug || s.id}`} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
            <h3 className="font-semibold">{s.name}</h3>
            <div className="text-orange-600 font-bold mt-1">₹{(s.price ?? 0).toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-500 mt-1">{s.est}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
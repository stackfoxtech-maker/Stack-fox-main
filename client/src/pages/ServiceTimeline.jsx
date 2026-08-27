import { useParams, Link } from 'react-router-dom';
import data from '@data/stackfox-data.json';

const { services, categories } = data;

export default function ServiceTimeline() {
  const { category, slug } = useParams();
  const service = services.find((s) => (s.slug || s.id) === slug);
  const cat = categories.find((c) => c.id === category) || categories[0];

  if (!service) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Service not found</h1>
        <Link to="/catalog" className="text-orange-600 font-semibold">
          {'<'} Browse all services
        </Link>
      </div>
    );
  }

  const estDays = parseInt(service.est || '7', 10);
  const stages = [
    { n: 1, name: 'Discovery and Planning', span: '1-2 days', desc: 'We understand your goal, review requirements, and send a kickoff checklist.' },
    { n: 2, name: 'Design', span: '20% of timeline', desc: 'Wireframes and UI designs. One revision round included (Starter) or two (Growth).' },
    { n: 3, name: 'Development', span: Math.round(estDays * 0.5) + '-' + Math.round(estDays * 0.6) + ' days', desc: 'Core building phase. You get a staging link to follow progress.' },
    { n: 4, name: 'Testing and QA', span: '2-3 days', desc: 'Cross-browser, responsive, performance and SEO checks.' },
    { n: 5, name: 'Review and Revisions', span: '1-3 days', desc: 'You review the work and request changes within the included rounds.' },
    { n: 6, name: 'Deployment and Handover', span: '1-2 days', desc: 'Live deployment, documentation, credentials, and source code handover.' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-500 mb-6 flex flex-wrap gap-1 items-center">
        <Link to="/" className="hover:text-orange-600">Home</Link> <span>{'>'}</span>
        <Link to="/catalog" className="hover:text-orange-600">Services</Link> <span>{'>'}</span>
        <Link to={`/services/${category}`} className="hover:text-orange-600">{cat?.name}</Link> <span>{'>'}</span>
        <span className="text-gray-800">{service.name}</span> <span>{'>'}</span>
        <span className="text-gray-800 font-medium">Timeline</span>
      </nav>

      <h1 className="text-4xl font-bold mb-4">How long does {service.name} take?</h1>
      <p className="text-lg text-gray-600 mb-8">Typical delivery: <strong>{service.est}</strong>. Rush delivery is available at a 20-40% acceleration.</p>

      <div className="relative border-l-2 border-orange-200 ml-4 space-y-8 mb-12">
        {stages.map((s, i) => (
          <div key={s.n} className="pl-8 relative">
            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow" />
            <div className="bg-white border rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h3 className="font-bold text-lg"><span className="text-orange-600">Stage {s.n}</span> — {s.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{s.span}</span>
              </div>
              <p className="text-sm text-gray-600">{s.desc}</p>
              {i === 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Link to={`/services/${category}/${service.slug || service.id}`} className="text-sm text-orange-600 font-semibold hover:underline">View full service</Link>
                  <Link to={`/services/${category}/${slug}/cost`} className="text-sm text-gray-500 hover:underline">See cost breakdown</Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">Want it faster?</h2>
        <p className="text-gray-600 mb-6">We offer rush delivery (up to 50% faster). Ask in the Builder or use the estimator.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/tools/estimator" className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Get Instant Estimate</Link>
          <Link to={`/services/${category}/${slug}/cost`} className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">See Pricing</Link>
        </div>
      </div>
    </div>
  );
}
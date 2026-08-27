import { useParams, Link } from 'react-router-dom';
import data from '@data/stackfox-data.json';

const { services, packages } = data;

export default function BundleDetail() {
  const { slug } = useParams();
  const bundle = packages.find((p) => (p.slug || p.id) === slug) || packages[0];

  if (!bundle) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Bundle not found</h1>
        <Link to="/packages" className="text-orange-600 font-semibold">Browse all bundles</Link>
      </div>
    );
  }

  const price = bundle.price || 0;
  const included = services.slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <Link to="/" className="hover:text-orange-600">Home</Link>
        <span>{'>'}</span>
        <Link to="/packages" className="hover:text-orange-600">Bundles</Link>
        <span>{'>'}</span>
        <span className="text-gray-800">{bundle.name}</span>
      </nav>

      <h1 className="text-4xl font-bold mb-2">{bundle.name}</h1>
      <p className="text-gray-600 mb-6 max-w-2xl">{bundle.desc || 'Complete solution bundle curated for your industry.'}</p>

      <div className="bg-[#FAFAF8] rounded-2xl p-8 text-center mb-12">
        <div className="text-4xl font-extrabold text-orange-600">Rs {price.toLocaleString('en-IN')}</div>
        <div className="text-sm text-gray-500 mt-1">{bundle.est || 'Delivered in 15-30 days'} · {bundle.serviceIds?.length || 6} services included</div>
      </div>

      <h2 className="text-2xl font-bold mb-4">What is included</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {included.map((s) => (
          <div key={s.id} className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold">{s.name}</h3>
            <div className="text-xs text-gray-500 mt-1">{s.est}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to={'/checkout/express?service=' + bundle.id} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Buy this bundle</Link>
        <Link to="/catalog" className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">Shop services individually</Link>
      </div>
    </div>
  );
}

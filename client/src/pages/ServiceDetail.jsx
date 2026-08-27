import { useState } from 'react';
import { ShoppingCart, Clock, Tag, MessageSquare, ArrowRight } from 'lucide-react';

const services = {
  1: { name: 'Website Development', category: 'Development', price: 45000, delivery: '15–20 days', description: 'Full-stack custom website built with modern technologies. Includes responsive design, CMS integration, SEO-ready structure, and deployment. We handle everything from wireframes to launch so you can focus on your business.' },
  2: { name: 'SEO Optimization', category: 'Marketing', price: 15000, delivery: '7–10 days', description: 'Comprehensive on-page and off-page SEO audit and implementation. Keyword research, meta tag optimization, content strategy, backlink analysis, and Google Search Console setup included.' },
  3: { name: 'Logo Design', category: 'Design', price: 5000, delivery: '3–5 days', description: 'Professional logo design with 3 initial concepts, unlimited revisions on the chosen direction, and final delivery in all formats (SVG, PNG, PDF). Brand color palette and typography guide included.' },
  4: { name: 'Mobile App Development', category: 'Development', price: 120000, delivery: '30–45 days', description: 'Cross-platform mobile application built with React Native. Includes UI/UX design, API integration, push notifications, and app store submission for both iOS and Android.' },
};

const related = [
  { id: 2, name: 'SEO Optimization', price: 15000, category: 'Marketing' },
  { id: 3, name: 'Logo Design', price: 5000, category: 'Design' },
  { id: 4, name: 'Mobile App Development', price: 120000, category: 'Development' },
];

export default function ServiceDetail() {
  const [added, setAdded] = useState(false);

  // In a real app: const { id } = useParams();
  const id = new URLSearchParams(window.location.search).get('id') || '1';
  const service = services[id] || services[1];

  return (
    <div className="min-h-screen bg-warm-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-warm-200 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-fox-500 bg-fox-500/10 px-3 py-1 rounded-full">{service.category}</span>
              <h1 className="text-3xl font-bold text-warm-900 mt-3">{service.name}</h1>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-fox-500">₹{service.price.toLocaleString()}</p>
              <p className="text-sm text-warm-500 flex items-center gap-1 justify-end mt-1"><Clock size={14} /> {service.delivery}</p>
            </div>
          </div>

          <p className="text-warm-600 leading-relaxed mb-8">{service.description}</p>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setAdded(true)} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition ${added ? 'bg-green-500 text-white' : 'bg-fox-500 text-white hover:bg-fox-600'}`}>
              <ShoppingCart size={18} /> {added ? 'Added to Cart' : 'Add to Cart'}
            </button>
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border border-warm-200 text-warm-700 hover:bg-warm-50 transition">
              <MessageSquare size={18} /> Request Custom Quote
            </button>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold text-warm-900 mb-5">Related Services</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {related.filter(r => String(r.id) !== String(id)).slice(0, 3).map(r => (
              <a key={r.id} href={`/service?id=${r.id}`} className="bg-white rounded-2xl border border-warm-200 p-5 hover:border-fox-500/40 transition block">
                <span className="text-xs font-medium text-warm-500">{r.category}</span>
                <h3 className="font-semibold text-warm-900 mt-1 mb-2">{r.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-fox-500">₹{r.price.toLocaleString()}</span>
                  <ArrowRight size={16} className="text-warm-400" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

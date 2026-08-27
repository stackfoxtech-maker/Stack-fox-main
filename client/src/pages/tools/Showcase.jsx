import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { Layout, ArrowRight } from 'lucide-react';

const filters = ['All', 'Web', 'Mobile', 'AI', 'E-Commerce'];

const projects = [
  { title: 'FinTrack Dashboard', category: 'Web', tags: ['React', 'Node.js', 'PostgreSQL'], desc: 'Real-time financial analytics platform with custom charts.' },
  { title: 'MealPlan Pro', category: 'Mobile', tags: ['React Native', 'Firebase'], desc: 'Meal planning app with AI-powered recipe suggestions.' },
  { title: 'DocuSense AI', category: 'AI', tags: ['Python', 'GPT-4', 'FastAPI'], desc: 'Intelligent document processing and summarization tool.' },
  { title: 'ShopNest', category: 'E-Commerce', tags: ['Next.js', 'Stripe', 'MongoDB'], desc: 'Multi-vendor marketplace with subscription management.' },
  { title: 'TravelMap', category: 'Web', tags: ['Vue', 'Mapbox', 'Express'], desc: 'Interactive travel itinerary builder with map integration.' },
  { title: 'FitCoach', category: 'Mobile', tags: ['Flutter', 'Supabase'], desc: 'Personal fitness app with workout tracking and progress analytics.' },
  { title: 'PredictFlow', category: 'AI', tags: ['Python', 'TensorFlow', 'AWS'], desc: 'Demand forecasting platform for retail supply chains.' },
  { title: 'CraftBrew Store', category: 'E-Commerce', tags: ['Shopify', 'React', 'GraphQL'], desc: 'Artisan craft beer marketplace with subscription boxes.' },
  { title: 'TeamSync', category: 'Web', tags: ['React', 'Socket.io', 'Redis'], desc: 'Real-time collaboration workspace for remote teams.' },
];

export default function Showcase() {
  usePageTitle('Project Showcase');
  const [active, setActive] = useState('All');

  const filtered = active === 'All' ? projects : projects.filter((p) => p.category === active);

  return (
    <div className="max-w-6xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <Layout className="w-12 h-12 text-fox-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-warm-900 mb-2">Project Showcase</h1>
        <p className="text-warm-600">Explore our recent work across industries and technologies.</p>
      </div>

      <div className="flex justify-center gap-2 mb-10">
        {filters.map((f) => (
          <button key={f} onClick={() => setActive(f)} className={`px-5 py-2 rounded-xl text-sm font-medium transition ${active === f ? 'bg-fox-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'}`}>{f}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p) => (
          <div key={p.title} className="bg-white rounded-2xl border border-warm-200 overflow-hidden group">
            <div className="h-44 bg-warm-100 flex items-center justify-center text-warm-300 text-sm">Project Preview</div>
            <div className="p-6">
              <span className="text-xs font-semibold text-fox-500 uppercase tracking-wide">{p.category}</span>
              <h3 className="font-bold text-warm-900 mt-1 mb-2">{p.title}</h3>
              <p className="text-sm text-warm-600 mb-4">{p.desc}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs bg-warm-50 border border-warm-200 rounded-full px-3 py-1 text-warm-700">{t}</span>
                ))}
              </div>
              <button className="flex items-center gap-1 text-sm text-fox-500 hover:text-fox-600 font-medium">
                View Case Study <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

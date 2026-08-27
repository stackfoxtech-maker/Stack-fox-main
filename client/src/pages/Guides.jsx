import { Link } from 'react-router-dom';

const guides = [
  { slug: 'how-to-choose-a-website-builder', title: 'How to choose the right website builder (2026)' },
  { slug: 'gst-for-service-businesses', title: 'GST for service businesses in India' },
  { slug: 'seo-basics-for-startups', title: 'SEO basics every startup needs' },
  { slug: 'mobile-vs-web-app', title: 'Mobile app vs web app trade-offs' },
  { slug: 'ai-automation-roi', title: 'Measuring AI automation ROI' },
];

export default function Guides() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Guides</p>
      <h1 className="text-3xl font-bold mb-8">How-to guides and explainers</h1>
      <p className="text-gray-600 mb-10">Practical guides written by StackFox experts to help you plan and launch better.</p>

      <div className="grid md:grid-cols-2 gap-6">
        {guides.map((g) => (
          <Link key={g.slug} to={'/guides/' + g.slug} className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow">
            <h2 className="font-semibold text-lg">{g.title}</h2>
            <div className="text-sm text-gray-500 mt-2">Read the guide</div>
          </Link>
        ))}
      </div>

      <div className="mt-14 bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Need a hand?</h2>
        <p className="text-gray-600 mb-4">Not finding what you need? Chat to an expert.</p>
        <Link to="/contact" className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Contact Support</Link>
      </div>
    </div>
  );
}
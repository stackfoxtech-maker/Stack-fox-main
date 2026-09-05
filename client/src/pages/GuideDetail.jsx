import { useParams, Link } from 'react-router-dom';
import { sanitizeHtml } from '@lib/utils';

const content = {
  'how-to-choose-a-website-builder': {
    title: 'How to choose the right website builder (2026)',
    html: '<h2>Start with your goal</h2><p>Are you selling online, showcasing a portfolio, or just need a brochure site?</p><h2>Compare the tiers</h2><p>Starter = fast brochure site, Growth = e-commerce, Premium = scale and custom logic.</p><h2>Watch out for hidden costs</h2><p>Hosting, domain, content, integrations, and revisions are often extra. Use our <a href="/tools/estimator">estimator</a>.</p>',
  },
  'gst-for-service-businesses': {
    title: 'GST for service businesses in India',
    html: '<h2>Which GST rate applies?</h2><p>Most services fall under 18% GST. Export-related services may be 0% (export of services).</p><h2>IGST vs CGST+SGST</h2><p>Inter-state = IGST; intra-state = CGST + SGST.</p><h2>Invoice requirements</h2><p>GSTIN of both parties, SAC code, place of supply, and tax breakup are mandatory. Try our <a href="/tools/gst-invoice">GST Invoice Generator</a>.</p>',
  },
};

export default function GuideDetail() {
  const { slug } = useParams();
  const g = content[slug] || { title: 'Guide', html: 'p' };
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link to="/guides" className="text-sm text-orange-600 font-semibold mb-4 inline-block">{'<'} All guides</Link>
      <h1 className="text-3xl font-bold my-6">{g.title}</h1>
      <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(g.html) }} />
      <div className="mt-12 bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Ready to build?</h2>
        <p className="text-gray-600 mb-4">Use the estimator or start the Builder now.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/tools/estimator" className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Open Estimator</Link>
          <Link to="/builder" className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50">Open Builder</Link>
        </div>
      </div>
    </div>
  );
}

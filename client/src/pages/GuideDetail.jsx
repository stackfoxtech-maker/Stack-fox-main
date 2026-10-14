import { useParams, Link } from 'react-router-dom';
import { sanitizeHtml } from '@lib/utils';
import guides from '@data/guides.json';
import { usePageTitle } from '@lib/hooks';

export default function GuideDetail() {
  const { slug } = useParams();
  const found = guides.find((x) => x.slug === slug);
  const g = found || {
    title: 'Guide not found',
    html: '<p>This guide does not exist. See all guides.</p>',
  };
  usePageTitle(g.title, found?.description, { noindex: !found });
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link to="/guides" className="text-sm text-orange-600 font-semibold mb-4 inline-block">
        {'<'} All guides
      </Link>
      <h1 className="text-3xl font-bold my-6">{g.title}</h1>
      <div
        className="prose max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(g.html) }}
      />
      <div className="mt-12 bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Ready to build?</h2>
        <p className="text-gray-600 mb-4">Use the estimator or start the Builder now.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/tools/estimator"
            className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600"
          >
            Open Estimator
          </Link>
          <Link
            to="/builder"
            className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50"
          >
            Open Builder
          </Link>
        </div>
      </div>
    </div>
  );
}

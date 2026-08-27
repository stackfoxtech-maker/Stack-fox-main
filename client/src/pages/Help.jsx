import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Getting Started',
    items: [
      { label: 'How the Builder works', link: '#' },
      { label: 'Pricing and tiers explained', link: '/pricing' },
      { label: 'What is included', link: '#' },
    ],
  },
  {
    title: 'Payments and Billing',
    items: [
      { label: 'Accepted payment methods', link: '#' },
      { label: 'GST on invoices', link: '#' },
      { label: 'Refund policy', link: '/legal' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Website audit tool', link: '/tools/website-audit' },
      { label: 'Project estimator', link: '/tools/estimator' },
      { label: 'GST invoice generator', link: '/tools/gst-invoice' },
      { label: 'Legal starter pack', link: '/tools/legal-starter-pack' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Client dashboard guide', link: '#' },
      { label: 'Reset password', link: '/forgot-password' },
      { label: 'Delete my account', link: '#' },
    ],
  },
];

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <p className="text-sm font-semibold text-orange-600 mb-2">Help Center</p>
      <h1 className="text-3xl font-bold mb-8">How can we help?</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-xl font-bold mb-3">{s.title}</h2>
            <ul className="space-y-2">
              {s.items.map((i) => (
                <li key={i.label}>
                  <Link to={i.link} className="text-gray-700 hover:text-orange-600 hover:underline">{i.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 bg-[#FAFAF8] rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Still stuck?</h2>
        <p className="text-gray-600 mb-4">Our team replies within 4 business hours.</p>
        <Link to="/contact" className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600">Contact Support</Link>
      </div>
    </div>
  );
}

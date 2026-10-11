import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { BuildPreview } from './BuildPreview';

const EASE = [0.2, 0.7, 0.2, 1];
const inr = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n);

// Prices and contents are the real packages in shared/stackfox-data.json.
const BUILDS = [
  {
    key: 'website',
    tab: 'Website',
    title: 'A website that brings in customers',
    blurb: 'Professional site with CMS, blog, SEO and analytics, ready for your domain.',
    pkg: 'Business Website Package',
    price: 65000,
    savings: 27000,
    weeks: '2 to 3 weeks',
    items: [
      'Business website, 5 pages',
      'CMS you can edit yourself',
      'Blog',
      'Technical + on-page SEO',
      'Analytics and Search Console',
    ],
    cat: 'web-dev',
  },
  {
    key: 'store',
    tab: 'Online store',
    title: 'An online store that takes UPI on day one',
    blurb: 'A complete store with payments, reviews, coupons and analytics.',
    pkg: 'E-Commerce Launchpad',
    price: 85000,
    savings: 30000,
    weeks: '3 to 4 weeks',
    items: [
      'Storefront and catalogue',
      'UPI, cards and wallets',
      'Reviews and ratings',
      'Coupons and discounts',
      'SSL, domain and analytics',
    ],
    cat: 'ecommerce',
  },
  {
    key: 'app',
    tab: 'Mobile app',
    title: 'An app on both stores, built once',
    blurb: 'Cross-platform app with push, offline mode and store submission.',
    pkg: 'Mobile App Launch Package',
    price: 110000,
    savings: 26000,
    weeks: '4 to 5 weeks',
    items: [
      'Android and iOS app',
      'App UI/UX design',
      'Push notifications',
      'Biometric login',
      'Offline mode',
    ],
    cat: 'mobile-dev',
  },
  {
    key: 'ai',
    tab: 'AI chatbot',
    title: 'An assistant that answers like your best rep',
    blurb: 'A chatbot trained on your own documents, plus search and content tools.',
    pkg: 'AI Integration Package',
    price: 90000,
    savings: 22000,
    weeks: '2 to 3 weeks',
    items: [
      'FAQ chatbot',
      'Custom GPT on your documents',
      'AI content generator',
      'Retrieval pipeline (RAG)',
    ],
    cat: 'ai-genai',
  },
  {
    key: 'growth',
    tab: 'Brand & growth',
    title: 'Get found, then get chosen',
    blurb: 'SEO, content and conversion work that grows traffic you already earn.',
    pkg: 'Digital Growth Package',
    price: 70000,
    savings: 20000,
    weeks: 'Ongoing, first results in 6 weeks',
    items: [
      'SEO audit and on-page fixes',
      'Keyword strategy',
      'Content plan',
      'Conversion optimisation',
      'Google Business profile',
    ],
    cat: 'seo-marketing',
  },
];

/** Tabbed "what are you building?" showcase: a preview of the result, its price, and what is inside. */
export function BuildShowcase() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const b = BUILDS[active];

  return (
    <div>
      <div
        role="tablist"
        aria-label="What are you building?"
        className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:px-0"
      >
        {BUILDS.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-pill px-4 py-2 text-body-sm font-medium transition-colors ${
              i === active
                ? 'bg-warm-900 text-white'
                : 'bg-white text-warm-700 ring-1 ring-warm-200 hover:ring-warm-300'
            }`}
          >
            {x.tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={b.key}
          role="tabpanel"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mt-8 grid items-center gap-8 lg:grid-cols-12 lg:gap-14"
        >
          <div className="relative lg:col-span-7">
            <div className="brand-stage px-4 pb-24 pt-6 sm:px-10 sm:pb-10 sm:pt-10">
              <BuildPreview kind={b.key} />
            </div>
            {/* Price card laid over the preview, the way the Builder shows it. */}
            <div className="absolute bottom-4 left-4 right-4 rounded-md bg-white/95 p-4 shadow-lg ring-1 ring-warm-900/5 backdrop-blur sm:bottom-6 sm:left-auto sm:right-6 sm:w-72">
              <p className="text-caption text-warm-700">{b.pkg}</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-warm-900">
                {inr(b.price)}
              </p>
              <p className="mt-0.5 text-caption text-sage-700">
                Saves {inr(b.savings)} against buying pieces one by one
              </p>
              <p className="mt-3 border-t border-warm-100 pt-3 text-caption text-warm-700">
                {b.weeks} · + GST
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <h3 className="font-display text-display-md text-warm-900">{b.title}</h3>
            <p className="mt-3 text-body-lg text-warm-800">{b.blurb}</p>
            <ul className="mt-6 space-y-2.5">
              {b.items.map((it) => (
                <li key={it} className="flex items-start gap-3 text-body text-warm-800">
                  <Check size={16} className="mt-1 shrink-0 text-sage-600" />
                  {it}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to={`/builder?category=${b.cat}`} className="btn-fox">
                Customise in the Builder <ArrowRight size={15} />
              </Link>
              <Link
                to="/packages"
                className="text-body-sm font-medium text-warm-700 underline decoration-warm-300 underline-offset-4 hover:text-fox-600"
              >
                All packages
              </Link>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

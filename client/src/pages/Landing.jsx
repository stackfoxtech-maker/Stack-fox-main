import { Link } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { fillTokens, inr, landingPath } from '@lib/seo';
import landings from '@data/landings.json';
import guides from '@data/guides.json';
import data from '@data/stackfox-data.json';

/** Agency / city landing page. Same copy the prerender writes into the static HTML. */
export default function Landing({ slug }) {
  const l = landings.find((x) => x.slug === slug);
  const f = (t) => fillTokens(t, data.services);
  usePageTitle(l.title, f(l.description));
  const rows = l.serviceIds.map((id) => data.services.find((s) => s.id === id));
  const related = l.guides.map((g) => guides.find((x) => x.slug === g)).filter(Boolean);
  const others = landings.filter((x) => x.slug !== slug);
  return (
    <div className="container-fx py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-display-lg md:text-display-xl text-warm-900">{l.h1}</h1>
        <p className="mt-5 text-body-lg text-warm-700">{f(l.answer)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/builder" className="btn-fox px-6">
            Build and price your project
          </Link>
          <Link to="/contact" className="btn-outline px-6">
            Talk to the team
          </Link>
        </div>

        <h2 className="mt-14 font-display text-display-md text-warm-900">What you get</h2>
        <ul className="mt-4 space-y-4">
          {l.why.map((w) => (
            <li key={w.t}>
              <strong className="text-warm-900">{w.t}.</strong>{' '}
              <span className="text-warm-700">{w.d}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-display text-display-md text-warm-900">Prices</h2>
        <p className="mt-2 text-warm-700">
          Indicative starting prices in rupees, excluding {data.meta.gstRate}% GST. Final pricing
          depends on scope.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-warm-200 text-warm-500">
                <th className="py-2 pr-4 font-medium">Service</th>
                <th className="py-2 pr-4 font-medium">Starts at</th>
                <th className="py-2 font-medium">Typical delivery</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-warm-100">
                  <td className="py-2.5 pr-4 text-warm-900">{s.name}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {inr(s.price)} / {s.unit}
                  </td>
                  <td className="py-2.5 text-warm-700">{s.est}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-body-sm">
          <Link to="/catalog" className="text-orange-600 underline">
            See all {Math.floor(data.services.length / 10) * 10}+ services
          </Link>
        </p>

        <h2 className="mt-14 font-display text-display-md text-warm-900">Common questions</h2>
        <div className="mt-4 space-y-6">
          {l.faqs.map((q) => (
            <div key={q.q}>
              <h3 className="font-semibold text-warm-900">{q.q}</h3>
              <p className="mt-1 text-warm-700">{f(q.a)}</p>
            </div>
          ))}
        </div>

        {related.length > 0 && (
          <>
            <h2 className="mt-14 font-display text-display-md text-warm-900">Guides</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link to={`/guides/${g.slug}`} className="text-orange-600 underline">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="mt-14 font-display text-display-md text-warm-900">Other services</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          {others.map((o) => (
            <li key={o.slug}>
              <Link to={landingPath(o)} className="text-orange-600 underline">
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

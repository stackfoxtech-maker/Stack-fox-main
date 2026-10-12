import { Reveal } from '@components/Reveal';
import { CountOnView } from '@components/home/HomeMotion';
import CATALOG from '@data/catalog-summary.json';

/** Four plain facts under the hero. */
export function FactsStrip() {
  const { serviceCount } = CATALOG;
  return (
    <section className="border-y border-warm-200 bg-white">
      <Reveal stagger className="container-fx grid grid-cols-2 gap-y-6 py-9 md:grid-cols-4">
        {[
          [<CountOnView key="n" end={serviceCount} suffix="+" />, 'services, each with a price'],
          [<CountOnView key="g" end={18} suffix="% GST" />, 'itemised on every invoice'],
          ['By milestone', 'pay as each phase lands'],
          [<CountOnView key="d" end={30} suffix=" days" />, 'of free fixes after launch'],
        ].map(([k, v]) => (
          <Reveal.Item
            key={v}
            className="md:border-l md:border-warm-200 md:pl-6 md:first:border-l-0 md:first:pl-0"
          >
            <p className="font-display text-3xl font-bold tracking-tight text-warm-900">{k}</p>
            <p className="mt-1 text-body-sm text-warm-700">{v}</p>
          </Reveal.Item>
        ))}
      </Reveal>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@components/Reveal';
import { SectionHead } from '@components/home/SectionHead';
// ~2 KB summary (names + counts) instead of the full 100 KB catalogue.
import CATALOG from '@data/catalog-summary.json';

/** The catalogue as an index of 13 domains. */
export function CatalogIndex() {
  const { categories, serviceCount } = CATALOG;
  return (
    <section className="section-padding bg-white" id="services">
      <div className="container-fx">
        <SectionHead
          title={'The pieces of\nyour next big thing.'}
          sub={`${serviceCount} services. ${categories.length} domains. One place to put them together.`}
          action={
            <Link to="/catalog" className="btn-outline self-start md:self-auto">
              View all services <ArrowUpRight size={15} />
            </Link>
          }
        />
        <Reveal as="ul" stagger className="mt-12 grid gap-x-12 md:grid-cols-2">
          {categories.map((cat, i) => (
            <Reveal.Item key={cat.id} as="li" className="border-t border-warm-200">
              <Link
                to={`/builder?category=${cat.id}`}
                className="group relative flex items-baseline gap-5 py-5"
              >
                <span className="w-6 shrink-0 font-display text-body-sm font-semibold tabular-nums text-fox-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-title text-warm-900 transition-transform duration-medium group-hover:translate-x-1">
                    {cat.name}
                  </span>
                  <span className="mt-1 block truncate text-body-sm text-warm-700">
                    {cat.description}
                  </span>
                </span>
                <span className="shrink-0 text-body-sm tabular-nums text-warm-800">
                  {cat.count} pieces
                </span>
                <ArrowUpRight
                  size={18}
                  className="shrink-0 self-center text-warm-400 transition-all duration-medium group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fox-500"
                />
                <span className="absolute inset-x-0 -top-px h-px origin-left scale-x-0 bg-fox-500 transition-transform duration-medium group-hover:scale-x-100" />
              </Link>
            </Reveal.Item>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

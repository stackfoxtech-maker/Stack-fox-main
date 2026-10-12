import { BuildShowcase } from '@components/home/BuildShowcase';
import { SectionHead } from '@components/home/SectionHead';

/** Proven builds: tabbed packages with a preview of each result. */
export function ShowcaseSection() {
  return (
    <section className="section-padding bg-warm-white">
      <div className="container-fx">
        <SectionHead
          title={'A big idea.\nA straightforward start.'}
          sub="Each package is a set of priced pieces we ship often. Take it as is, or open it in the Builder and change anything."
        />
        <div className="mt-12">
          <BuildShowcase />
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { IndustryStrip } from '@components/home/IndustryStrip';
import { SectionHead } from '@components/home/SectionHead';

/** Bundles for each industry. */
export function IndustriesSection() {
  return (
    <section className="section-padding bg-warm-white">
      <div className="container-fx">
        <SectionHead
          title={'Bundles for how\nyour industry runs.'}
          sub="Pre-assembled for the software each kind of business needs most, priced up front."
          action={
            <Link to="/industries" className="btn-outline self-start md:self-auto">
              All industries <ArrowRight size={15} />
            </Link>
          }
        />
        <div className="mt-12">
          <IndustryStrip />
        </div>
      </div>
    </section>
  );
}

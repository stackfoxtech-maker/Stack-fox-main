import { TryEstimator } from '@components/home/TryEstimator';
import { SectionHead } from '@components/home/SectionHead';

/** Try it: tick pieces and watch the estimate move. */
export function EstimatorSection() {
  return (
    <section className="section-padding bg-white">
      <div className="container-fx">
        <SectionHead
          title={'A little of this.\nA lot of possibility.'}
          sub="Tick a few pieces and watch the estimate move. This is exactly how the Builder works."
        />
        <div className="mt-12">
          <TryEstimator />
        </div>
      </div>
    </section>
  );
}

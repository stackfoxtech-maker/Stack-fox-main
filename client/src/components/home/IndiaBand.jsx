import Photo from '@components/Photo';
import { SectionHead } from '@components/home/SectionHead';

/** Full-bleed band: built for how Indian businesses run. */
export function IndiaBand() {
  return (
    <section className="relative isolate overflow-hidden bg-warm-100">
      <Photo
        base="/images/home/band-founder-laptop"
        widths={[1200, 2400]}
        width={2400}
        height={1029}
        sizes="100vw"
        alt="A founder working at his laptop at a long table in warm afternoon light"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_50%]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-warm-white via-warm-white/85 to-warm-white/0 md:via-warm-white/70" />
      <div className="container-fx py-24 md:py-36">
        <div className="max-w-xl">
          <SectionHead
            title={'Built for how\nIndian businesses run.'}
            sub="UPI on day one, GST on every invoice, payments by milestone, and a real person a phone call away."
          />
        </div>
      </div>
    </section>
  );
}

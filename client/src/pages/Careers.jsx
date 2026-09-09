import { Mail, Check } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';

/**
 * Careers is CV-only: open positions are closed and the in-app application
 * flow is gone. Anyone interested emails a CV to the address below, so there
 * is exactly one route in and nothing to maintain when roles change.
 *
 * The jobs API and the admin Hiring screen are left in place — existing
 * applications stay readable — but nothing on the public site posts to them.
 */
const CV_EMAIL = 'stackfox.tech@gmail.com';

export default function Careers() {
  usePageTitle('Careers');
  const { perks } = data.careers;

  const subject = encodeURIComponent('Application — CV for StackFox');
  const body = encodeURIComponent(
    'Hi StackFox team,\n\n' +
      'I would like to be considered for a role. My CV is attached.\n\n' +
      'Name:\nRole of interest:\nYears of experience:\nPortfolio or GitHub:\n\nThank you.',
  );

  return (
    <>
      <Section>
        <SectionHeading
          label="Careers"
          title="Build the future with us"
          description="Join a team that ships fast, learns constantly, and trusts its people."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {perks.map((perk, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-warm-200">
              <Check size={16} className="text-success-500 shrink-0 mt-0.5" />
              <span className="text-sm text-warm-700">{perk}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-fox-50 text-fox-500 flex items-center justify-center mx-auto mb-5">
            <Mail size={24} />
          </div>

          <h2 className="text-2xl font-bold text-warm-900">Send us your CV</h2>
          <p className="text-sm text-warm-600 mt-3">
            We are not advertising specific openings right now. We do still read every CV that
            reaches us, and we get in touch when something fits.
          </p>

          <div className="mt-8">
            {/* A plain anchor, not <Button>: that primitive always renders a
                <button>, which would swallow the mailto instead of opening it. */}
            <a
              href={`mailto:${CV_EMAIL}?subject=${subject}&body=${body}`}
              className="btn-fox inline-flex items-center justify-center gap-2 font-semibold text-[15px] px-5 py-2.5 rounded-pill"
            >
              <Mail size={16} /> Email your CV
            </a>
            <p className="text-xs text-warm-500 mt-4">
              Or write to{' '}
              <a href={`mailto:${CV_EMAIL}`} className="text-fox-500 font-medium hover:text-fox-600">
                {CV_EMAIL}
              </a>{' '}
              with your CV attached.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

import { usePageTitle } from '@lib/hooks';
import { Hero } from '@components/home/Hero';
import { FactsStrip } from '@components/home/FactsStrip';
import { JourneySection } from '@components/home/JourneySection';
import { ShowcaseSection } from '@components/home/ShowcaseSection';
import { EstimatorSection } from '@components/home/EstimatorSection';
import { WorkspaceSection } from '@components/home/WorkspaceSection';
import { IndiaBand } from '@components/home/IndiaBand';
import { IndustriesSection } from '@components/home/IndustriesSection';
import { CatalogIndex } from '@components/home/CatalogIndex';
import { Studio } from '@components/home/Studio';
import { Proof } from '@components/home/Proof';
import { Faq } from '@components/home/Faq';

/** Homepage: one component per section, each in components/home/. */
export default function Home() {
  usePageTitle(null);
  return (
    <>
      <Hero />
      <FactsStrip />
      <JourneySection />
      <ShowcaseSection />
      <EstimatorSection />
      <WorkspaceSection />
      <IndiaBand />
      <IndustriesSection />
      <CatalogIndex />
      <Studio />
      <Proof />
      <Faq />
      {/* Closing CTA is the Footer's own band. */}
    </>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { SpotlightGlow, spotlightProps } from '@components/home/HomeMotion';
import { PageHero } from '@components/layout/PageHero';
import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { ArrowRight } from 'lucide-react';
import { Section } from '@components/ui/Primitives';
import CdnImage from '@components/CdnImage';
import LeadInquiryModal from '@components/LeadInquiryModal';

const projects = [
  {
    title: 'GreenLeaf Organics',
    industry: 'E-Commerce',
    desc: 'Full-stack organic food marketplace with subscription box and delivery tracking.',
    tech: ['React', 'Node.js', 'MongoDB', 'Razorpay'],
    img: 'portfolio-ecommerce',
  },
  {
    title: 'HealthFirst Portal',
    industry: 'Healthcare',
    desc: 'Patient portal with appointment booking, telemedicine, and prescription management.',
    tech: ['Next.js', 'Express', 'PostgreSQL', 'Socket.io'],
    img: 'portfolio-healthcare',
  },
  {
    title: 'PropertyDekho',
    industry: 'Real Estate',
    desc: 'Property listing with map view, virtual tours, and lead management CRM.',
    tech: ['React', 'Node.js', 'MongoDB', 'Google Maps'],
    img: 'portfolio-realestate',
  },
  {
    title: 'EduBridge LMS',
    industry: 'EdTech',
    desc: 'Learning management system supporting 5000+ students with offline mobile app.',
    tech: ['React Native', 'Node.js', 'MongoDB', 'AWS'],
    img: 'portfolio-education',
  },
  {
    title: 'FoodBox',
    industry: 'Food & Restaurant',
    desc: 'Online ordering platform with kitchen management and WhatsApp integration.',
    tech: ['React', 'Express', 'MongoDB', 'Twilio'],
    img: 'portfolio-food',
  },
  {
    title: 'EventHub',
    industry: 'Events',
    desc: 'Event ticketing with seat selection, QR check-in, and attendee analytics.',
    tech: ['Next.js', 'Node.js', 'PostgreSQL', 'Stripe'],
    img: 'portfolio-events',
  },
];

export default function Portfolio() {
  usePageTitle('Portfolio');
  const [inquiry, setInquiry] = useState(null);
  const [industry, setIndustry] = useState('All');
  const industries = ['All', ...new Set(projects.map((p) => p.industry))];
  const shown = industry === 'All' ? projects : projects.filter((p) => p.industry === industry);

  return (
    <Section>
      <PageHero
        eyebrow="Portfolio"
        title="Our work speaks for itself"
        accent="speaks for itself"
        description="Selected projects across industries, from storefronts to patient portals."
        stats={[
          { end: projects.length, label: 'projects shown' },
          { end: industries.length - 1, label: 'industries' },
          { end: new Set(projects.flatMap((p) => p.tech)).size, label: 'technologies' },
          { end: 24, suffix: 'h', label: 'to a first reply' },
        ]}
      />

      <div className="no-scrollbar -mx-6 mb-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0">
        {industries.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setIndustry(name)}
            aria-pressed={industry === name}
            className={`relative min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${
              industry === name
                ? 'border-transparent text-white'
                : 'border-warm-200 bg-white text-warm-600 hover:border-fox-300'
            }`}
          >
            {industry === name && (
              <motion.span
                layoutId="industry-pill"
                className="absolute inset-0 rounded-full bg-fox-500 shadow-md shadow-fox-500/25"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              />
            )}
            <span className="relative">{name}</span>
          </button>
        ))}
      </div>

      <motion.div layout className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((p) => (
            <motion.div
              key={p.title}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              {...spotlightProps}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white p-4 shadow-sm transition-shadow duration-medium hover:shadow-lg sm:p-5"
            >
              <SpotlightGlow />
              <div className="img-frame img-frame-sm relative mb-5 aspect-[4/3] overflow-hidden">
                <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
                  <CdnImage
                    name={p.img}
                    w={720}
                    widths={[400, 560, 720, 1000]}
                    sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
                    width={1000}
                    height={750}
                    alt={`${p.title} — ${p.industry}`}
                  />
                </div>
              </div>
              <span className="badge-fx badge-fox relative mb-3 self-start">{p.industry}</span>
              <h3 className="relative mb-2 text-title text-warm-900">{p.title}</h3>
              <p className="relative mb-5 flex-1 text-body-sm leading-relaxed text-warm-600">
                {p.desc}
              </p>
              <div className="relative mb-5 flex flex-wrap gap-1.5">
                {p.tech.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-warm-100 bg-warm-50 px-2 py-0.5 font-mono text-caption font-medium text-warm-500"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setInquiry(p)}
                className="group/link relative flex min-h-11 items-center gap-1 self-start text-body-sm font-semibold text-fox-600 hover:text-fox-700 sm:min-h-0"
              >
                Discuss a project like this{' '}
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover/link:translate-x-0.5"
                />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {inquiry && (
        <LeadInquiryModal
          title={`A project like ${inquiry.title}`}
          subtitle={`${inquiry.industry} · ${inquiry.tech.join(', ')}`}
          source="portfolio"
          context={`Referencing the "${inquiry.title}" case (${inquiry.industry}).`}
          onClose={() => setInquiry(null)}
        />
      )}
    </Section>
  );
}

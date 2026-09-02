import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { ArrowRight } from 'lucide-react';
import { Section, SectionHeading } from '@components/ui/Primitives';
import { Reveal } from '@components/Reveal';
import CdnImage from '@components/CdnImage';
import LeadInquiryModal from '@components/LeadInquiryModal';

const projects = [
  { title: 'GreenLeaf Organics', industry: 'E-Commerce', desc: 'Full-stack organic food marketplace with subscription box and delivery tracking.', tech: ['React', 'Node.js', 'MongoDB', 'Razorpay'], img: 'portfolio-ecommerce' },
  { title: 'HealthFirst Portal', industry: 'Healthcare', desc: 'Patient portal with appointment booking, telemedicine, and prescription management.', tech: ['Next.js', 'Express', 'PostgreSQL', 'Socket.io'], img: 'portfolio-healthcare' },
  { title: 'PropertyDekho', industry: 'Real Estate', desc: 'Property listing with map view, virtual tours, and lead management CRM.', tech: ['React', 'Node.js', 'MongoDB', 'Google Maps'], img: 'portfolio-realestate' },
  { title: 'EduBridge LMS', industry: 'EdTech', desc: 'Learning management system supporting 5000+ students with offline mobile app.', tech: ['React Native', 'Node.js', 'MongoDB', 'AWS'], img: 'portfolio-education' },
  { title: 'FoodBox', industry: 'Food & Restaurant', desc: 'Online ordering platform with kitchen management and WhatsApp integration.', tech: ['React', 'Express', 'MongoDB', 'Twilio'], img: 'portfolio-food' },
  { title: 'EventHub', industry: 'Events', desc: 'Event ticketing with seat selection, QR check-in, and attendee analytics.', tech: ['Next.js', 'Node.js', 'PostgreSQL', 'Stripe'], img: 'portfolio-events' },
];

export default function Portfolio() {
  usePageTitle('Portfolio');
  const [inquiry, setInquiry] = useState(null);

  return (
    <Section>
      <SectionHeading label="Portfolio" title="Our work speaks for itself" description="Selected projects across industries. Real clients, real results." />

      <Reveal stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <Reveal.Item key={p.title} className="card-fx-elevated flex flex-col p-5 group">
            <div className="img-frame img-frame-sm mb-5 aspect-[4/3] transition-transform duration-medium group-hover:-translate-y-0.5">
              <CdnImage
                name={p.img} w={720} widths={[400, 560, 720, 1000]}
                sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
                width={1000} height={750} alt={`${p.title} — ${p.industry}`}
              />
            </div>
            <span className="badge-fx badge-fox self-start mb-3">{p.industry}</span>
            <h3 className="text-title text-warm-900 mb-2">{p.title}</h3>
            <p className="text-body-sm text-warm-600 mb-5 flex-1 leading-relaxed">{p.desc}</p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {p.tech.map((t) => (
                <span key={t} className="rounded-sm bg-warm-50 px-2 py-0.5 font-mono text-caption font-medium text-warm-500 border border-warm-100">{t}</span>
              ))}
            </div>
            <button
              onClick={() => setInquiry(p)}
              className="flex items-center gap-1 self-start text-body-sm font-semibold text-fox-600 hover:text-fox-700 group/link"
            >
              Discuss a project like this <ArrowRight size={14} className="transition-transform group-hover/link:translate-x-0.5" />
            </button>
          </Reveal.Item>
        ))}
      </Reveal>

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

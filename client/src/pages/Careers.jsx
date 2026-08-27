import { Link } from 'react-router-dom';
import { MapPin, Clock, Briefcase, ArrowRight, Check } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Button } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';

const typeColors = { 'full-time': 'badge-success', 'part-time': 'badge-info', contract: 'badge-warning', freelance: 'badge-fox', internship: 'badge-neutral' };

export default function Careers() {
  usePageTitle('Careers');
  const { openPositions, perks } = data.careers;

  return (
    <>
      <Section>
        <SectionHeading label="Careers" title="Build the future with us" description="Join a team that ships fast, learns constantly, and trusts its people." />

        {/* Perks */}
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
        <SectionHeading label="Open positions" title={`${openPositions.length} roles open`} />
        <div className="max-w-3xl mx-auto space-y-4">
          {openPositions.map((job) => (
            <Link key={job.id} to={`/hiring-wall?job=${job.id}`} className="card-fx p-5 block group hover:border-fox-300">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-semibold text-warm-900 group-hover:text-fox-500 transition-colors">{job.title}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-warm-500">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>
                    <span className="flex items-center gap-1"><Briefcase size={12} /> {job.experience}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {job.type}</span>
                  </div>
                </div>
                <span className={`badge-fx ${typeColors[job.type] || 'badge-neutral'}`}>{job.type}</span>
              </div>
              <p className="text-sm text-warm-600 mb-3">{job.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((s) => <span key={s} className="badge-fx badge-neutral text-[10px]">{s}</span>)}
              </div>
              {job.salary && <p className="text-sm font-mono text-fox-500 mt-3">{job.salary}</p>}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

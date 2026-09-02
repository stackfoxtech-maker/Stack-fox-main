import { useState } from 'react';
import { Activity, Clock, Sparkles, Globe, Smartphone, Brain, Shield, ChevronRight } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Button } from '@components/ui/Primitives';
import { cn } from '@lib/utils';
import data from '@data/stackfox-data.json';
import LeadInquiryModal from '@components/LeadInquiryModal';

const STATUS_CONFIG = {
  live: { label: 'Live', color: 'bg-green-50 text-green-600 border-green-200', icon: Activity },
  ongoing: { label: 'Ongoing', color: 'bg-fox-50 text-fox-600 border-fox-200', icon: Clock },
  upcoming: { label: 'Upcoming', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Sparkles },
};

const TYPE_ICONS = {
  'Web App': Globe,
  'Web Platform': Globe,
  'Mobile (iOS/Android)': Smartphone,
  'AI / GenAI': Brain,
  'Cybersecurity': Shield,
};

export default function ProjectWall() {
  usePageTitle('Project Wall');
  const projects = data.careers?.projectsFeed || [];
  const [inquiry, setInquiry] = useState(null);

  return (
    <Section className="bg-warm-white">
      <div className="container-fx">
        <div className="max-w-4xl mx-auto mb-16 text-center">
          <SectionHeading
            label="Live Engineering"
            title="The Project Wall"
            subtitle="A real-time window into the StackFox lab. Explore our ongoing builds, live deployments, and upcoming innovations."
          />

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-xs font-bold text-warm-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {projects.filter((p) => p.status === 'live').length} Live
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-warm-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-fox-500" />
              {projects.filter((p) => p.status === 'ongoing').length} Ongoing
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-warm-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {projects.filter((p) => p.status === 'upcoming').length} Planning
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.ongoing;
            const StatusIcon = status.icon;
            const TypeIcon = TYPE_ICONS[project.type] || Globe;

            return (
              <div key={project.id} className="group bg-white rounded-3xl border border-warm-200 p-6 hover:shadow-xl hover:border-fox-200 transition-all duration-300 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border', status.color)}>
                    <StatusIcon size={12} />
                    {status.label}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-warm-50 text-warm-400 flex items-center justify-center group-hover:bg-fox-50 group-hover:text-fox-500 transition-colors">
                    <TypeIcon size={20} />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-warm-900 group-hover:text-fox-600 transition-colors mb-2">{project.title}</h3>
                <p className="text-sm text-warm-500 line-clamp-3 mb-6 leading-relaxed">{project.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-8 mt-auto">
                  {project.stack.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded bg-warm-50 text-[10px] font-mono text-warm-400 border border-warm-100">{s}</span>
                  ))}
                </div>

                <div className="pt-4 border-t border-warm-50 flex items-center justify-between">
                  <div className="text-[11px] text-warm-400 font-bold uppercase tracking-tighter">{project.date}</div>
                  <Button variant="ghost" size="sm" onClick={() => setInquiry(project)} className="text-fox-500 hover:bg-fox-50 gap-2 font-bold">
                    Discuss a build like this <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {inquiry && (
        <LeadInquiryModal
          title={`A build like ${inquiry.title}`}
          subtitle={`${inquiry.type} · ${inquiry.stack.join(', ')}`}
          source="project-wall"
          context={`Referencing "${inquiry.title}" on the Project Wall.`}
          onClose={() => setInquiry(null)}
        />
      )}
    </Section>
  );
}

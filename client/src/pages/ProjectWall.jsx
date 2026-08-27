import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Send, MapPin, Activity, Clock, Users, Sparkles, 
  ArrowRight, Globe, Smartphone, Brain, Shield, ChevronRight, LayoutGrid, Terminal, Rocket, X as XIcon
} from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Button, Input, Textarea } from '@components/ui/Primitives';
import { cn } from '@lib/utils';
import data from '@data/stackfox-data.json';
import toast from 'react-hot-toast';

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
  const [params] = useSearchParams();
  
  const projects = data.careers?.projectsFeed || [];
  const [selectedProject, setSelectedProject] = useState(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      toast.success('Your interest has been recorded! Our engineers will be in touch.');
      setForm({ name: '', email: '', phone: '', message: '' });
      setSelectedProject(null);
      setLoading(false);
    }, 1000);
  };

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
              {projects.filter(p => p.status === 'live').length} Live
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-warm-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-fox-500" />
              {projects.filter(p => p.status === 'ongoing').length} Ongoing
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-warm-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {projects.filter(p => p.status === 'upcoming').length} Planning
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const status = STATUS_CONFIG[project.status];
            const StatusIcon = status.icon;
            const TypeIcon = TYPE_ICONS[project.type] || Globe;
            
            return (
              <div 
                key={project.id}
                className="group bg-white rounded-3xl border border-warm-200 p-6 hover:shadow-xl hover:border-fox-200 transition-all duration-300 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                    status.color
                  )}>
                    <StatusIcon size={12} />
                    {status.label}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-warm-50 text-warm-400 flex items-center justify-center group-hover:bg-fox-50 group-hover:text-fox-500 transition-colors">
                    <TypeIcon size={20} />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-warm-900 group-hover:text-fox-600 transition-colors mb-2">
                  {project.title}
                </h3>
                
                <p className="text-sm text-warm-500 line-clamp-3 mb-6 leading-relaxed">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-8 mt-auto">
                  {project.stack.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded bg-warm-50 text-[10px] font-mono text-warm-400 border border-warm-100">
                      {s}
                    </span>
                  ))}
                </div>

                <div className="pt-4 border-t border-warm-50 flex items-center justify-between">
                  <div className="text-[11px] text-warm-400 font-bold uppercase tracking-tighter">
                    {project.date}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowComingSoon(true)}
                    className="text-fox-500 hover:bg-fox-50 gap-2 font-bold"
                  >
                    Discuss Project <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming Soon Overlay */}
        {showComingSoon && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-warm-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center relative animate-in zoom-in-95 duration-300">
              <button 
                onClick={() => setShowComingSoon(false)}
                className="absolute top-6 right-6 p-2 hover:bg-warm-100 rounded-full text-warm-400 transition-colors"
              >
                <XIcon size={20} />
              </button>
              
              <div className="w-20 h-20 bg-fox-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-fox-500">
                <Rocket size={40} className="animate-bounce" />
              </div>
              
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fox-50 text-fox-600 text-[10px] font-bold uppercase tracking-widest mb-4">
                <Sparkles size={12} /> Under Maintenance
              </div>
              
              <h2 className="text-2xl font-black text-warm-900 mb-3">Project Details Coming Soon</h2>
              <p className="text-sm text-warm-500 leading-relaxed mb-8">
                We are currently sanitizing and preparing this project case study for public view. Our engineering team is adding technical deep-dives and performance metrics.
              </p>
              
              <Button 
                variant="primary" 
                className="w-full h-14 rounded-2xl font-bold"
                onClick={() => setShowComingSoon(false)}
              >
                Got it, keep me posted!
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

const X = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

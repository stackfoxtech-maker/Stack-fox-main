import { useState } from 'react';
import { usePageTitle } from '@lib/hooks';
import { ExternalLink, Github, X, Sparkles, Rocket } from 'lucide-react';
import { Section, SectionHeading, Button } from '@components/ui/Primitives';

const projects = [
  { title: 'GreenLeaf Organics', industry: 'E-Commerce', desc: 'Full-stack organic food marketplace with subscription box and delivery tracking.', tech: ['React', 'Node.js', 'MongoDB', 'Razorpay'], live: '#', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80&auto=format&fit=crop' },
  { title: 'HealthFirst Portal', industry: 'Healthcare', desc: 'Patient portal with appointment booking, telemedicine, and prescription management.', tech: ['Next.js', 'Express', 'PostgreSQL', 'Socket.io'], live: '#', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80&auto=format&fit=crop' },
  { title: 'PropertyDekho', industry: 'Real Estate', desc: 'Property listing with map view, virtual tours, and lead management CRM.', tech: ['React', 'Node.js', 'MongoDB', 'Google Maps'], live: '#', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80&auto=format&fit=crop' },
  { title: 'EduBridge LMS', industry: 'EdTech', desc: 'Learning management system supporting 5000+ students with offline mobile app.', tech: ['React Native', 'Node.js', 'MongoDB', 'AWS'], live: '#', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80&auto=format&fit=crop' },
  { title: 'FoodBox', industry: 'Food & Restaurant', desc: 'Online ordering platform with kitchen management and WhatsApp integration.', tech: ['React', 'Express', 'MongoDB', 'Twilio'], live: '#', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&auto=format&fit=crop' },
  { title: 'EventHub', industry: 'Events', desc: 'Event ticketing with seat selection, QR check-in, and attendee analytics.', tech: ['Next.js', 'Node.js', 'PostgreSQL', 'Stripe'], live: '#', image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80&auto=format&fit=crop' },
];

export default function Portfolio() {
  usePageTitle('Portfolio');
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <Section>
      <SectionHeading label="Portfolio" title="Our work speaks for itself" description="Selected projects across industries. Real clients, real results." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p, i) => (
          <div key={i} className="card-fx-elevated flex flex-col p-6 group">
            <div className="w-full h-44 bg-warm-100 rounded-2xl mb-6 group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden relative">
              <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-warm-900/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="badge-fx badge-fox self-start mb-3">{p.industry}</span>
            <h3 className="text-xl font-bold text-warm-900 mb-2">{p.title}</h3>
            <p className="text-sm text-warm-500 mb-6 flex-1 leading-relaxed">{p.desc}</p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {p.tech.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-warm-50 text-[10px] font-bold text-warm-400 border border-warm-100">{t}</span>
              ))}
            </div>
            <button 
              onClick={() => setShowComingSoon(true)}
              className="text-sm text-fox-500 font-bold hover:text-fox-700 flex items-center gap-1 group/link"
            >
              View Project Case Study <ExternalLink size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
            </button>
          </div>
        ))}
      </div>

      {/* Coming Soon Overlay */}
      {showComingSoon && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-warm-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowComingSoon(false)}
              className="absolute top-6 right-6 p-2 hover:bg-warm-100 rounded-full text-warm-400 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="w-20 h-20 bg-fox-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-fox-500">
              <Rocket size={40} className="animate-bounce" />
            </div>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fox-50 text-fox-600 text-[10px] font-bold uppercase tracking-widest mb-4">
              <Sparkles size={12} /> Under Maintenance
            </div>
            
            <h2 className="text-2xl font-black text-warm-900 mb-3">Project Details Coming Soon</h2>
            <p className="text-sm text-warm-500 leading-relaxed mb-8">
              We are currently sanitizing and preparing this case study for public view. Our engineering team is adding technical deep-dives and performance metrics.
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
    </Section>
  );
}

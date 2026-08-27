import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MapPin, Briefcase } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Button, Input, Textarea } from '@components/ui/Primitives';
import data from '@data/stackfox-data.json';
import toast from 'react-hot-toast';
import api from '@lib/api';

export default function HiringWall() {
  usePageTitle('Apply');
  const [params] = useSearchParams();
  const jobId = params.get('job');
  const jobs = data.careers.openPositions;
  const [selected, setSelected] = useState(jobId || jobs[0]?.id || '');
  const [form, setForm] = useState({ name: '', email: '', phone: '', experience: '', coverLetter: '', portfolioUrl: '', linkedinUrl: '' });
  const [loading, setLoading] = useState(false);

  const job = jobs.find((j) => j.id === selected);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast.error('Name and email required.'); return; }
    setLoading(true);
    try {
      await api.post(`/jobs/${selected}/apply`, form);
      toast.success('Application submitted!');
      setForm({ name: '', email: '', phone: '', experience: '', coverLetter: '', portfolioUrl: '', linkedinUrl: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit application.');
    }
    setLoading(false);
  };

  return (
    <Section>
      <SectionHeading label="Apply" title="Join the StackFox pack" />
      <div className="max-w-3xl mx-auto">
        {/* Job selector */}
        <div className="mb-8">
          <label className="text-sm font-medium text-warm-700 mb-2 block">Select position</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input-fx">
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} — {j.type}</option>)}
          </select>
          {job && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-warm-500">
              <span className="flex items-center gap-1"><MapPin size={12} />{job.location}</span>
              <span className="flex items-center gap-1"><Briefcase size={12} />{job.experience}</span>
              {job.salary && <span className="font-mono text-fox-500">{job.salary}</span>}
            </div>
          )}
        </div>

        <div onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full name *" value={form.name} onChange={set('name')} placeholder="Your name" required />
            <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
            <Input label="Experience" value={form.experience} onChange={set('experience')} placeholder="e.g. 3 years" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Portfolio URL" value={form.portfolioUrl} onChange={set('portfolioUrl')} placeholder="https://..." />
            <Input label="LinkedIn URL" value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
          </div>
          <Textarea label="Cover letter" value={form.coverLetter} onChange={set('coverLetter')} placeholder="Why do you want to join StackFox?" />
          <Button variant="primary" size="lg" isLoading={loading} onClick={handleSubmit} className="w-full md:w-auto">
            <Send size={16} /> Submit Application
          </Button>
        </div>
      </div>
    </Section>
  );
}

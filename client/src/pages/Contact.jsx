import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { Section, SectionHeading, Input, Textarea, Button } from '@components/ui/Primitives';
import CdnImage from '@components/CdnImage';
import toast from 'react-hot-toast';

export default function Contact() {
  usePageTitle('Contact');
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.message) { toast.error('Please fill all required fields.'); return; }
    toast.success('Message sent! We\'ll get back to you within 24 hours.');
    setForm({ name: '', email: '', phone: '', message: '' });
  };

  return (
    <Section>
      <SectionHeading label="Contact" title="Let's talk" description="Have a project in mind? Get in touch and we'll respond within 24 hours." />

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name *" value={form.name} onChange={set('name')} placeholder="Your name" />
            <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </div>
          <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 82093 95894" />
          <Textarea label="Message *" value={form.message} onChange={set('message')} placeholder="Tell us about your project..." className="min-h-[140px]" />
          <Button variant="primary" size="lg" onClick={handleSubmit}>
            <Send size={16} /> Send Message
          </Button>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="img-frame img-frame-sm aspect-[4/3]">
            <CdnImage
              name="contact-call" w={720} widths={[400, 560, 720, 960]}
              sizes="(min-width: 768px) 38vw, 100vw"
              width={960} height={720}
              alt="A StackFox advisor on a friendly project call" />
          </div>
          <div className="card-fx p-5">
            <h3 className="font-semibold text-warm-900 mb-4">Get in touch</h3>
            <div className="space-y-4 text-sm">
              <a href="mailto:stackfox.tech@gmail.com" className="flex items-center gap-3 text-warm-600 hover:text-fox-500 transition-colors">
                <Mail size={18} className="text-fox-500" /> stackfox.tech@gmail.com
              </a>
              <a href="tel:+918209395894" className="flex items-center gap-3 text-warm-600 hover:text-fox-500 transition-colors">
                <Phone size={18} className="text-fox-500" /> +91 82093 95894
              </a>
              <div className="flex items-center gap-3 text-warm-600">
                <MapPin size={18} className="text-fox-500" /> Jaipur, Rajasthan, India
              </div>
            </div>
          </div>
          <div className="card-fx p-5">
            <h3 className="font-semibold text-warm-900 mb-2">Office hours</h3>
            <p className="text-body-sm text-warm-600">Round the clock — someone answers within 24 hours, always.</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

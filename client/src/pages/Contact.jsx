import { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';
import { usePageTitle } from '@lib/hooks';
import { PageHero } from '@components/layout/PageHero';
import { Section, Input, Textarea, Button } from '@components/ui/Primitives';
import Photo from '@components/Photo';
import toast from 'react-hot-toast';
import { apiPost } from '@lib/api';

export default function Contact() {
  usePageTitle('Contact');
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // This used to show "Message sent!" without sending anything, so every enquiry made
  // through the form was lost. It now creates the lead.
  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill all required fields.');
      return;
    }
    setSending(true);
    try {
      await apiPost('/lead/demo', {
        name: form.name,
        email: form.email,
        ...(form.phone ? { phone: form.phone } : {}),
        message: form.message,
        source: 'contact',
      });
      toast.success("Message sent! We'll get back to you within 24 hours.");
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          'We could not send your message. Please try again, or call us.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Section>
      <PageHero
        eyebrow="Contact"
        title="Let's talk"
        accent="talk"
        description="Have a project in mind? Get in touch and we'll respond within 24 hours."
      >
        <a href="tel:+918209395894" className="btn-fox">
          <Phone size={16} /> Call +91 82093 95894
        </a>
        <a
          href="https://wa.me/918209395894?text=Hi%20StackFox%2C%20I%27d%20like%20to%20talk%20about%20a%20project."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-[0.875rem] border border-[#1da851] bg-gradient-to-b from-[#3bdc7c] to-[#25D366] px-5 font-display text-[15px] font-semibold tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-10px_rgba(37,211,102,0.7)] transition-transform hover:-translate-y-px active:translate-y-px"
        >
          <MessageCircle size={16} /> WhatsApp
        </a>
      </PageHero>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={set('name')}
              placeholder="Your name"
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
            />
          </div>
          <Input
            label="Phone"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91 82093 95894"
          />
          <Textarea
            label="Message *"
            value={form.message}
            onChange={set('message')}
            placeholder="Tell us about your project..."
            className="min-h-[140px]"
          />
          <Button variant="primary" size="lg" onClick={handleSubmit} isLoading={sending}>
            <Send size={16} /> Send Message
          </Button>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="img-frame img-frame-sm aspect-[4/3]">
            <Photo
              base="/images/contact/advisor-video-call"
              widths={[600, 960]}
              sizes="(min-width: 768px) 38vw, 100vw"
              width={960}
              height={720}
              alt="An advisor explaining a plan on a laptop video call"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="card-fx p-5">
            <h3 className="font-semibold text-warm-900 mb-4">Get in touch</h3>
            <div className="space-y-4 text-sm">
              <a
                href="mailto:stackfox.tech@gmail.com"
                className="flex min-h-11 items-center gap-3 text-warm-600 hover:text-fox-500 transition-colors sm:min-h-0"
              >
                <Mail size={18} className="text-fox-500" /> stackfox.tech@gmail.com
              </a>
              <a
                href="tel:+918209395894"
                className="flex min-h-11 items-center gap-3 text-warm-600 hover:text-fox-500 transition-colors sm:min-h-0"
              >
                <Phone size={18} className="text-fox-500" /> +91 82093 95894
              </a>
              <div className="flex items-center gap-3 text-warm-600">
                <MapPin size={18} className="text-fox-500" /> Jaipur, Rajasthan, India
              </div>
            </div>
          </div>
          <div className="card-fx p-5">
            <h3 className="font-semibold text-warm-900 mb-2">Office hours</h3>
            <p className="text-body-sm text-warm-600">
              Round the clock — someone answers within 24 hours, always.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

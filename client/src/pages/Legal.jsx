import { useLocation } from 'react-router-dom';
import { usePageTitle } from '@lib/hooks';
import { Section } from '@components/ui/Primitives';

const pages = {
  '/legal/privacy': { title: 'Privacy Policy', content: 'StackFox (operated by Artwall Labs) is committed to protecting your privacy. We collect only the information necessary to provide our services: name, email, phone, company details, and project data. We use industry-standard encryption (TLS 1.3) for all data in transit and AES-256 for data at rest. We never sell your data to third parties. You can request data deletion at any time by emailing stackfox.tech@gmail.com.' },
  '/legal/terms': { title: 'Terms of Service', content: 'By using StackFox, you agree to these terms. All prices shown are indicative and may vary based on project requirements. Final pricing is confirmed in your quote/proposal. Payment terms are net-15 unless otherwise agreed. All intellectual property created during a project is transferred to the client upon full payment. StackFox retains the right to showcase completed work in our portfolio unless an NDA prohibits this.' },
  '/legal/refunds': { title: 'Refund Policy', content: 'We offer milestone-based billing, so you only pay for completed work. If a milestone deliverable does not meet the agreed specifications, we will revise it at no additional cost. If we are unable to deliver, a full refund will be issued for the undelivered milestone within 7 business days. Refunds are not available for completed and approved milestones.' },
  '/legal/sla': { title: 'Service Level Agreement', content: 'For clients on maintenance retainers: we guarantee 99.9% uptime for managed infrastructure, response time under 4 hours for critical issues, and under 24 hours for non-critical issues. Monthly reporting includes uptime metrics, incident logs, and performance summaries. SLA credits apply when targets are missed.' },
};

export default function Legal() {
  const location = useLocation();
  const page = pages[location.pathname] || pages['/legal/privacy'];
  usePageTitle(page.title);

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-display-md text-warm-900 mb-6">{page.title}</h1>
        <div className="text-body-md text-warm-600 leading-relaxed space-y-4">
          <p>{page.content}</p>
          <p className="text-sm text-warm-400 mt-8">Last updated: January 2025. For questions, email stackfox.tech@gmail.com.</p>
        </div>
      </div>
    </Section>
  );
}

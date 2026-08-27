import { useState, useEffect } from 'react';
import { FileText, PenTool, ShieldCheck, CheckCircle2, AlertTriangle, Lock, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { formatINR } from '@lib/utils';
import api from '@lib/api';

const STACKFOX = {
  name: 'StackFox Technologies',
  legal: 'StackFox Technologies, a division of Artwall Labs',
  address: 'Artwall Labs, Jaipur, Rajasthan, India',
  gstin: '27AAACS1234A1Z5',
  email: 'legal@stackfox.in',
};

const CONTRACT_TYPE_LABELS = {
  SOW: 'Statement of Work',
  MSA: 'Master Service Agreement',
  NDA: 'Non-Disclosure Agreement',
  IP_WFH: 'IP Assignment (Work for Hire)',
  DPA: 'Data Processing Agreement',
  MICRO_SOW: 'Micro Statement of Work',
};

const CONTRACT_CLAUSES = {
  SOW: {
    title: 'Statement of Work (SOW)',
    preamble: 'This Statement of Work ("SOW") is entered into as of the Effective Date and defines the scope, deliverables, timelines, and commercial terms for the professional services engagement between StackFox Technologies ("Provider") and the undersigned client ("Client").',
    sections: [
      {
        heading: '1. Scope of Services',
        clauses: [
          'The Provider shall deliver the professional services described in the service items attached to this SOW, including all deliverables, documentation, and support as specified herein.',
          'The scope of work is limited to the services expressly listed. Any additional services, features, or modifications not described in this SOW shall require a formal Change Request ("CR") signed by both parties before work commences.',
          'The Provider reserves the right to propose alternative technical approaches that achieve the same functional outcomes, subject to Client approval.',
        ],
      },
      {
        heading: '2. Deliverables & Acceptance',
        clauses: [
          'Each deliverable shall be submitted to the Client for review upon completion of the relevant milestone. The Client shall have seven (7) business days from the date of delivery to review and either accept or provide written objections.',
          'If the Client fails to respond within the review period, the deliverable shall be deemed accepted. Acceptance shall not be unreasonably withheld provided the deliverable materially conforms to the specifications.',
          'Defects or non-conformities identified during the review period shall be remedied by the Provider at no additional cost within a reasonable timeframe.',
        ],
      },
      {
        heading: '3. Timeline & Milestones',
        clauses: [
          'The project timeline and milestone schedule are set forth in the engagement details. Time estimates are based on the scope as defined and assume timely Client cooperation, feedback, and provision of required materials.',
          'Delays caused by the Client (including but not limited to delayed feedback, unavailability of key stakeholders, or change in requirements) shall extend the timeline proportionally and may result in revised pricing.',
          'Force majeure events (natural disasters, pandemics, government actions, cyberattacks) shall suspend obligations for the duration of the event, with neither party liable for resulting delays.',
        ],
      },
      {
        heading: '4. Change Management',
        clauses: [
          'All changes to scope, deliverables, or timelines must be documented via a formal Change Request. Each CR shall specify the nature of the change, impact on timeline and cost, and require written approval from authorized representatives of both parties.',
          'The Provider shall assess each CR within three (3) business days and provide a written impact assessment including revised timeline and cost estimates.',
          'Work on changes shall not commence until the CR is formally approved. Verbal or informal approvals do not constitute authorization.',
        ],
      },
      {
        heading: '5. Warranties',
        clauses: [
          'The Provider warrants that all services shall be performed in a professional and workmanlike manner consistent with generally accepted industry standards.',
          'Deliverables shall be free from material defects for a period of thirty (30) days following acceptance ("Warranty Period"). During this period, the Provider shall remedy any material defects at no additional cost.',
          'EXCEPT AS EXPRESSLY SET FORTH HEREIN, THE PROVIDER DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
        ],
      },
    ],
  },
  MSA: {
    title: 'Master Service Agreement (MSA)',
    preamble: 'This Master Service Agreement ("MSA") establishes the overarching legal framework governing the business relationship between StackFox Technologies ("Provider") and the undersigned client ("Client") for all current and future engagements.',
    sections: [
      {
        heading: '1. Relationship of Parties',
        clauses: [
          'The Provider is engaged as an independent contractor. Nothing in this Agreement shall create a partnership, joint venture, agency, or employment relationship between the parties.',
          'The Provider shall retain full control over the manner and means of performing the services, including the right to assign qualified personnel and subcontractors at its discretion, subject to confidentiality obligations.',
          'Neither party shall have authority to bind the other to any agreement, contract, or obligation without prior written consent.',
        ],
      },
      {
        heading: '2. Payment Terms',
        clauses: [
          'All invoices are due within fifteen (15) days of the invoice date unless otherwise specified in the applicable SOW. Payments shall be made in Indian Rupees (INR) via electronic transfer or such other method as agreed.',
          'Late payments shall accrue interest at the rate of 1.5% per month (or the maximum rate permitted by law, whichever is lower) from the due date until full payment is received.',
          'The Client shall reimburse the Provider for all reasonable pre-approved out-of-pocket expenses incurred in connection with the services, supported by itemized receipts.',
          'All amounts are exclusive of applicable taxes (including GST). The Client shall be responsible for all applicable taxes, and the Provider shall issue tax-compliant invoices.',
        ],
      },
      {
        heading: '3. Confidentiality',
        clauses: [
          'Each party ("Receiving Party") shall maintain the confidentiality of all non-public information received from the other party ("Disclosing Party") and shall not disclose such information to any third party without prior written consent.',
          'Confidential information includes, without limitation: business plans, financial data, technical specifications, source code, customer data, trade secrets, and any information marked as confidential.',
          'These confidentiality obligations shall survive for three (3) years following the termination or expiration of this Agreement.',
          'Exceptions: information that (a) is or becomes publicly available through no fault of the Receiving Party; (b) was known to the Receiving Party prior to disclosure; (c) is independently developed without reference to the Confidential Information; or (d) is required to be disclosed by law or court order.',
        ],
      },
      {
        heading: '4. Limitation of Liability',
        clauses: [
          'TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITY, REGARDLESS OF THE THEORY OF LIABILITY.',
          'The Provider\'s total aggregate liability under this Agreement shall not exceed the total fees actually paid by the Client under the applicable SOW in the twelve (12) months preceding the claim.',
          'These limitations shall not apply to: (a) breaches of confidentiality obligations; (b) willful misconduct or gross negligence; (c) infringement of intellectual property rights; or (d) obligations to indemnify third-party claims.',
        ],
      },
      {
        heading: '5. Termination',
        clauses: [
          'Either party may terminate this Agreement for convenience upon thirty (30) days\' prior written notice. Upon such termination, the Client shall pay for all services rendered and expenses incurred through the effective date of termination.',
          'Either party may terminate immediately upon written notice if the other party: (a) commits a material breach that remains uncured for fifteen (15) days after written notice; (b) becomes insolvent or files for bankruptcy; or (c) ceases to conduct business in the normal course.',
          'Upon termination, each party shall return or destroy all Confidential Information of the other party. The Provider shall deliver all completed work product and work-in-progress to the Client upon receipt of all outstanding payments.',
          'Sections relating to confidentiality, limitation of liability, indemnification, intellectual property, and dispute resolution shall survive termination.',
        ],
      },
      {
        heading: '6. Indemnification',
        clauses: [
          'The Provider shall indemnify and hold harmless the Client from any third-party claims arising from: (a) the Provider\'s gross negligence or willful misconduct; (b) infringement of third-party intellectual property rights by the deliverables (excluding Client-provided materials).',
          'The Client shall indemnify and hold harmless the Provider from any third-party claims arising from: (a) the Client\'s use of deliverables in a manner not contemplated by this Agreement; (b) materials, content, or data provided by the Client.',
        ],
      },
      {
        heading: '7. Non-Solicitation',
        clauses: [
          'During the term of this Agreement and for a period of twelve (12) months following termination, neither party shall directly or indirectly solicit, hire, or engage any employee, contractor, or consultant of the other party who was involved in the performance of services under this Agreement.',
          'This restriction does not apply to general recruitment advertising not specifically targeted at the other party\'s personnel.',
        ],
      },
      {
        heading: '8. Dispute Resolution & Governing Law',
        clauses: [
          'This Agreement shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.',
          'Any dispute arising out of or in connection with this Agreement shall first be attempted to be resolved through good-faith negotiations between senior representatives of both parties within thirty (30) days.',
          'If negotiations fail, the dispute shall be referred to and finally resolved by arbitration administered under the Arbitration and Conciliation Act, 1996, with a sole arbitrator appointed by mutual consent. The seat of arbitration shall be Jaipur, Rajasthan, India.',
          'The courts of Jaipur, Rajasthan shall have exclusive jurisdiction for any matters not subject to arbitration.',
        ],
      },
    ],
  },
  NDA: {
    title: 'Non-Disclosure Agreement (NDA)',
    preamble: 'This Non-Disclosure Agreement ("NDA") is entered into to protect proprietary and confidential information exchanged between StackFox Technologies ("Provider") and the undersigned client ("Client") in connection with the evaluation and performance of professional services.',
    sections: [
      {
        heading: '1. Definition of Confidential Information',
        clauses: [
          '"Confidential Information" means any and all non-public information disclosed by either party to the other, whether orally, in writing, electronically, or by inspection of tangible objects, including but not limited to: source code, object code, algorithms, technical data, trade secrets, know-how, inventions, processes, designs, drawings, engineering, product plans, business strategies, customer lists, financial information, and personnel information.',
          'Confidential Information shall also include the existence and terms of this engagement, project details, pricing, and any information that a reasonable person would understand to be confidential given the nature of the information and circumstances of disclosure.',
        ],
      },
      {
        heading: '2. Obligations of Receiving Party',
        clauses: [
          'The Receiving Party shall: (a) use the Confidential Information solely for the purpose of performing or evaluating services under this engagement; (b) restrict disclosure to employees, contractors, and advisors who have a need to know and are bound by confidentiality obligations no less restrictive than those herein.',
          'The Receiving Party shall protect Confidential Information with the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.',
          'The Receiving Party shall promptly notify the Disclosing Party upon discovery of any unauthorized use or disclosure of Confidential Information.',
        ],
      },
      {
        heading: '3. Exclusions',
        clauses: [
          'Confidential Information does not include information that: (a) is or becomes generally available to the public other than as a result of disclosure by the Receiving Party; (b) was available to the Receiving Party on a non-confidential basis prior to disclosure; (c) is independently developed by the Receiving Party without use of or reference to the Confidential Information; or (d) becomes available to the Receiving Party from a source other than the Disclosing Party, provided that source is not bound by a confidentiality obligation.',
        ],
      },
      {
        heading: '4. Compelled Disclosure',
        clauses: [
          'If the Receiving Party is compelled by law, regulation, or court order to disclose Confidential Information, it shall provide the Disclosing Party with prompt written notice (to the extent legally permitted) so the Disclosing Party may seek a protective order or other remedy.',
          'The Receiving Party shall disclose only that portion of the Confidential Information that is legally required and shall use commercially reasonable efforts to obtain confidential treatment for any such disclosed information.',
        ],
      },
      {
        heading: '5. Term & Return of Materials',
        clauses: [
          'The obligations under this NDA shall survive for a period of five (5) years from the date of disclosure of the applicable Confidential Information, or until such information ceases to be confidential, whichever occurs first.',
          'Upon termination of the engagement or upon request by the Disclosing Party, the Receiving Party shall promptly return or destroy all materials containing Confidential Information and certify such return or destruction in writing.',
        ],
      },
      {
        heading: '6. Remedies',
        clauses: [
          'The parties acknowledge that a breach of this NDA may cause irreparable harm for which monetary damages would be an inadequate remedy. Accordingly, the non-breaching party shall be entitled to seek injunctive or equitable relief in addition to any other remedies available at law.',
          'The prevailing party in any action to enforce this NDA shall be entitled to recover reasonable attorneys\' fees and costs.',
        ],
      },
    ],
  },
  IP_WFH: {
    title: 'IP Assignment Deed (Work for Hire)',
    preamble: 'This Intellectual Property Assignment Deed ("IP Deed") governs the ownership, assignment, and licensing of intellectual property created during the engagement between StackFox Technologies ("Provider") and the undersigned client ("Client").',
    sections: [
      {
        heading: '1. Ownership & Assignment',
        clauses: [
          'All intellectual property rights in custom work product created specifically for the Client under this engagement ("Client Work Product"), including but not limited to software, designs, documentation, and related materials, shall be owned by and assigned to the Client upon full payment of all applicable fees.',
          'The Provider hereby irrevocably assigns to the Client all right, title, and interest in and to the Client Work Product, including all copyrights, patent rights, trade secret rights, and other intellectual property rights therein.',
          'The assignment is contingent upon full payment. Until all fees are paid in full, the Provider retains a security interest in the Client Work Product.',
        ],
      },
      {
        heading: '2. Provider Retained Rights',
        clauses: [
          'Notwithstanding the foregoing, the Provider retains all rights to: (a) pre-existing intellectual property, tools, libraries, and frameworks that existed prior to this engagement ("Provider Tools"); (b) general knowledge, skills, experience, and know-how gained during the engagement; (c) generic, non-client-specific components, patterns, and methodologies developed during the engagement ("Generic Components").',
          'The Client is hereby granted a perpetual, royalty-free, non-exclusive license to use any Provider Tools and Generic Components incorporated into the Client Work Product, solely in connection with the Client\'s use of the deliverables.',
        ],
      },
      {
        heading: '3. Third-Party Components',
        clauses: [
          'Deliverables may incorporate open-source software or third-party components subject to their respective license terms. The Provider shall disclose all such components and their applicable licenses prior to delivery.',
          'The Client acknowledges that its use of third-party components is subject to the terms and conditions of the applicable third-party licenses, and the Provider makes no warranties regarding such components beyond verifying license compatibility.',
        ],
      },
      {
        heading: '4. Moral Rights',
        clauses: [
          'To the extent permitted by applicable law, the Provider and its personnel waive any and all moral rights (including rights of attribution and integrity) in the Client Work Product.',
          'Where moral rights cannot be waived under applicable law, the Provider agrees not to assert such rights against the Client or its successors in connection with any use of the Client Work Product.',
        ],
      },
      {
        heading: '5. Portfolio & Reference Rights',
        clauses: [
          'The Provider may use the Client\'s name and a general description of the project (without disclosing Confidential Information) in its portfolio, case studies, and marketing materials, unless the Client provides written objection within fourteen (14) days of project completion.',
        ],
      },
    ],
  },
  DPA: {
    title: 'Data Processing Agreement (DPA)',
    preamble: 'This Data Processing Agreement ("DPA") is entered into in compliance with applicable data protection laws, including the Digital Personal Data Protection Act, 2023 ("DPDP Act") and, where applicable, the EU General Data Protection Regulation ("GDPR"). This DPA governs the processing of personal data by StackFox Technologies ("Processor") on behalf of the undersigned client ("Controller").',
    sections: [
      {
        heading: '1. Scope & Processing Instructions',
        clauses: [
          'The Processor shall process personal data only on documented instructions from the Controller, including with regard to transfers of personal data to a third country, unless required to do so by applicable law.',
          'The categories of personal data, data subjects, and purpose of processing shall be as set forth in the applicable SOW or as otherwise documented by the Controller.',
          'The Processor shall immediately inform the Controller if, in its opinion, an instruction infringes applicable data protection law.',
        ],
      },
      {
        heading: '2. Security Measures',
        clauses: [
          'The Processor shall implement and maintain appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including as appropriate: (a) encryption of personal data in transit and at rest; (b) access controls and authentication mechanisms; (c) regular security testing and vulnerability assessments; (d) measures to ensure ongoing confidentiality, integrity, availability, and resilience of processing systems.',
          'The Processor shall ensure that personnel authorized to process personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.',
        ],
      },
      {
        heading: '3. Sub-processors',
        clauses: [
          'The Processor shall not engage another processor ("Sub-processor") without prior written authorization of the Controller. The Processor shall maintain a current list of Sub-processors and notify the Controller of any intended changes.',
          'Where the Processor engages a Sub-processor, it shall impose the same data protection obligations as set out in this DPA by way of a written agreement, and shall remain fully liable to the Controller for the performance of the Sub-processor\'s obligations.',
        ],
      },
      {
        heading: '4. Data Subject Rights',
        clauses: [
          'The Processor shall assist the Controller in responding to requests from data subjects exercising their rights under applicable data protection law (including rights of access, rectification, erasure, portability, and objection).',
          'The Processor shall promptly notify the Controller if it receives a request directly from a data subject and shall not respond to such request except on the Controller\'s instructions.',
        ],
      },
      {
        heading: '5. Data Breach Notification',
        clauses: [
          'The Processor shall notify the Controller without undue delay (and in no event later than forty-eight (48) hours) after becoming aware of a personal data breach. Such notification shall include: (a) the nature of the breach including, where possible, the categories and approximate number of data subjects and records concerned; (b) the likely consequences of the breach; (c) the measures taken or proposed to be taken to address the breach.',
          'The Processor shall cooperate with the Controller and take reasonable commercial steps to assist in the investigation, mitigation, and remediation of each such breach.',
        ],
      },
      {
        heading: '6. Data Retention & Deletion',
        clauses: [
          'Upon termination of the engagement or upon the Controller\'s request, the Processor shall, at the Controller\'s election, return all personal data or securely delete all personal data and certify such deletion in writing, unless applicable law requires retention.',
          'The Processor shall delete or anonymize personal data that is no longer necessary for the purpose for which it was collected within thirty (30) days.',
        ],
      },
      {
        heading: '7. Audit Rights',
        clauses: [
          'The Processor shall make available to the Controller all information necessary to demonstrate compliance with this DPA and shall allow for and contribute to audits, including inspections, conducted by the Controller or a third-party auditor mandated by the Controller.',
          'Audits shall be conducted with reasonable notice (at least fourteen (14) days) during normal business hours and shall not unreasonably interfere with the Processor\'s business operations.',
        ],
      },
    ],
  },
  MICRO_SOW: {
    title: 'Micro Statement of Work',
    preamble: 'This Micro Statement of Work ("Micro SOW") defines the scope and terms for the selected Starter-tier services to be delivered by StackFox Technologies ("Provider") to the undersigned client ("Client"). This is a simplified agreement suitable for smaller engagements.',
    sections: [
      {
        heading: '1. Services & Delivery',
        clauses: [
          'The Provider shall deliver the services listed in the attached service items within fourteen (14) business days of payment confirmation, unless a different timeline is specified.',
          'The scope is limited to the services expressly selected. Any additions or modifications shall require a separate agreement or upgrade to a Growth/Premium tier engagement.',
        ],
      },
      {
        heading: '2. Revisions & Acceptance',
        clauses: [
          'Up to two (2) rounds of minor revisions are included at no additional cost. Minor revisions include adjustments to content, colors, layout, and similar cosmetic changes that do not alter the fundamental scope or functionality.',
          'Major revisions (new features, structural changes, scope additions) require a new SOW or Change Request and may incur additional fees.',
          'Deliverables are deemed accepted if the Client does not provide written objection within five (5) business days of delivery.',
        ],
      },
      {
        heading: '3. Payment',
        clauses: [
          'Payment is 100% upfront. No milestone billing applies for Starter-tier engagements.',
          'Refunds are available within seven (7) days of payment if work has not commenced. Once work has commenced, fees are non-refundable, though the Provider shall complete the agreed deliverables.',
        ],
      },
      {
        heading: '4. Intellectual Property',
        clauses: [
          'Upon full payment, the Client shall own all custom deliverables created specifically for this engagement. The Provider retains rights to generic tools, frameworks, and components as described in the IP Assignment terms.',
          'Third-party components (including open-source software) are subject to their respective licenses.',
        ],
      },
      {
        heading: '5. Limitation of Liability',
        clauses: [
          'The Provider\'s total liability under this Micro SOW shall not exceed the total fees paid by the Client. Neither party shall be liable for indirect, incidental, or consequential damages.',
        ],
      },
      {
        heading: '6. Governing Law',
        clauses: [
          'This Micro SOW shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Jaipur, Rajasthan.',
        ],
      },
    ],
  },
};

export default function ContractSigning({ quote, account, tier, onContinue, onBack }) {
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState({ terms: false, accuracy: false, services: false });
  const [signed, setSigned] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState({});
  const [saving, setSaving] = useState(false);

  const contractTypes = tier === 'STARTER' ? ['MICRO_SOW']
    : tier === 'GROWTH' ? ['SOW', 'MSA']
    : ['SOW', 'MSA', 'NDA', 'IP_WFH', 'DPA'];

  const toggleType = (type) => {
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const canSign = signature.trim().length >= 3 && agreed.terms && agreed.accuracy && agreed.services;

  const handleSign = async () => {
    if (!canSign) return;
    setSaving(true);

    try {
      await api.patch(`/quotes/${quote._id || quote.id}`, {
        checkoutDetails: {
          contractSigned: true,
          signatureName: signature.trim(),
          signedAt: new Date().toISOString(),
          contractTypes,
          clauseSelections: contractTypes.reduce((acc, t) => {
            acc[t] = { accepted: true, version: 1 };
            return acc;
          }, {}),
        },
      });
    } catch {
      // Non-fatal — contract data will be saved on provisioning anyway
    }

    setSigned(true);
    setSaving(false);
  };

  useEffect(() => {
    if (signed && onContinue) {
      const timer = setTimeout(() => onContinue(), 1800);
      return () => clearTimeout(timer);
    }
  }, [signed, onContinue]);

  if (signed) {
    return (
      <div className="space-y-4">
        <h2 className="font-bold text-warm-900 flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-500" /> Contracts Executed
        </h2>
        <div className="bg-white rounded-2xl border border-warm-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-emerald-600" size={28} />
          </div>
          <h3 className="text-xl font-bold text-warm-900 mb-2">All Documents Signed</h3>
          <p className="text-sm text-warm-600 mb-1">
            Signed by: <span className="font-semibold text-warm-900">{signature}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3 mb-4">
            {contractTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">
                <CheckCircle2 size={10} /> {CONTRACT_TYPE_LABELS[t] || t}
              </span>
            ))}
          </div>
          <p className="text-xs text-warm-400">
            A copy will be sent to {account.email || 'your email'} and {STACKFOX.email} upon payment confirmation.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-mono text-warm-400 bg-warm-50 px-3 py-1.5 rounded-full">
            <Lock size={10} /> Digitally recorded · {new Date().toISOString()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-warm-900 flex items-center gap-2">
        <Scale size={18} className="text-fox-500" /> Review &amp; Sign Legal Agreements
      </h2>
      <p className="text-xs text-warm-500">
        Please review all {contractTypes.length} contract document{contractTypes.length > 1 ? 's' : ''} below before signing. These form a legally binding agreement between you and {STACKFOX.name}.
      </p>

      {/* Contract header */}
      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
        <div className="bg-warm-50 px-5 py-3 border-b border-warm-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Legal Document Suite</div>
              <div className="text-xs text-warm-600 mt-0.5 flex flex-wrap gap-2">
                {contractTypes.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <FileText size={10} className="text-fox-500" /> {CONTRACT_TYPE_LABELS[t] || t}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-warm-400">{quote.quoteNumber}</div>
              <div className="text-[10px] text-warm-400">
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-warm-900">Service Agreement</h3>
              <p className="text-xs text-warm-500 mt-0.5">
                Between <span className="font-semibold text-warm-700">{STACKFOX.legal}</span> ("Provider") and <span className="font-semibold text-warm-700">{account.name || 'the Client'}</span> ("Client")
              </p>
            </div>
            <div className="text-right text-[11px] text-warm-500 shrink-0">
              <div className="flex items-center gap-1 justify-end"><ShieldCheck size={10} className="text-fox-500" /> Legally Binding</div>
              <div className="mt-0.5">GSTIN: {STACKFOX.gstin}</div>
            </div>
          </div>

          {/* Expandable contract documents */}
          <div className="space-y-3">
            {contractTypes.map((type) => {
              const doc = CONTRACT_CLAUSES[type];
              if (!doc) return null;
              const isExpanded = expandedTypes[type] !== false; // Default open

              return (
                <div key={type} className="border border-warm-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-warm-50 hover:bg-warm-100 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-fox-500" />
                      <span className="text-sm font-bold text-warm-900">{doc.title}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-warm-400" /> : <ChevronDown size={16} className="text-warm-400" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
                      <p className="text-xs text-warm-600 italic leading-relaxed">{doc.preamble}</p>

                      {doc.sections.map((section, si) => (
                        <div key={si}>
                          <h4 className="text-xs font-bold text-warm-800 mb-1.5">{section.heading}</h4>
                          <div className="space-y-1.5">
                            {section.clauses.map((clause, ci) => (
                              <p key={ci} className="text-[11px] text-warm-600 leading-relaxed pl-3 border-l-2 border-warm-200">
                                {clause}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Service Acknowledgement */}
      <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
        <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <AlertTriangle size={12} /> Service Acknowledgement
        </div>
        <p className="text-[11px] text-amber-800 mb-3">
          I confirm and authorize StackFox Technologies to deliver the following services under the terms described above:
        </p>
        <div className="space-y-2">
          {quote.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
              <span className="text-xs text-amber-900 font-medium">
                {item.name} {item.quantity > 1 && <span className="text-amber-600">(x{item.quantity})</span>}
              </span>
              <span className="text-xs font-mono text-amber-700">{formatINR(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-amber-300/50 flex justify-between text-xs font-bold text-amber-900">
          <span>Total Contract Value (incl. GST)</span>
          <span className="font-mono">{formatINR(quote.total)}</span>
        </div>
        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed.services}
            onChange={() => setAgreed({ ...agreed, services: !agreed.services })}
            className="mt-0.5 w-4 h-4 accent-fox-500"
          />
          <span className="text-xs text-amber-900">I authorize the delivery of all listed services and acknowledge the total contract value.</span>
        </label>
      </div>

      {/* Digital Signature */}
      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-4">
        <h3 className="font-semibold text-warm-900 flex items-center gap-2">
          <PenTool size={16} className="text-fox-500" /> Digital Signature
        </h3>
        <p className="text-xs text-warm-500">
          By typing your full legal name below, you acknowledge that this constitutes a legally binding electronic signature under the Information Technology Act, 2000 and applicable Indian law.
        </p>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="Type your full legal name as signature"
          className="w-full border-b-2 border-warm-300 focus:border-fox-500 outline-none text-xl py-3 font-serif text-warm-900 bg-transparent transition"
        />
        {signature.trim() && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-warm-500">
              Signature: <span className="font-serif text-lg text-warm-900 italic">{signature}</span>
            </p>
            <span className="text-[10px] text-warm-400 font-mono">{new Date().toLocaleDateString('en-IN')}</span>
          </div>
        )}
      </div>

      {/* Legal Agreements */}
      <div className="bg-white rounded-2xl border border-warm-200 p-5 space-y-3">
        <h3 className="text-xs font-bold text-warm-400 uppercase tracking-widest mb-2">Legal Acknowledgements</h3>
        {[
          { key: 'terms', label: `I have read, understood, and agree to all terms and conditions in the ${contractTypes.length} contract document${contractTypes.length > 1 ? 's' : ''} listed above, including the clauses on limitation of liability, indemnification, confidentiality, and intellectual property.` },
          { key: 'accuracy', label: 'I confirm that all information provided during this checkout process is accurate and complete, and I understand that any material misrepresentation may void these agreements.' },
        ].map((item) => (
          <label key={item.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed[item.key]}
              onChange={() => setAgreed({ ...agreed, [item.key]: !agreed[item.key] })}
              className="mt-1 w-4 h-4 accent-fox-500"
            />
            <span className="text-[11px] text-warm-700 leading-relaxed">{item.label}</span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-sm text-warm-500 hover:text-warm-800 font-medium flex items-center gap-1"
        >
          ← Back
        </button>
        <button
          onClick={handleSign}
          disabled={!canSign || saving}
          className={`px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition ${
            canSign && !saving
              ? 'bg-fox-500 text-white hover:bg-fox-600 shadow-lg shadow-fox-500/20'
              : 'bg-warm-200 text-warm-400 cursor-not-allowed'
          }`}
        >
          <PenTool size={16} />
          {saving ? 'Signing...' : `Sign ${contractTypes.length} Document${contractTypes.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

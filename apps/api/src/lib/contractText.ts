/**
 * The wording of each contract type.
 *
 * Plain language on purpose: short numbered clauses a client can read in a
 * few minutes. Facts (parties, scope, fees, schedule) come from the database
 * and are filled in here; nothing below is invented per client.
 *
 * This is a working template, not legal advice. Have counsel review it before
 * it is relied on, and bump TEMPLATE_VERSION when the wording changes so an
 * executed copy can always be traced to the text that was agreed.
 */
import { SUPPLIER } from "./companyInvoice";

export const TEMPLATE_VERSION = 2;

export interface Clause {
  heading: string;
  paragraphs: string[];
}

export interface ContractContext {
  clientName: string;
  clientKind?: string;
  clientGstin?: string | null;
  clientAddress?: string | null;
  engagementId: string;
  projects: string[];
  /** Milestone name and share of the fee, in delivery order. */
  schedule: Array<{ name: string; pct: number }>;
  /** Preformatted amounts, e.g. "Rs 58,410.00". Null when not yet quoted. */
  feeTotal: string | null;
  feeTax: string | null;
  revisionRounds: number;
  effectiveDate: string;
}

export interface ContractTemplate {
  /** Shown small above the title. */
  label: string;
  title: string;
  /** One line under the title saying what this document does. */
  summary: string;
  clauses: Clause[];
  /** Shown as a table after the clauses (the SOW's schedule). */
  showSchedule?: boolean;
}

const PROVIDER = SUPPLIER.legalName
  .toLowerCase()
  .replace(/\b\w/g, (c) => c.toUpperCase());

const LAW: Clause = {
  heading: "Governing law",
  paragraphs: [
    "This agreement is governed by the laws of India. The courts at Jaipur, Rajasthan have exclusive jurisdiction.",
  ],
};

const ELECTRONIC: Clause = {
  heading: "Electronic signature",
  paragraphs: [
    "The parties may sign electronically. An electronic signature has the same effect as a handwritten one under the Information Technology Act, 2000.",
  ],
};

const list = (items: string[]) =>
  items.length ? items.join("; ") : "the services in the accepted quote";

export function templateFor(type: string, c: ContractContext): ContractTemplate {
  switch (type) {
    case "MSA":
      return {
        label: "Master Service Agreement",
        title: "Master Service Agreement",
        summary: "The terms that apply to all work between us.",
        clauses: [
          {
            heading: "Purpose",
            paragraphs: [
              `This agreement sets the terms on which ${PROVIDER} ("StackFox") provides services to ${c.clientName} (the "Client"). Each piece of work is described in a Statement of Work, which forms part of this agreement.`,
            ],
          },
          {
            heading: "Our services",
            paragraphs: [
              "StackFox will carry out the services with reasonable skill and care, using suitably qualified people, to the specification in the Statement of Work.",
            ],
          },
          {
            heading: "Your responsibilities",
            paragraphs: [
              "The Client will provide the content, access and information StackFox reasonably needs, and will give feedback and decisions within five business days. Delays on the Client's side may move the delivery dates.",
            ],
          },
          {
            heading: "Fees and payment",
            paragraphs: [
              "Fees are set out in the Statement of Work. Invoices are payable within 30 days. GST is charged in addition at the applicable rate. Where the Client must deduct tax at source, it will pay the balance and provide the certificate.",
              "Late payments may carry interest as permitted by law, and StackFox may pause work while an invoice is overdue.",
            ],
          },
          {
            heading: "Changes",
            paragraphs: [
              "Either party may ask for a change to the scope. StackFox will say what the change does to the fee and the timeline. A change takes effect only when both parties agree to it in writing.",
            ],
          },
          {
            heading: "Ownership",
            paragraphs: [
              "When the fees for a deliverable are paid in full, ownership of that deliverable passes to the Client. StackFox keeps its pre-existing tools, libraries and know-how, and gives the Client a perpetual licence to use them as part of the deliverable. Open-source and third-party components stay under their own licences.",
            ],
          },
          {
            heading: "Confidentiality",
            paragraphs: [
              "Each party will keep the other's non-public information confidential, use it only for this engagement, and protect it with the care it uses for its own. Where the parties have signed a separate confidentiality agreement, that agreement prevails on this subject.",
            ],
          },
          {
            heading: "Warranty and liability",
            paragraphs: [
              "StackFox warrants that a deliverable will materially match its specification for 30 days after delivery, and will correct any defect reported in that time at no charge.",
              "Except for liability that cannot be limited by law, neither party is liable for indirect or consequential loss, and StackFox's total liability under this agreement is limited to the fees paid in the 12 months before the claim.",
            ],
          },
          {
            heading: "Ending this agreement",
            paragraphs: [
              "Either party may end this agreement with 30 days' written notice, or immediately if the other commits a serious breach and does not fix it within 15 days of written notice. The Client pays for work done up to the end date.",
            ],
          },
          LAW,
          ELECTRONIC,
        ],
      };

    case "SOW":
      return {
        label: "Statement of Work",
        title: "Statement of Work",
        summary: "What we will deliver, when, and for how much.",
        showSchedule: true,
        clauses: [
          {
            heading: "Scope",
            paragraphs: [
              `StackFox will deliver: ${list(c.projects)}. Anything not listed here is outside this Statement of Work and can be added as a change.`,
            ],
          },
          {
            heading: "Schedule and payment",
            paragraphs: [
              "Work is delivered in the milestones below. Each milestone is invoiced for the share shown once the Client approves it.",
            ],
          },
          {
            heading: "Fees",
            paragraphs: [
              c.feeTotal
                ? `The total fee is ${c.feeTotal}${c.feeTax ? `, which includes GST of ${c.feeTax}` : ""}.`
                : "The total fee is as set out in the accepted quote.",
            ],
          },
          {
            heading: "Reviews",
            paragraphs: [
              `The Client reviews each milestone within five business days of it being submitted. Each milestone includes up to ${c.revisionRounds} rounds of revisions. Further rounds are treated as a change and quoted separately.`,
              "If the Client does not respond within that time, the milestone is treated as accepted.",
            ],
          },
          {
            heading: "Assumptions",
            paragraphs: [
              "The Client supplies content, brand assets and access on time. The scope reflects the information given at the time of the quote; material differences may change the fee or timeline.",
            ],
          },
          {
            heading: "Relationship to other documents",
            paragraphs: [
              "This Statement of Work is governed by the Master Service Agreement between the parties. If they conflict, this document prevails for this project only.",
            ],
          },
          ELECTRONIC,
        ],
      };

    case "NDA":
      return {
        label: "Non-Disclosure Agreement",
        title: "Non-Disclosure Agreement",
        summary: "Both sides keep each other's information private.",
        clauses: [
          {
            heading: "What is confidential",
            paragraphs: [
              "Confidential information is anything non-public that one party shares with the other in connection with this engagement, whether written, spoken or electronic, including business plans, source code, designs, data and pricing.",
            ],
          },
          {
            heading: "What each party will do",
            paragraphs: [
              "Each party will use the other's confidential information only for this engagement, keep it secret, share it only with people who need it and are bound to the same standard, and protect it with at least reasonable care.",
            ],
          },
          {
            heading: "What is not covered",
            paragraphs: [
              "Information that is or becomes public without breach, was already known to the receiving party, was received lawfully from someone else, or was developed independently is not confidential. A party may disclose information where the law requires it, after telling the other party where it can.",
            ],
          },
          {
            heading: "How long it lasts",
            paragraphs: [
              "These obligations last for three years after the information is shared. For trade secrets and source code they continue for as long as the information stays confidential.",
            ],
          },
          {
            heading: "Returning information",
            paragraphs: [
              "On request, or when the engagement ends, each party will return or delete the other's confidential information, except copies it must keep by law.",
            ],
          },
          {
            heading: "No licence, and remedies",
            paragraphs: [
              "Sharing information gives no licence to it. A breach may cause harm that money cannot repair, so the affected party may ask a court for an injunction as well as other remedies.",
            ],
          },
          LAW,
          ELECTRONIC,
        ],
      };

    case "IP_WFH":
      return {
        label: "IP Assignment",
        title: "Intellectual Property Assignment",
        summary: "The Client owns the work that is made for it.",
        clauses: [
          {
            heading: "Assignment",
            paragraphs: [
              `On payment in full for a deliverable, StackFox assigns to ${c.clientName} all rights in that deliverable created specifically for the Client under this engagement, including copyright, anywhere in the world and for the full term of those rights.`,
            ],
          },
          {
            heading: "What StackFox keeps",
            paragraphs: [
              "StackFox keeps ownership of its pre-existing and general-purpose tools, frameworks, libraries and know-how. It gives the Client a perpetual, worldwide, royalty-free licence to use them as part of the deliverable.",
            ],
          },
          {
            heading: "Third-party components",
            paragraphs: [
              "Open-source and third-party components remain under their own licences, which StackFox will identify on request. This assignment does not change them.",
            ],
          },
          {
            heading: "Authorship credit",
            paragraphs: [
              "To the extent the law allows, StackFox waives moral rights in the deliverable. Unless the Client objects in writing, StackFox may describe the project in general terms in its portfolio, without revealing confidential information.",
            ],
          },
          {
            heading: "Further steps",
            paragraphs: [
              "StackFox will sign any document reasonably needed to record or enforce the Client's ownership, at the Client's cost.",
            ],
          },
          LAW,
          ELECTRONIC,
        ],
      };

    case "DPA":
      return {
        label: "Data Processing Agreement",
        title: "Data Processing Agreement",
        summary: "How personal data is handled while we work for you.",
        clauses: [
          {
            heading: "Roles",
            paragraphs: [
              "For personal data that StackFox handles on the Client's behalf, the Client decides the purpose and means (the data fiduciary) and StackFox processes it only on the Client's documented instructions (the data processor), as those terms are used in the Digital Personal Data Protection Act, 2023.",
            ],
          },
          {
            heading: "What StackFox will do",
            paragraphs: [
              "Process personal data only to provide the services; keep it confidential; and make sure everyone with access is bound to keep it confidential.",
            ],
          },
          {
            heading: "Security",
            paragraphs: [
              "StackFox uses reasonable safeguards, including encryption in transit, access limited to those who need it, and separation of client data, and keeps them in line with good industry practice.",
            ],
          },
          {
            heading: "Service providers",
            paragraphs: [
              "StackFox uses cloud hosting, database, storage and email providers to run its platform. It stays responsible for them and will tell the Client, on request, who they are and what they do.",
            ],
          },
          {
            heading: "If something goes wrong",
            paragraphs: [
              "StackFox will tell the Client without undue delay after becoming aware of a personal data breach affecting the Client's data, and will help the Client respond to it.",
            ],
          },
          {
            heading: "Requests from individuals",
            paragraphs: [
              "StackFox will reasonably help the Client to answer requests from people exercising their rights over their personal data.",
            ],
          },
          {
            heading: "When the engagement ends",
            paragraphs: [
              "On request, or when the engagement ends, StackFox will return or delete the Client's personal data, except copies it must keep by law.",
            ],
          },
          LAW,
          ELECTRONIC,
        ],
      };

    case "MICRO_SOW":
      return {
        label: "Service Order",
        title: "Service Order",
        summary: "A single fixed-price service, on simple terms.",
        showSchedule: false,
        clauses: [
          {
            heading: "Service",
            paragraphs: [
              `StackFox will deliver: ${list(c.projects)}, as described in the accepted quote.`,
            ],
          },
          {
            heading: "Fee",
            paragraphs: [
              c.feeTotal
                ? `The fixed fee is ${c.feeTotal}${c.feeTax ? `, including GST of ${c.feeTax}` : ""}, payable in full before work starts.`
                : "The fixed fee is as set out in the accepted quote, payable in full before work starts.",
            ],
          },
          {
            heading: "Delivery and acceptance",
            paragraphs: [
              `StackFox delivers the work once and the Client reviews it within five business days. One round of corrections is included (up to ${c.revisionRounds} where the quote says so). If the Client does not respond in that time, the work is treated as accepted.`,
            ],
          },
          {
            heading: "Ownership",
            paragraphs: [
              "On payment in full the Client owns what was made specifically for it. StackFox keeps its general tools and know-how and licenses them to the Client as part of the deliverable.",
            ],
          },
          {
            heading: "Liability",
            paragraphs: [
              "Except for liability that cannot be limited by law, StackFox's total liability is limited to the fee paid, and neither party is liable for indirect or consequential loss.",
            ],
          },
          LAW,
          ELECTRONIC,
        ],
      };

    default: {
      const readable = type
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (m) => m.toUpperCase());
      return {
        label: readable,
        title: readable,
        summary: "A document forming part of this engagement.",
        clauses: [
          {
            heading: "Terms",
            paragraphs: [
              `This ${readable} forms part of the engagement between ${PROVIDER} and ${c.clientName}. It is read with the Master Service Agreement and the Statement of Work, which prevail on any point they cover.`,
            ],
          },
          LAW,
          ELECTRONIC,
        ],
      };
    }
  }
}

/** The order documents appear in a pack: the framework first, then the detail. */
export const PACK_ORDER = ["MSA", "SOW", "MICRO_SOW", "NDA", "IP_WFH", "DPA"];

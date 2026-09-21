/**
 * Tier delivery policy: what a client gets at each tier.
 *
 * These were duplicated verbatim in routes/checkout.ts and routes/quotes.ts.
 * The two copies happened to agree, but nothing kept them agreeing — and the
 * provisioning code around them had already diverged on GST treatment, so the
 * drift was not hypothetical. Milestone percentages and contract sets decide
 * what a client is billed and what they legally sign; those belong in one
 * place.
 */

export interface MilestoneTemplate {
  name: string;
  /** Percentage of the engagement value invoiced at this milestone. Sums to 100. */
  pct: number;
  deliverables: string[];
}

const STARTER: MilestoneTemplate[] = [
  { name: "Delivery", pct: 100, deliverables: ["Deployed site", "Source code"] },
];

const GROWTH: MilestoneTemplate[] = [
  { name: "Design & Planning", pct: 30, deliverables: ["Wireframes", "Project plan"] },
  { name: "Development", pct: 40, deliverables: ["Staging deployment", "Core features"] },
  {
    name: "Review & Delivery",
    pct: 30,
    deliverables: ["Final deployment", "Documentation"],
  },
];

const PREMIUM: MilestoneTemplate[] = [
  {
    name: "Strategy & Discovery",
    pct: 20,
    deliverables: ["Strategy document", "Architecture review"],
  },
  { name: "Design", pct: 20, deliverables: ["Full design system", "Prototype"] },
  { name: "Development Phase 1", pct: 25, deliverables: ["Core features", "Staging"] },
  {
    name: "Development Phase 2",
    pct: 20,
    deliverables: ["All features", "Integration testing"],
  },
  {
    name: "QA, Delivery & Handover",
    pct: 15,
    deliverables: ["Production deployment", "Full documentation", "Training"],
  },
];

/** Milestone schedule for a tier. Unknown tiers fall back to PREMIUM, as both call sites did. */
export function getMilestoneTemplates(tier: string): MilestoneTemplate[] {
  if (tier === "STARTER") return STARTER;
  if (tier === "GROWTH") return GROWTH;
  return PREMIUM;
}

/** Contracts executed at each tier. */
export function getContractTypes(tier: string): string[] {
  if (tier === "STARTER") return ["MICRO_SOW"];
  if (tier === "GROWTH") return ["SOW", "MSA"];
  return ["SOW", "MSA", "NDA", "IP_WFH", "DPA"];
}

/**
 * Milestone percentages must sum to 100 or the sum of milestone invoices will
 * not equal the engagement value. Exported so a test can assert it for every
 * tier rather than trusting the literals above.
 */
export function milestonePctTotal(tier: string): number {
  return getMilestoneTemplates(tier).reduce((sum, m) => sum + m.pct, 0);
}

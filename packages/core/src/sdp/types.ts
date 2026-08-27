export interface SdpOverview {
  headline: string;
  subheadline: string;
  description: string;
  idealClient: string;
  complexity: "Simple" | "Moderate" | "Complex" | "Enterprise";
  categoryTier1: string;
  categoryTier2: string;
  tags: string[];
}

export interface SdpExclusion {
  item: string;
  reason: string;
}

export interface TechStackItem {
  name: string;
  icon?: string;
  category: "frontend" | "backend" | "database" | "infrastructure" | "tools" | "design";
}

export interface SdpFeature {
  id: string;
  name: string;
  description: string;
  weight: number;
  defaultState: "included" | "optional" | "excluded";
  acceptCriteria: string;
  dependencies: string[];
  sortOrder: number;
}

export interface SdpDeliverable {
  name: string;
  description: string;
  format: string;
  tier: "Starter" | "Growth" | "Premium" | "All";
}

export interface SdpDependency {
  type: "REQUIRES" | "RECOMMENDS" | "ENHANCES" | "CONFLICTS";
  targetServiceId: string;
  targetServiceName: string;
  reason: string;
}

export interface SdpMilestone {
  name: string;
  description: string;
  durationDays: number;
  deliverables: string[];
  tier: "Starter" | "Growth" | "Premium" | "All";
}

export interface SdpQaChecklistItem {
  category: string;
  items: string[];
}

export interface SdpPricingTier {
  tier: "Starter" | "Growth" | "Premium";
  label: string;
  price: number;
  priceDisplay: string;
  timelineDays: { min: number; max: number };
  designRounds: number;
  teamStructure: string;
  supportChannels: string[];
  portalAccess: string;
  warrantyDays: number;
  aiInvolvement: string;
  targetMargin: string;
  description: string;
}

export interface SdpTeamRole {
  role: string;
  allocation: string;
  tier: "Growth" | "Premium";
}

export interface SdpWarranty {
  days: number;
  includes: string[];
  excludes: string[];
  extendedOption?: boolean;
}

export interface SdpFaqItem {
  question: string;
  answer: string;
}

export interface SdpKickoffChecklistItem {
  item: string;
  responsible: "Client" | "StackFox" | "Both";
}

export type SdpSectionKey =
  | "overview"
  | "exclusions"
  | "techStack"
  | "useCase"
  | "features"
  | "deliverables"
  | "dependencies"
  | "milestones"
  | "qaChecklist"
  | "pricingTiers"
  | "teamStructure"
  | "warranty"
  | "faq"
  | "kickoffChecklist";

export interface SdpSections {
  overview: SdpOverview;
  exclusions: SdpExclusion[];
  techStack: TechStackItem[];
  useCase: string;
  features: SdpFeature[];
  deliverables: SdpDeliverable[];
  dependencies: SdpDependency[];
  milestones: SdpMilestone[];
  qaChecklist: SdpQaChecklistItem[];
  pricingTiers: SdpPricingTier[];
  teamStructure: SdpTeamRole[];
  warranty: SdpWarranty;
  faq: SdpFaqItem[];
  kickoffChecklist: SdpKickoffChecklistItem[];
}

export interface SdpVersion {
  id: string;
  serviceId: string;
  version: number;
  status: "draft" | "published" | "archived";
  sections: SdpSections;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SdpVersionInput {
  serviceId: string;
  version: number;
  sections: SdpSections;
}

export const SDP_SECTION_KEYS: SdpSectionKey[] = [
  "overview",
  "exclusions",
  "techStack",
  "useCase",
  "features",
  "deliverables",
  "dependencies",
  "milestones",
  "qaChecklist",
  "pricingTiers",
  "teamStructure",
  "warranty",
  "faq",
  "kickoffChecklist",
];

export const SDP_SECTION_LABELS: Record<SdpSectionKey, string> = {
  overview: "Overview",
  exclusions: "What's NOT Included",
  techStack: "Tech Stack",
  useCase: "Typical Use Case",
  features: "Feature Library",
  deliverables: "Deliverables",
  dependencies: "Dependencies",
  milestones: "Milestones & Timeline",
  qaChecklist: "QA Checklist",
  pricingTiers: "Pricing Tiers",
  teamStructure: "Team Structure",
  warranty: "Warranty & Support",
  faq: "FAQ",
  kickoffChecklist: "Kickoff Checklist",
};

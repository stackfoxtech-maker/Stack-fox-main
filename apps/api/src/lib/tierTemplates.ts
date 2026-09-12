/** Default milestone breakdown for a tier, used when an order doesn't define its own. */
export function getMilestoneTemplates(tier: string) {
  if (tier === "STARTER") {
    return [
      { name: "Delivery", pct: 100, deliverables: ["Deployed site", "Source code"] },
    ];
  }
  if (tier === "GROWTH") {
    return [
      { name: "Design & Planning", pct: 30, deliverables: ["Wireframes", "Project plan"] },
      { name: "Development", pct: 40, deliverables: ["Staging deployment", "Core features"] },
      { name: "Review & Delivery", pct: 30, deliverables: ["Final deployment", "Documentation"] },
    ];
  }
  // PREMIUM
  return [
    { name: "Strategy & Discovery", pct: 20, deliverables: ["Strategy document", "Architecture review"] },
    { name: "Design", pct: 20, deliverables: ["Full design system", "Prototype"] },
    { name: "Development Phase 1", pct: 25, deliverables: ["Core features", "Staging"] },
    { name: "Development Phase 2", pct: 20, deliverables: ["All features", "Integration testing"] },
    { name: "QA, Delivery & Handover", pct: 15, deliverables: ["Production deployment", "Full documentation", "Training"] },
  ];
}

/** Contract types generated for a tier's order. */
export function getContractTypes(tier: string): string[] {
  if (tier === "STARTER") return ["MICRO_SOW"];
  if (tier === "GROWTH") return ["SOW", "MSA"];
  return ["SOW", "MSA", "NDA", "IP_WFH", "DPA"];
}

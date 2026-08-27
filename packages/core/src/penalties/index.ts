export interface PenaltyRule {
  type: "SLA_BREACH" | "LATE_DELIVERY" | "QUALITY_DEFECT";
  pctPerDay: number;
  capPct: number;
}

export function calculatePenalty(
  rule: PenaltyRule,
  daysLate: number,
  contractValue: number,
): number {
  const raw = contractValue * (rule.pctPerDay / 100) * daysLate;
  const cap = contractValue * (rule.capPct / 100);
  return Math.min(raw, cap);
}

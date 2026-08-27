export type Severity = "P1" | "P2" | "P3" | "P4";
export type SlaMetric = "response" | "resolution";

/** Targets are in minutes, measured from ticket creation. */
export const SLA_TARGETS: Record<Severity, { responseMin: number; resolutionMin: number }> = {
  P1: { responseMin: 30, resolutionMin: 240 },
  P2: { responseMin: 120, resolutionMin: 480 },
  P3: { responseMin: 480, resolutionMin: 2880 },
  P4: { responseMin: 1440, resolutionMin: 10080 },
};

/**
 * `metric` defaults to "resolution" so existing two-argument callers keep their
 * behaviour; the SLA cron passes "response" to catch first-reply breaches,
 * which fire much earlier and are the ones clients actually notice.
 */
export function isSlaBreached(
  severity: Severity,
  elapsedMin: number,
  metric: SlaMetric = "resolution",
): boolean {
  const target = SLA_TARGETS[severity];
  if (!target) return false;
  return elapsedMin > (metric === "response" ? target.responseMin : target.resolutionMin);
}

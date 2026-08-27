export interface EstimateInput {
  services: Array<{
    serviceId: string;
    features: Record<string, boolean>;
  }>;
  customLines: Array<{
    title: string;
    estHours: Record<string, { o: number; l: number; p: number }>;
  }>;
  timelineMultiplier: number;
}

export interface EstimateTotals {
  base: number;
  features: number;
  custom: number;
  multiplier: number;
  discount: number;
  subtotal: number;
  gst: number;
  grand: number;
}

export function calculateEstimate(
  _input: EstimateInput,
  _ratePerPoint: number,
): EstimateTotals {
  // TODO: implement PERT-weighted estimation engine
  return {
    base: 0,
    features: 0,
    custom: 0,
    multiplier: 1,
    discount: 0,
    subtotal: 0,
    gst: 0,
    grand: 0,
  };
}

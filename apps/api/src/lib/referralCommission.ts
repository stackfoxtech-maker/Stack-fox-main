/**
 * Resolves the commission percentage for a referral conversion.
 *
 * REFERRAL_COMMISSION_PCT is an operator-set env var. If it's unset,
 * non-numeric, or outside a sane 0-100 range, `Number(...)` on it produces
 * NaN, which then poisons the commissionAmount arithmetic
 * (`amount * NaN / 100 = NaN`) and either fails the Prisma write or stores
 * garbage. Parse and clamp instead of trusting the env blindly.
 */
export function resolveCommissionPct(override?: number | null): number {
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    override >= 0 &&
    override <= 100
  )
    return override;
  const parsed = Number(process.env.REFERRAL_COMMISSION_PCT);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 10;
}

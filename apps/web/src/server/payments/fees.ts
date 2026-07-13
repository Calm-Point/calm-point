/**
 * Split-fee matrix (docs/10 spec §2). Pure money math — unit-tested, no I/O.
 * All amounts are integer cents; rounding is half-up on the platform fee so the
 * provider net is always an exact integer remainder.
 */

/** Platform infrastructure commission on every completed consultation. */
export const PLATFORM_FEE_PCT = 0.10;
/** Marketing premium appended when the patient is a platform-funded lead. */
export const MARKETING_FEE_CENTS = 1000;
/** Provider SaaS portal access subscription ($199.00/month). */
export const PROVIDER_SAAS_CENTS = 19900;

export interface SplitInput {
  /** Gross base consultation fee, in cents. */
  baseCents: number;
  /** True when the patient was acquired via platform-funded marketing. */
  isPlatformLead: boolean;
}

export interface SplitResult {
  /** Total withheld by the platform (10% + marketing premium if applicable). */
  applicationFeeCents: number;
  /** The marketing premium portion of the application fee (0 when organic). */
  marketingFeeCents: number;
  /** Net routed to the provider's Connect account. */
  providerNetCents: number;
}

export function computeSplit(input: SplitInput): SplitResult {
  if (!Number.isInteger(input.baseCents) || input.baseCents <= 0) {
    throw new Error("baseCents must be a positive integer");
  }
  const platformCut = Math.round(input.baseCents * PLATFORM_FEE_PCT);
  const marketingFeeCents = input.isPlatformLead ? MARKETING_FEE_CENTS : 0;
  const applicationFeeCents = platformCut + marketingFeeCents;
  const providerNetCents = input.baseCents - applicationFeeCents;
  if (providerNetCents <= 0) {
    throw new Error("Fee exceeds the consultation amount");
  }
  return { applicationFeeCents, marketingFeeCents, providerNetCents };
}

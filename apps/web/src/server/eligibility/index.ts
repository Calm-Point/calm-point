/**
 * Real-time insurance eligibility seam (docs/10 spec §3 phase 1 — X12 270/271).
 * Adapters behind a frozen interface:
 *  - mock:             deterministic result for dev/CI
 *  - changehealthcare: 🚦 enrollment-gated — requires clearinghouse enrollment
 *  - availity:         🚦 enrollment-gated
 * Production refuses the mock so coverage is never silently fabricated.
 */

export interface EligibilityResult {
  status: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  payerName: string;
  copayCents?: number;
  coverage?: Record<string, unknown>;
}

export interface EligibilityVendor {
  readonly name: string;
  check(input: { payerName: string; memberId: string; dob?: string }): Promise<EligibilityResult>;
}

const mockVendor: EligibilityVendor = {
  name: "mock",
  async check({ payerName, memberId }) {
    // Deterministic: member ids ending in an odd digit are ACTIVE with a $30
    // copay; even → ACTIVE $0; "X"-suffixed → INACTIVE. Keeps E2E meaningful.
    const last = memberId.trim().slice(-1);
    if (/x$/i.test(memberId)) return { status: "INACTIVE", payerName };
    const odd = /[13579]/.test(last);
    return {
      status: "ACTIVE",
      payerName,
      copayCents: odd ? 3000 : 0,
      coverage: { planType: "PPO", telehealthCovered: true, mock: true },
    };
  },
};

function enrollmentGated(name: string): EligibilityVendor {
  return {
    name,
    async check() {
      throw new Error(
        `${name} eligibility is not configured — clearinghouse enrollment + credentials required (docs/10).`,
      );
    },
  };
}

export function eligibilityVendor(): EligibilityVendor {
  const vendor = (process.env.ELIGIBILITY_VENDOR ?? "mock").toLowerCase();
  if (vendor === "changehealthcare") return enrollmentGated("Change Healthcare");
  if (vendor === "availity") return enrollmentGated("Availity");
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_ELIGIBILITY !== "1") {
    return enrollmentGated("Eligibility (no clearinghouse configured)");
  }
  return mockVendor;
}

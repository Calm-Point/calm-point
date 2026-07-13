import { describe, expect, it } from "vitest";
import { computeSplit, MARKETING_FEE_CENTS, PROVIDER_SAAS_CENTS } from "../fees";

// Money math — exact assertions, spec values from docs/10 (spec §2).

describe("computeSplit", () => {
  it("organic lead on a $150 consult: platform keeps 10%, provider nets $135", () => {
    const r = computeSplit({ baseCents: 15000, isPlatformLead: false });
    expect(r.applicationFeeCents).toBe(1500);
    expect(r.marketingFeeCents).toBe(0);
    expect(r.providerNetCents).toBe(13500);
  });

  it("platform lead on a $150 consult: 10% + $10 premium, provider nets $125", () => {
    const r = computeSplit({ baseCents: 15000, isPlatformLead: true });
    expect(r.applicationFeeCents).toBe(1500 + MARKETING_FEE_CENTS);
    expect(r.marketingFeeCents).toBe(1000);
    expect(r.providerNetCents).toBe(12500);
  });

  it("fee + net always reconstruct the gross exactly (no lost cents)", () => {
    for (const base of [9500, 7500, 15000, 12345, 100001]) {
      for (const lead of [true, false]) {
        const r = computeSplit({ baseCents: base, isPlatformLead: lead });
        expect(r.applicationFeeCents + r.providerNetCents).toBe(base);
      }
    }
  });

  it("rounds the 10% cut half-up on odd amounts", () => {
    // 10% of $123.45 = 1234.5¢ → 1235¢
    const r = computeSplit({ baseCents: 12345, isPlatformLead: false });
    expect(r.applicationFeeCents).toBe(1235);
    expect(r.providerNetCents).toBe(11110);
  });

  it("rejects non-positive, non-integer, and fee-exceeding amounts", () => {
    expect(() => computeSplit({ baseCents: 0, isPlatformLead: false })).toThrow();
    expect(() => computeSplit({ baseCents: 100.5, isPlatformLead: false })).toThrow();
    // $10 marketing fee alone exceeds a $10 consult's 90% remainder
    expect(() => computeSplit({ baseCents: 1000, isPlatformLead: true })).toThrow();
  });

  it("provider SaaS price is $199.00/month", () => {
    expect(PROVIDER_SAAS_CENTS).toBe(19900);
  });
});

import type { Metadata } from "next";
import { Card, CardTitle } from "@calm-point/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Calm Point mental health care — membership plus per-visit fees. No surprise bills.",
};

// Pricing is intentionally config-shaped copy; real Stripe products/prices are
// wired in Phase 2.4. Amounts here mirror the product-spec hypothesis and are
// clearly marked as launch pricing.
const PLANS = [
  {
    name: "Membership",
    price: "$49",
    cadence: "/month",
    tagline: "Everything between visits",
    features: [
      "Secure messaging with your care team",
      "Recurring wellbeing check-ins with trends",
      "AI companion for skills practice (when available)",
      "Care plan and after-visit summaries",
    ],
  },
  {
    name: "Visits",
    price: "$95",
    cadence: "/first visit",
    tagline: "Time with a licensed provider",
    features: [
      "$95 initial evaluation, $75 follow-ups",
      "Video visits — no waiting room",
      "AI-assisted notes so your provider focuses on you",
      "Book within days in most states",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <div className="mb-12 text-center">
        <a href="/" className="text-sm font-semibold uppercase tracking-widest text-brand">
          Calm Point
        </a>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Simple, honest pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">
          A membership for everything between visits, plus a clear per-visit fee.
          No surprise bills. Cancel anytime.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <Card key={plan.name} className="flex flex-col gap-4">
            <div>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <p className="text-sm text-ink-soft">{plan.tagline}</p>
            </div>
            <p className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
              <span className="text-ink-soft">{plan.cadence}</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-brand">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-ink-soft">
        Insurance support is on our roadmap. Launch pricing shown; you&apos;ll always
        see the exact amount before you pay.
      </p>

      <div className="mt-10 text-center">
        <a
          href="/#conditions"
          className="inline-flex h-12 items-center rounded-full bg-brand px-8 text-base font-medium text-white shadow-soft"
        >
          Get started
        </a>
      </div>

      <p className="mt-16 text-center text-xs text-ink-soft">
        Not for emergencies. In crisis, call or text{" "}
        <a href="tel:988" className="underline">988</a>.
      </p>
    </main>
  );
}

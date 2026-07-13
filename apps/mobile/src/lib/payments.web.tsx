import type { ReactElement } from "react";

/**
 * Web fallback for payments.tsx — Stripe's native PaymentSheet has no web
 * build. The web target here exists only for local preview/testing; real
 * patients pay from the iOS/Android app, where the native module loads.
 */

export function CalmStripeProvider({ children }: { children: ReactElement }) {
  return children;
}

export function useCalmStripe() {
  return {
    initPaymentSheet: async () => ({
      error: { message: "Payments are available in the iOS/Android app." } as { message: string } | undefined,
    }),
    presentPaymentSheet: async () => ({
      error: { message: "Payments are available in the iOS/Android app." } as { message: string } | undefined,
    }),
  };
}

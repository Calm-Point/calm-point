import type { ReactElement } from "react";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";

/**
 * Native (iOS/Android) Stripe wrapper. Stripe's PaymentSheet is a native
 * module with no web target — Metro's web bundler can't even load the
 * package (it statically imports react-native internals unsupported on web).
 * payments.web.ts provides the web fallback so `expo start --web` (used for
 * local preview/testing) still bundles cleanly; real payment always happens
 * on-device, never through the web preview.
 */

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export function CalmStripeProvider({ children }: { children: ReactElement }) {
  return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{children}</StripeProvider>;
}

export function useCalmStripe() {
  return useStripe();
}

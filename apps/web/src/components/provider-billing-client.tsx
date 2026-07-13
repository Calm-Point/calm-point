"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Skeleton } from "@calm-point/ui";

/**
 * Provider billing: Connect Express payout onboarding + the $199/mo SaaS
 * subscription (docs/10 spec §2). Subscription confirmation uses Stripe
 * Elements when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set; without it the
 * intent is created and a clear next-step message is shown.
 */

interface BillingState {
  payoutsConnected: boolean;
  saas: { status: string; currentPeriodEnd: string } | null;
  accessFrozen: boolean;
}

export function ProviderBillingClient() {
  const [state, setState] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/provider/billing");
    if (res.ok) setState((await res.json()) as BillingState);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(action: "connect" | "subscribe") {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/provider/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { url?: string; clientSecret?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (action === "connect" && data.url) {
        window.location.href = data.url; // Stripe-hosted Express onboarding
        return;
      }
      if (action === "subscribe" && data.clientSecret) {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (pk) {
          const { loadStripe } = await import("@stripe/stripe-js");
          const stripe = await loadStripe(pk);
          if (!stripe) throw new Error("Stripe.js failed to load");
          // Hosted confirmation keeps card entry entirely on Stripe surfaces.
          const { error: confirmErr } = await stripe.confirmPayment({
            clientSecret: data.clientSecret,
            confirmParams: { return_url: `${window.location.origin}/provider/billing?sub=done` },
          });
          if (confirmErr) throw new Error(confirmErr.message ?? "Payment confirmation failed");
        } else {
          setNotice(
            "Subscription created. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to complete card entry here.",
          );
        }
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <Card className="max-w-xl">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-3 h-9 w-full" />
      </Card>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      {state.accessFrozen ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">
            Portal access is frozen — your subscription invoice is unpaid. Update payment to
            restore the clinical suite.
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Payouts</h2>
          <Badge>{state.payoutsConnected ? "connected" : "not connected"}</Badge>
        </div>
        <p className="text-sm text-slate-600">
          Consultation fees are split automatically: you receive the net of each visit directly to
          your bank via Stripe; the platform withholds its 10% infrastructure fee
          {" "}(+ $10 on platform-sourced patients).
        </p>
        <Button disabled={busy !== null} onClick={() => void act("connect")}>
          {state.payoutsConnected ? "Update payout details" : "Set up payouts"}
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Provider Suite · $199/mo</h2>
          <Badge>{state.saas ? state.saas.status.toLowerCase() : "not subscribed"}</Badge>
        </div>
        {state.saas ? (
          <p className="text-sm text-slate-600">
            Current period ends {new Date(state.saas.currentPeriodEnd).toLocaleDateString()}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Scheduling, AI-drafted notes, intake analyses, secure messaging, and payouts.
          </p>
        )}
        {!state.saas || state.saas.status === "CANCELED" ? (
          <Button disabled={busy !== null} onClick={() => void act("subscribe")}>
            {busy === "subscribe" ? "Starting…" : "Subscribe"}
          </Button>
        ) : null}
      </Card>

      {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

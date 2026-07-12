import { constructWebhookEvent, reconcileWebhookEvent, stripeConfigured } from "@/server/payments/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook. Authenticated by signature (STRIPE_WEBHOOK_SECRET), not a
 * session. Idempotent — Stripe retries, and reconcileWebhookEvent is safe to
 * replay. The raw request body is required for signature verification.
 */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return Response.json({ error: "Payments not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await req.text();
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    await reconcileWebhookEvent(event);
  } catch (err) {
    // Return 500 so Stripe retries; log for diagnosis.
    console.error("[stripe-webhook] reconcile failed", event.type, err);
    return Response.json({ error: "Reconcile failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}

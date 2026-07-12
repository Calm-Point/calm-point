import Stripe from "stripe";
import { prisma } from "@calm-point/db";

/**
 * Stripe integration (docs/10 §1.6). Kept strictly OUTSIDE the PHI boundary:
 * we send Stripe only opaque IDs (patientId, appointmentId) and, for receipts,
 * an email — never a name, DOB, diagnosis, or any clinical data. Because no PHI
 * is transmitted, no BAA with Stripe is required.
 *
 * Card data is tokenized client-side by Stripe Elements; it never touches our
 * servers. This module runs server-side only.
 */

let _stripe: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  _stripe = new Stripe(key, { typescript: true, appInfo: { name: "Calm Point" } });
  return _stripe;
}

/** Cash-pay visit fees (cents). First visit vs. follow-up. */
export const VISIT_FEE_CENTS = { first: 9500, followUp: 7500 } as const;
/** Membership subscription price (cents / month). */
export const MEMBERSHIP_CENTS = 4900;

/** A patient has a follow-up (not first) visit once they've completed one. */
export async function isFollowUpVisit(patientId: string): Promise<boolean> {
  const prior = await prisma.appointment.count({
    where: { patientId, status: "COMPLETED" },
  });
  return prior > 0;
}

/**
 * Create (or reuse) a PaymentIntent for a visit and a matching PENDING Payment
 * row. Returns the client secret for Stripe Elements to confirm on the client.
 */
export async function createVisitPaymentIntent(params: {
  appointmentId: string;
  patientId: string;
  email?: string;
}): Promise<{ clientSecret: string; amountCents: number }> {
  const { appointmentId, patientId, email } = params;

  const existing = await prisma.payment.findUnique({ where: { appointmentId } });
  if (existing && existing.status === "SUCCEEDED") {
    throw new Error("This visit is already paid");
  }

  const amountCents = (await isFollowUpVisit(patientId))
    ? VISIT_FEE_CENTS.followUp
    : VISIT_FEE_CENTS.first;

  const intent = await stripe().paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    // No PHI — opaque references only.
    metadata: { appointmentId, patientId, kind: "visit" },
    ...(email ? { receipt_email: email } : {}),
    automatic_payment_methods: { enabled: true },
  });

  await prisma.payment.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      stripePaymentIntentId: intent.id,
      amountCents,
      currency: "usd",
      status: "PENDING",
    },
    update: { stripePaymentIntentId: intent.id, amountCents, status: "PENDING" },
  });

  if (!intent.client_secret) throw new Error("Stripe did not return a client secret");
  return { clientSecret: intent.client_secret, amountCents };
}

/** Reuse the Stripe customer from a prior subscription, else create one. */
async function getOrCreateCustomer(patientId: string, email?: string): Promise<string> {
  const prior = await prisma.subscription.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
  if (prior?.stripeCustomerId) return prior.stripeCustomerId;

  const customer = await stripe().customers.create({
    ...(email ? { email } : {}),
    metadata: { patientId }, // opaque only
  });
  return customer.id;
}

/**
 * Ensure a recurring monthly membership Price exists and return its id.
 * Prefers STRIPE_MEMBERSHIP_PRICE_ID; otherwise creates the product/price once.
 */
async function ensureMembershipPriceId(): Promise<string> {
  const configured = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
  if (configured) return configured;

  const lookupKey = "calm_point_membership_monthly";
  const found = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;

  const price = await stripe().prices.create({
    unit_amount: MEMBERSHIP_CENTS,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    product_data: { name: "Calm Point Membership" },
  });
  return price.id;
}

/**
 * Create a membership subscription with a first-payment PaymentIntent the client
 * confirms via Elements. The Subscription row is reconciled by the webhook once
 * Stripe confirms it active.
 */
export async function createMembershipSubscription(params: {
  patientId: string;
  email?: string;
}): Promise<{ clientSecret: string; subscriptionId: string }> {
  const { patientId, email } = params;

  const active = await prisma.subscription.findFirst({
    where: { patientId, status: "ACTIVE" },
  });
  if (active) throw new Error("Membership already active");

  const customerId = await getOrCreateCustomer(patientId, email);
  const priceId = await ensureMembershipPriceId();

  const subscription = await stripe().subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { patientId },
    expand: ["latest_invoice.payment_intent"],
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice | null;
  const pi =
    invoice && typeof invoice === "object"
      ? ((invoice as unknown as { payment_intent?: Stripe.PaymentIntent }).payment_intent ?? null)
      : null;
  const clientSecret = pi && typeof pi === "object" ? pi.client_secret : null;
  if (!clientSecret) throw new Error("Stripe did not return a subscription client secret");

  await prisma.subscription.create({
    data: {
      patientId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      planKey: "membership_monthly",
      status: "TRIALING", // provisional until webhook confirms ACTIVE
      currentPeriodEnd: new Date(
        (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
      ),
    },
  });

  return { clientSecret, subscriptionId: subscription.id };
}

/** Verify + parse a webhook payload. Throws on bad signature. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

const SUB_STATUS: Record<string, "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING"> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  canceled: "CANCELED",
  incomplete_expired: "CANCELED",
};

/**
 * Reconcile a Stripe event into our Payment / Subscription rows. Idempotent:
 * safe to call repeatedly for the same event (Stripe retries webhooks).
 */
export async function reconcileWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const succeeded = event.type === "payment_intent.succeeded";
      const payment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: pi.id },
      });
      if (!payment) break;
      await prisma.payment.update({
        where: { stripePaymentIntentId: pi.id },
        data: { status: succeeded ? "SUCCEEDED" : "FAILED" },
      });
      if (succeeded && payment.appointmentId) {
        await prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: "CONFIRMED" },
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const status = SUB_STATUS[sub.status] ?? "PAST_DUE";
      const periodEnd = new Date(
        (sub as unknown as { current_period_end: number }).current_period_end * 1000,
      );
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status, currentPeriodEnd: periodEnd },
      });
      break;
    }
    default:
      break;
  }
}

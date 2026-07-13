import { prisma } from "@calm-point/db";
import { stripe } from "./stripe";
import { computeSplit, PROVIDER_SAAS_CENTS } from "./fees";

/**
 * Stripe Connect split-fee engine (docs/10 spec §2). Two-sided monetization:
 * - Providers: Express accounts receive the net of each consultation via
 *   destination charges; a $199/mo SaaS subscription gates portal access.
 * - Platform: withholds 10% + a $10 marketing premium for platform-funded leads.
 * PHI boundary unchanged: Stripe sees opaque IDs and amounts only.
 */

const APP_URL = () => (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** A patient is a "platform lead" when their intake carries paid-acquisition UTM data. */
export async function isPlatformLead(patientId: string): Promise<boolean> {
  const session = await prisma.intakeSession.findFirst({
    where: { patientId, utm: { not: undefined } },
    orderBy: { createdAt: "desc" },
    select: { utm: true },
  });
  const utm = session?.utm as { utm_medium?: string; utm_source?: string } | null;
  if (!utm) return false;
  const medium = (utm.utm_medium ?? "").toLowerCase();
  return ["cpc", "ppc", "paid", "paid_social", "display"].includes(medium);
}

/** Create (or resume) Connect Express onboarding; returns the hosted onboarding URL. */
export async function createConnectOnboardingLink(providerId: string): Promise<string> {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: { user: { select: { email: true } } },
  });
  if (!provider) throw new Error("Unknown provider");

  let accountId = provider.stripeConnectAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      email: provider.user.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { providerId }, // opaque only
    });
    accountId = account.id;
    await prisma.providerProfile.update({
      where: { id: providerId },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${APP_URL()}/provider?connect=refresh`,
    return_url: `${APP_URL()}/provider?connect=done`,
  });
  return link.url;
}

/**
 * Destination-charge PaymentIntent for a consultation: platform collects the
 * gross, withholds the application fee, Stripe transfers the net to the
 * provider's Express account. Falls back to a plain platform charge when the
 * provider hasn't completed Connect onboarding.
 */
export async function createSplitVisitPaymentIntent(params: {
  appointmentId: string;
  patientId: string;
  providerId: string;
  baseCents: number;
  email?: string;
}): Promise<{ clientSecret: string; amountCents: number; split: boolean }> {
  const { appointmentId, patientId, providerId, baseCents, email } = params;

  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { stripeConnectAccountId: true },
  });
  const destination = provider?.stripeConnectAccountId ?? null;
  const lead = destination ? await isPlatformLead(patientId) : false;
  const split = destination ? computeSplit({ baseCents, isPlatformLead: lead }) : null;

  const intent = await stripe().paymentIntents.create({
    amount: baseCents,
    currency: "usd",
    metadata: { appointmentId, patientId, kind: "visit" },
    ...(email ? { receipt_email: email } : {}),
    automatic_payment_methods: { enabled: true },
    ...(destination && split
      ? {
          application_fee_amount: split.applicationFeeCents,
          transfer_data: { destination },
        }
      : {}),
  });

  await prisma.payment.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      stripePaymentIntentId: intent.id,
      amountCents: baseCents,
      currency: "usd",
      status: "PENDING",
      applicationFeeCents: split?.applicationFeeCents ?? null,
      marketingFeeCents: split?.marketingFeeCents ?? null,
      destinationAccountId: destination,
    },
    update: {
      stripePaymentIntentId: intent.id,
      amountCents: baseCents,
      status: "PENDING",
      applicationFeeCents: split?.applicationFeeCents ?? null,
      marketingFeeCents: split?.marketingFeeCents ?? null,
      destinationAccountId: destination,
    },
  });

  if (!intent.client_secret) throw new Error("Stripe did not return a client secret");
  return { clientSecret: intent.client_secret, amountCents: baseCents, split: Boolean(destination) };
}

/** Ensure the $199/mo provider SaaS price exists; returns its id. */
async function ensureSaasPriceId(): Promise<string> {
  const configured = process.env.STRIPE_PROVIDER_SAAS_PRICE_ID;
  if (configured) return configured;
  const lookupKey = "calm_point_provider_saas_monthly";
  const found = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const price = await stripe().prices.create({
    unit_amount: PROVIDER_SAAS_CENTS,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    product_data: { name: "Calm Point Provider Suite" },
  });
  return price.id;
}

/** Start the provider's $199/mo SaaS subscription (client confirms via Elements). */
export async function createProviderSaasSubscription(
  providerId: string,
): Promise<{ clientSecret: string; subscriptionId: string }> {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: { user: { select: { email: true } }, saasSubscription: true },
  });
  if (!provider) throw new Error("Unknown provider");
  if (provider.saasSubscription?.status === "ACTIVE") {
    throw new Error("SaaS subscription already active");
  }

  const customerId =
    provider.saasSubscription?.stripeCustomerId ??
    (
      await stripe().customers.create({
        email: provider.user.email ?? undefined,
        metadata: { providerId },
      })
    ).id;

  const priceId = await ensureSaasPriceId();
  const subscription = await stripe().subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { providerId },
    expand: ["latest_invoice.payment_intent"],
  });

  const invoice = subscription.latest_invoice;
  const pi =
    invoice && typeof invoice === "object"
      ? ((invoice as unknown as { payment_intent?: { client_secret?: string | null } })
          .payment_intent ?? null)
      : null;
  const clientSecret = pi?.client_secret ?? null;
  if (!clientSecret) throw new Error("Stripe did not return a subscription client secret");

  const periodEnd = new Date(
    (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
  );
  await prisma.providerSubscription.upsert({
    where: { providerId },
    create: {
      providerId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: "TRIALING", // provisional until the webhook confirms ACTIVE
      currentPeriodEnd: periodEnd,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: "TRIALING",
      currentPeriodEnd: periodEnd,
    },
  });

  return { clientSecret, subscriptionId: subscription.id };
}

/**
 * Portal access freeze (spec §2.1): clinical-suite access is frozen while the
 * SaaS invoice is unpaid. Providers with no subscription row are treated as
 * legacy/comped and are NOT frozen — the freeze applies to lapsed payers.
 */
export async function providerAccessFrozen(providerId: string): Promise<boolean> {
  const sub = await prisma.providerSubscription.findUnique({ where: { providerId } });
  if (!sub) return false;
  return sub.status === "PAST_DUE" || sub.status === "CANCELED";
}

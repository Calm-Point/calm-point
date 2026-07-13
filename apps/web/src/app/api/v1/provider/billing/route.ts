import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { stripeConfigured } from "@/server/payments/stripe";
import {
  createConnectOnboardingLink,
  createProviderSaasSubscription,
  providerAccessFrozen,
} from "@/server/payments/connect";

export const runtime = "nodejs";

/** GET → the caller's billing state: Connect payout status + SaaS subscription. */
export async function GET() {
  try {
    const user = await requireRole("PROVIDER");
    const profile = await prisma.providerProfile.findUnique({
      where: { userId: user.id },
      include: { saasSubscription: true },
    });
    if (!profile) return Response.json({ error: "No provider profile" }, { status: 404 });

    return Response.json({
      payoutsConnected: Boolean(profile.stripeConnectAccountId),
      saas: profile.saasSubscription
        ? {
            status: profile.saasSubscription.status,
            currentPeriodEnd: profile.saasSubscription.currentPeriodEnd.toISOString(),
          }
        : null,
      accessFrozen: await providerAccessFrozen(profile.id),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST → billing actions:
 *   { action: "connect" }   → Connect Express onboarding link for payouts
 *   { action: "subscribe" } → start the $199/mo SaaS subscription (Elements secret)
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PROVIDER");
    if (!stripeConfigured()) {
      return Response.json({ error: "Payments not configured" }, { status: 503 });
    }
    if (!rateLimit(`provider-billing:${user.id}`, 10, 60_000)) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No provider profile" }, { status: 404 });

    if (body?.action === "connect") {
      const url = await createConnectOnboardingLink(profile.id);
      await audit({
        actorId: user.id,
        action: "provider.connect.onboarding",
        resourceType: "ProviderProfile",
        resourceId: profile.id,
      });
      return Response.json({ url });
    }
    if (body?.action === "subscribe") {
      const { clientSecret, subscriptionId } = await createProviderSaasSubscription(profile.id);
      await audit({
        actorId: user.id,
        action: "provider.saas.subscribed",
        resourceType: "ProviderSubscription",
        resourceId: subscriptionId,
      });
      return Response.json({ clientSecret });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}

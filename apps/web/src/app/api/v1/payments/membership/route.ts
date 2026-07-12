import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { createMembershipSubscription, stripeConfigured } from "@/server/payments/stripe";

export const runtime = "nodejs";

/** POST → start the caller's $49/mo membership subscription. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    if (!stripeConfigured()) {
      return Response.json({ error: "Payments not configured" }, { status: 503 });
    }
    if (!rateLimit(`sub:${user.id}`, 8, 60_000)) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
      include: { user: { select: { email: true } } },
    });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    const { clientSecret, subscriptionId } = await createMembershipSubscription({
      patientId: profile.id,
      email: profile.user.email ?? undefined,
    });

    await audit({
      actorId: user.id,
      action: "subscription.created",
      resourceType: "Subscription",
      resourceId: subscriptionId,
    });

    return Response.json({ clientSecret });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}

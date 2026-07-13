import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { isFollowUpVisit, stripeConfigured, VISIT_FEE_CENTS } from "@/server/payments/stripe";
import { createSplitVisitPaymentIntent } from "@/server/payments/connect";

export const runtime = "nodejs";

/** POST → create a PaymentIntent for one of the caller's own appointments. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    if (!stripeConfigured()) {
      return Response.json({ error: "Payments not configured" }, { status: 503 });
    }
    if (!(await rateLimit(`pay:${user.id}`, 15, 60_000))) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as { appointmentId?: string } | null;
    const appointmentId = body?.appointmentId;
    if (!appointmentId) {
      return Response.json({ error: "appointmentId required" }, { status: 400 });
    }

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: user.id },
      include: { user: { select: { email: true } } },
    });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt || appt.patientId !== profile.id) {
      return Response.json({ error: "Unknown appointment" }, { status: 404 });
    }

    const existing = await prisma.payment.findUnique({ where: { appointmentId } });
    if (existing?.status === "SUCCEEDED") {
      return Response.json({ error: "This visit is already paid" }, { status: 409 });
    }
    const baseCents = (await isFollowUpVisit(profile.id))
      ? VISIT_FEE_CENTS.followUp
      : VISIT_FEE_CENTS.first;
    // Split-fee engine: destination charge to the provider's Connect account
    // when onboarded (10% platform fee + $10 platform-lead premium), else a
    // plain platform charge. (docs/10 spec §2)
    const { clientSecret, amountCents } = await createSplitVisitPaymentIntent({
      appointmentId,
      patientId: profile.id,
      providerId: appt.providerId,
      baseCents,
      email: profile.user.email ?? undefined,
    });

    await audit({
      actorId: user.id,
      action: "payment.intent.created",
      resourceType: "Appointment",
      resourceId: appointmentId,
    });

    return Response.json({ clientSecret, amountCents });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}

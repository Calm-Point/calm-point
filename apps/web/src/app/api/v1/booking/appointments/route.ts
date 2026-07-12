import { prisma, audit } from "@calm-point/db";
import { bookAppointmentSchema } from "@calm-point/shared";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { bookSlot } from "@/server/scheduling";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { sendAppointmentConfirmation } from "@/server/notifications";

/** POST → book a slot. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    const ip = clientIp(req);
    if (!rateLimit(`book:${user.id}`, 10, 60_000)) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }

    const parsed = bookAppointmentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });
    if (!profile.onboardingCompletedAt) {
      return Response.json(
        { error: "Complete onboarding first", code: "ONBOARDING_REQUIRED" },
        { status: 409 },
      );
    }

    const result = await bookSlot({
      patientId: profile.id,
      providerId: parsed.data.providerId,
      startsAt: new Date(parsed.data.startsAt),
      kind: parsed.data.kind,
    });
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });

    await audit({
      actorId: user.id,
      action: "appointment.booked",
      resourceType: "Appointment",
      resourceId: result.appointmentId,
      ip,
    });

    // Confirmation email + SMS to BOTH patient and provider (PHI-free).
    try {
      const appt = await prisma.appointment.findUnique({
        where: { id: result.appointmentId },
        include: {
          patient: { include: { user: { select: { email: true, phone: true } } } },
          provider: {
            include: { user: { select: { email: true, phone: true } } },
          },
        },
      });
      if (appt) {
        // Appointments store a UTC instant; label in ET with an explicit tz name
        // so the confirmation is unambiguous. (Per-user tz is a later refinement.)
        const tz = "America/New_York";
        const whenLabel = new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
          timeZoneName: "short",
        }).format(appt.startsAt);
        await Promise.all([
          sendAppointmentConfirmation({
            email: appt.patient.user.email,
            phone: appt.patient.user.phone,
            whenLabel,
            appointmentId: appt.id,
          }),
          sendAppointmentConfirmation({
            email: appt.provider.user.email,
            phone: appt.provider.user.phone,
            whenLabel,
            appointmentId: appt.id,
          }),
        ]);
      }
    } catch (err) {
      console.error("[booking] confirmation send failed", err);
    }

    return Response.json({ ok: true, appointmentId: result.appointmentId }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** GET → the caller's appointments (patient: own; provider: own panel). */
export async function GET() {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const where =
      user.role === "PATIENT"
        ? { patient: { userId: user.id } }
        : { provider: { userId: user.id } };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: {
        provider: { include: { user: { select: { firstName: true, lastName: true } } } },
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      take: 100,
    });

    await audit({
      actorId: user.id,
      action: "appointment.list",
      resourceType: "Appointment",
    });

    return Response.json({
      appointments: appointments.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        providerName: `${a.provider.user.firstName} ${a.provider.user.lastName}`,
        // Patient names are only exposed to the provider side of the relationship.
        patientName:
          user.role === "PROVIDER"
            ? `${a.patient.user.firstName} ${a.patient.user.lastName}`
            : undefined,
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

import { prisma, audit } from "@calm-point/db";
import { cancelAppointmentSchema, LATE_CANCEL_WINDOW_HOURS } from "@calm-point/shared";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { clientIp } from "@/server/rate-limit";

export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const parsed = cancelAppointmentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const appointment = await prisma.appointment.findUnique({
      where: { id: parsed.data.appointmentId },
      include: { patient: true, provider: true },
    });
    if (!appointment) return Response.json({ error: "Not found" }, { status: 404 });

    const isPatient = user.role === "PATIENT" && appointment.patient.userId === user.id;
    const isProvider = user.role === "PROVIDER" && appointment.provider.userId === user.id;
    if (!isPatient && !isProvider) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!["SCHEDULED", "CONFIRMED"].includes(appointment.status)) {
      return Response.json({ error: "This visit can no longer be cancelled." }, { status: 409 });
    }

    const hoursOut = (appointment.startsAt.getTime() - Date.now()) / 3_600_000;
    const late = isPatient && hoursOut < LATE_CANCEL_WINDOW_HOURS;

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: isPatient ? "CANCELLED_PATIENT" : "CANCELLED_PROVIDER",
        cancelReason: parsed.data.reason,
      },
    });
    await audit({
      actorId: user.id,
      action: "appointment.cancelled",
      resourceType: "Appointment",
      resourceId: appointment.id,
      ip: clientIp(req),
      metadata: { late, hoursOut: Math.round(hoursOut * 10) / 10 },
    });

    return Response.json({
      ok: true,
      // Late-cancel fee policy surfaces here once Stripe billing lands.
      lateCancel: late,
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse, AuthzError } from "@/server/authorize";
import { MIN_NOTICE_MIN } from "@/server/scheduling";

export const runtime = "nodejs";

const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] as const;

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reschedule"), newStartsAt: z.string().datetime() }),
  z.object({ action: z.literal("no-show") }),
]);

/**
 * PATCH → in-place appointment changes that aren't a plain cancel:
 *   { action: "reschedule", newStartsAt } — moves the same appointment to a
 *     new time (patient or provider; collision + notice checked server-side).
 *   { action: "no-show" } — provider marks a past visit as a no-show.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const { appointmentId } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, provider: true },
    });
    if (!appointment) return Response.json({ error: "Not found" }, { status: 404 });

    const isPatient = user.role === "PATIENT" && appointment.patient.userId === user.id;
    const isProvider = user.role === "PROVIDER" && appointment.provider.userId === user.id;
    if (!isPatient && !isProvider) throw new AuthzError(403, "Forbidden");

    if (parsed.data.action === "reschedule") {
      if (!ACTIVE_STATUSES.includes(appointment.status as (typeof ACTIVE_STATUSES)[number])) {
        return Response.json({ error: "This visit can no longer be rescheduled." }, { status: 409 });
      }
      const newStartsAt = new Date(parsed.data.newStartsAt);
      const durationMs = appointment.endsAt.getTime() - appointment.startsAt.getTime();
      const newEndsAt = new Date(newStartsAt.getTime() + durationMs);

      if (newStartsAt.getTime() < Date.now() + MIN_NOTICE_MIN * 60_000) {
        return Response.json({ error: "Pick a time further in advance." }, { status: 400 });
      }
      const collision = await prisma.appointment.findFirst({
        where: {
          id: { not: appointment.id },
          providerId: appointment.providerId,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { lt: newEndsAt },
          endsAt: { gt: newStartsAt },
        },
        select: { id: true },
      });
      if (collision) {
        return Response.json({ error: "That time is no longer open." }, { status: 409 });
      }

      const previousStartsAt = appointment.startsAt;
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { startsAt: newStartsAt, endsAt: newEndsAt, status: "SCHEDULED" },
      });
      await audit({
        actorId: user.id,
        action: "appointment.rescheduled",
        resourceType: "Appointment",
        resourceId: appointment.id,
        metadata: { from: previousStartsAt.toISOString(), to: newStartsAt.toISOString() },
      });
      return Response.json({ ok: true });
    }

    // action === "no-show"
    if (!isProvider) throw new AuthzError(403, "Forbidden");
    if (appointment.startsAt.getTime() > Date.now()) {
      return Response.json({ error: "This visit hasn't happened yet." }, { status: 409 });
    }
    if (!["SCHEDULED", "CONFIRMED"].includes(appointment.status)) {
      return Response.json({ error: "This visit can't be marked no-show." }, { status: 409 });
    }
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "NO_SHOW" } });
    await audit({
      actorId: user.id,
      action: "appointment.no_show",
      resourceType: "Appointment",
      resourceId: appointment.id,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

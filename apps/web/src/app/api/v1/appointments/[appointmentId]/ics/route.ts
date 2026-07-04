import { requireRole, authzErrorResponse } from "@/server/authorize";
import { loadVisitForUser } from "@/server/visits";
import { buildIcs } from "@/server/reminders";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const { appointmentId } = await params;
    const { appointment, isProvider } = await loadVisitForUser(user, appointmentId);

    const otherParty = isProvider
      ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`
      : `${appointment.provider.user.firstName} ${appointment.provider.user.lastName}`;
    const origin = new URL(req.url).origin;
    const ics = buildIcs({
      uid: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      title: `Calm Point visit with ${otherParty}`,
      url: `${origin}/${isProvider ? "provider" : "app"}/visit/${appointment.id}`,
    });
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="calm-point-visit.ics"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

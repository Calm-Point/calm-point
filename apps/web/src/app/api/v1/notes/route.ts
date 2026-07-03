import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

/** Provider's notes queue — unsigned drafts first. */
export async function GET() {
  try {
    const user = await requireRole("PROVIDER");
    const notes = await prisma.clinicalNote.findMany({
      where: { provider: { userId: user.id } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
        appointment: { select: { startsAt: true } },
      },
    });
    await audit({ actorId: user.id, action: "note.list", resourceType: "ClinicalNote" });
    return Response.json({
      notes: notes.map((n) => ({
        id: n.id,
        status: n.status,
        patientName: `${n.patient.user.firstName} ${n.patient.user.lastName}`,
        visitDate: n.appointment.startsAt.toISOString(),
        signedAt: n.signedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

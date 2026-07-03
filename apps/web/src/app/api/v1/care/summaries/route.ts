import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

/**
 * Patient-facing after-visit summaries: the PLAN section of signed notes only
 * — the full clinical note remains a provider record (docs/01 J2).
 */
export async function GET() {
  try {
    const user = await requireRole("PATIENT");
    const notes = await prisma.clinicalNote.findMany({
      where: { patient: { userId: user.id }, status: { in: ["SIGNED", "AMENDED"] } },
      orderBy: { signedAt: "desc" },
      take: 50,
      include: {
        provider: { include: { user: { select: { firstName: true, lastName: true } } } },
        appointment: { select: { startsAt: true } },
      },
    });
    await audit({
      actorId: user.id,
      action: "note.summary.read",
      resourceType: "ClinicalNote",
    });
    return Response.json({
      summaries: notes.map((n) => ({
        id: n.id,
        visitDate: n.appointment.startsAt.toISOString(),
        providerName: `${n.provider.user.firstName} ${n.provider.user.lastName}, ${n.provider.credentials}`,
        plan: n.plan,
        signedAt: n.signedAt?.toISOString(),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

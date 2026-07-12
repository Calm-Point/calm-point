import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

export const runtime = "nodejs";

/**
 * GET → the provider's intake-analysis inbox: the latest AI analysis for each
 * patient in an active CareRelationship with this provider. Decision-support
 * summaries the provider reviews before the visit (docs/10 §1.3).
 */
export async function GET() {
  try {
    const user = await requireRole("PROVIDER");

    const relationships = await prisma.careRelationship.findMany({
      where: { endedAt: null, provider: { userId: user.id } },
      select: {
        patientId: true,
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    const patientIds = relationships.map((r) => r.patientId);
    if (patientIds.length === 0) return Response.json({ analyses: [] });

    // Latest analysis per patient.
    const analyses = await prisma.intakeAnalysis.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: { createdAt: "desc" },
    });
    const seen = new Set<string>();
    const latest = analyses.filter((a) => {
      if (seen.has(a.patientId)) return false;
      seen.add(a.patientId);
      return true;
    });

    const nameByPatient = new Map(
      relationships.map((r) => [
        r.patientId,
        `${r.patient.user.firstName} ${r.patient.user.lastName}`,
      ]),
    );

    await audit({ actorId: user.id, action: "provider.inbox.list", resourceType: "IntakeAnalysis" });

    return Response.json({
      analyses: latest.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: nameByPatient.get(a.patientId) ?? "Patient",
        status: a.status,
        riskFlags: a.riskFlags,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

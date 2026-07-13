import { prisma, audit } from "@calm-point/db";
import { requireRole, requirePatientAccess, authzErrorResponse } from "@/server/authorize";
import { ensureThreadForRelationship } from "@/server/messaging";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;

/**
 * GET → the CareRelationship-scoped patient chart for the treating provider:
 * intake score trends, visit history, notes history, and current medications
 * (docs/04 §3.6). Admins may also view (always audited by the caller).
 */
export async function GET(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  try {
    const user = await requireRole("PROVIDER", "ADMIN");
    const { patientId } = await params;
    await requirePatientAccess(user, patientId);

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!patient) return Response.json({ error: "Not found" }, { status: 404 });

    // A provider's chart view is scoped to visits/notes from their own care
    // relationship; an admin reviewing the chart sees the full clinical history.
    const providerScope = user.role === "PROVIDER" ? { provider: { userId: user.id } } : {};

    const [responses, appointments, notes, prescriptions, thread] = await Promise.all([
      prisma.questionnaireResponse.findMany({
        where: { patientId, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        include: { questionnaire: { select: { slug: true, title: true } } },
      }),
      prisma.appointment.findMany({
        where: { patientId, ...providerScope },
        orderBy: { startsAt: "desc" },
        take: 25,
      }),
      prisma.clinicalNote.findMany({
        where: { patientId, ...providerScope },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, status: true, signedAt: true, createdAt: true },
      }),
      prisma.prescription.findMany({
        where: { patientId, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      user.role === "PROVIDER"
        ? ensureThreadForRelationship(user, patient.user.id).catch(() => null)
        : Promise.resolve(null),
    ]);

    // Latest completed response per questionnaire slug.
    const seen = new Set<string>();
    const latestScores = responses.filter((r) => {
      if (seen.has(r.questionnaire.slug)) return false;
      seen.add(r.questionnaire.slug);
      return true;
    });

    await audit({
      actorId: user.id,
      action: "provider.chart.view",
      resourceType: "PatientProfile",
      resourceId: patientId,
    });

    return Response.json({
      patient: {
        name: `${patient.user.firstName} ${patient.user.lastName}`,
        pronouns: patient.pronouns,
        ageYears: patient.dateOfBirth
          ? Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (DAY_MS * 365.25))
          : null,
        stateOfResidence: patient.stateOfResidence,
      },
      scores: latestScores.map((r) => ({
        title: r.questionnaire.title,
        slug: r.questionnaire.slug,
        totalScore: r.totalScore,
        severity: r.severity,
        completedAt: r.completedAt!.toISOString(),
        flaggedSafety: r.flaggedSafety,
      })),
      visits: appointments.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        startsAt: a.startsAt.toISOString(),
      })),
      notes: notes.map((n) => ({
        id: n.id,
        status: n.status,
        signedAt: n.signedAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      medications: prescriptions.map((p) => ({
        id: p.id,
        medicationName: p.medicationName,
        directions: p.directions,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      threadId: thread?.id ?? null,
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

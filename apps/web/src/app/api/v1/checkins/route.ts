import { prisma } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

const CADENCE_DAYS = 14;
const CHECKIN_SLUGS = ["phq-9", "gad-7"];

/**
 * Check-in status for the signed-in patient: which instruments are due
 * (none completed in the last CADENCE_DAYS) and score history for trends.
 */
export async function GET() {
  try {
    const user = await requireRole("PATIENT");
    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No profile" }, { status: 404 });

    const cutoff = new Date(Date.now() - CADENCE_DAYS * 24 * 3600 * 1000);
    const results = await Promise.all(
      CHECKIN_SLUGS.map(async (slug) => {
        const questionnaire = await prisma.questionnaire.findFirst({
          where: { slug, isPublished: true },
          orderBy: { version: "desc" },
        });
        if (!questionnaire) return null;
        const history = await prisma.questionnaireResponse.findMany({
          where: {
            patientId: profile.id,
            questionnaire: { slug },
            completedAt: { not: null },
          },
          orderBy: { completedAt: "asc" },
          take: 24,
          select: { completedAt: true, totalScore: true, severity: true },
        });
        const last = history[history.length - 1];
        return {
          slug,
          title: questionnaire.title,
          due: !last || (last.completedAt !== null && last.completedAt < cutoff),
          history: history.map((h) => ({
            completedAt: h.completedAt!.toISOString(),
            totalScore: h.totalScore,
            severity: h.severity,
          })),
        };
      }),
    );
    return Response.json({ checkins: results.filter(Boolean) });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

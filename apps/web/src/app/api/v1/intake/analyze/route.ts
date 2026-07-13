import { prisma, audit } from "@calm-point/db";
import { requireRole, requirePatientAccess, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { analyzeAndPersist } from "@/server/ai/analysis";

export const runtime = "nodejs";

/**
 * POST → generate + persist the ensemble intake analysis for the caller's own
 * completed battery. Feature-flagged; decision-support only (provider signs).
 */
export async function POST() {
  try {
    const user = await requireRole("PATIENT");
    if (!(await rateLimit(`analyze:${user.id}`, 5, 60_000))) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const flag = await prisma.featureFlag.findUnique({ where: { key: "intake_ai_analysis" } });
    if (!flag?.enabled) {
      return Response.json({ error: "Analysis is not enabled" }, { status: 403 });
    }

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    const latestSession = await prisma.intakeSession.findFirst({
      where: { patientId: profile.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const result = await analyzeAndPersist({
      patientId: profile.id,
      intakeSessionId: latestSession?.id ?? null,
      userId: user.id,
    });

    await audit({
      actorId: user.id,
      action: "intake.analysis.generated",
      resourceType: "IntakeAnalysis",
      resourceId: result.id,
    });

    return Response.json({
      ok: true,
      analysisId: result.id,
      riskFlagCount: result.riskFlags.length,
      models: result.models,
    });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}

/**
 * GET ?patientId= → the latest analysis for a patient. Provider access requires
 * an active CareRelationship; admin allowed; patient may read their own.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER", "ADMIN");
    const url = new URL(req.url);
    let patientId = url.searchParams.get("patientId");

    if (user.role === "PATIENT") {
      const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });
      patientId = profile.id;
    }
    if (!patientId) return Response.json({ error: "patientId required" }, { status: 400 });

    await requirePatientAccess(user, patientId);

    const analysis = await prisma.intakeAnalysis.findFirst({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
    if (!analysis) return Response.json({ analysis: null });

    if (user.role !== "PATIENT") {
      await audit({
        actorId: user.id,
        action: "intake.analysis.read",
        resourceType: "IntakeAnalysis",
        resourceId: analysis.id,
      });
    }

    return Response.json({
      analysis: {
        id: analysis.id,
        status: analysis.status,
        summary: analysis.summary,
        riskFlags: analysis.riskFlags,
        scores: analysis.scores,
        models: analysis.models,
        createdAt: analysis.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

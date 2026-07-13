import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import {
  scoreResponse,
  severityForScore,
  type ScorableAnswer,
  type ScoringMethod,
} from "@calm-point/shared";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";

/** GET → questionnaire content for a signed-in check-in (no scoring values). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireRole("PATIENT");
    const { slug } = await params;
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { slug, isPublished: true },
      orderBy: { version: "desc" },
      include: {
        questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      },
    });
    if (!questionnaire) return Response.json({ error: "Unknown check-in" }, { status: 404 });
    return Response.json({
      questionnaire: {
        slug: questionnaire.slug,
        version: questionnaire.version,
        title: questionnaire.title,
        questions: questionnaire.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          helpText: q.helpText,
          options: q.options.map((o) => ({ id: o.id, label: o.label })),
        })),
      },
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string(), optionId: z.string() }))
    .min(1)
    .max(50),
});

/**
 * POST → submit a complete check-in in one shot (signed-in flow). Scored
 * server-side; a positive safety item flags the response and alerts the
 * care team + admins (docs/05 §6) — and the patient sees crisis resources.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireRole("PATIENT");
    if (!(await rateLimit(`checkin:${user.id}`, 10, 3_600_000))) {
      return Response.json({ error: "Too many submissions" }, { status: 429 });
    }
    const { slug } = await params;
    const parsed = submitSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No profile" }, { status: 404 });

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { slug, isPublished: true },
      orderBy: { version: "desc" },
      include: { questions: { include: { options: true } }, scoringRules: true },
    });
    if (!questionnaire) return Response.json({ error: "Unknown check-in" }, { status: 404 });

    // Validate every answer against this questionnaire's content.
    const byQuestion = new Map(questionnaire.questions.map((q) => [q.id, q]));
    const validated: Array<{ questionId: string; optionId: string; value: number; safety: boolean; shadedMin?: number }> = [];
    for (const answer of parsed.data.answers) {
      const question = byQuestion.get(answer.questionId);
      const option = question?.options.find((o) => o.id === answer.optionId);
      if (!question || !option) {
        return Response.json({ error: "Unknown question or option" }, { status: 400 });
      }
      validated.push({
        questionId: question.id,
        optionId: option.id,
        value: option.value,
        safety: question.isSafetyItem && option.value > 0,
        shadedMin: (question.meta as { shadedMin?: number } | null)?.shadedMin,
      });
    }
    const required = questionnaire.questions.filter((q) => q.required).length;
    if (validated.length < required) {
      return Response.json({ error: "Check-in incomplete" }, { status: 409 });
    }

    const method =
      ((questionnaire.questions[0]?.meta as { scoringMethod?: ScoringMethod } | null)
        ?.scoringMethod as ScoringMethod) ?? "SUM";
    const scorable: ScorableAnswer[] = validated.map((v) => ({
      value: v.value,
      shadedMin: v.shadedMin,
    }));
    const totalScore = scoreResponse(method, scorable);
    const severity = severityForScore(questionnaire.scoringRules, totalScore);
    const flaggedSafety = validated.some((v) => v.safety);

    const response = await prisma.questionnaireResponse.create({
      data: {
        questionnaireId: questionnaire.id,
        patientId: profile.id,
        completedAt: new Date(),
        totalScore,
        severity,
        flaggedSafety,
        answers: {
          create: validated.map((v) => ({
            questionId: v.questionId,
            optionId: v.optionId,
            valueInt: v.value,
          })),
        },
      },
    });

    if (flaggedSafety) {
      const relationships = await prisma.careRelationship.findMany({
        where: { patientId: profile.id, endedAt: null },
        include: { provider: { select: { userId: true } } },
      });
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await prisma.notification.createMany({
        data: [...new Set([...relationships.map((r) => r.provider.userId), ...admins.map((a) => a.id)])].map(
          (userId) => ({
            userId,
            channel: "IN_APP" as const,
            template: "safety-alert",
            meta: { responseId: response.id },
          }),
        ),
      });
    }
    await audit({
      actorId: user.id,
      action: flaggedSafety ? "checkin.completed.safety-flag" : "checkin.completed",
      resourceType: "QuestionnaireResponse",
      resourceId: response.id,
    });

    return Response.json({ ok: true, crisis: flaggedSafety });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

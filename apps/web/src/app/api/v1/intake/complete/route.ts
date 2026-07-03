import { z } from "zod";
import { prisma } from "@calm-point/db";
import {
  scoreResponse,
  severityForScore,
  type ScoringMethod,
  type ScorableAnswer,
} from "@calm-point/shared";
import { currentIntakeSession } from "@/server/intake";
import { rateLimit, clientIp } from "@/server/rate-limit";

const completeSchema = z.object({
  questionnaireSlug: z.string(),
  questionnaireVersion: z.number().int().positive(),
});

/**
 * Scores the screener SERVER-SIDE (docs/02 D6 — client-computed scores are
 * never trusted) and returns non-diagnostic result framing for the funnel.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`intake-complete:${ip}`, 20, 60_000)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  const session = await currentIntakeSession();
  if (!session) {
    return Response.json({ error: "No active screener session" }, { status: 401 });
  }

  const parsed = completeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const response = await prisma.questionnaireResponse.findFirst({
    where: {
      intakeSessionId: session.id,
      completedAt: null,
      questionnaire: {
        slug: parsed.data.questionnaireSlug,
        version: parsed.data.questionnaireVersion,
      },
    },
    include: {
      answers: { include: { question: true } },
      questionnaire: {
        include: { questions: true, scoringRules: true },
      },
    },
  });
  if (!response) {
    return Response.json({ error: "No screener in progress" }, { status: 404 });
  }

  const requiredCount = response.questionnaire.questions.filter((q) => q.required).length;
  if (response.answers.length < requiredCount) {
    return Response.json(
      { error: "Screener incomplete", answered: response.answers.length, required: requiredCount },
      { status: 409 },
    );
  }

  const method =
    ((response.questionnaire.questions[0]?.meta as { scoringMethod?: ScoringMethod } | null)
      ?.scoringMethod as ScoringMethod) ?? "SUM";
  const scorable: ScorableAnswer[] = response.answers.map((a) => ({
    value: a.valueInt ?? 0,
    shadedMin: (a.question.meta as { shadedMin?: number } | null)?.shadedMin,
  }));
  const totalScore = scoreResponse(method, scorable);
  const severity = severityForScore(response.questionnaire.scoringRules, totalScore);

  await prisma.questionnaireResponse.update({
    where: { id: response.id },
    data: { completedAt: new Date(), totalScore, severity },
  });

  // Non-diagnostic patient framing — severity drives copy, not labels.
  const supportive =
    severity === "minimal" || severity === "negative-screen"
      ? "Your answers don't point to an urgent concern — but you know yourself best. A visit can still help you feel your best."
      : "Your answers suggest talking with a licensed provider would genuinely help.";

  return Response.json({
    ok: true,
    crisis: response.flaggedSafety,
    resultMessage: supportive,
    recommendVisit: !(severity === "minimal" || severity === "negative-screen"),
  });
}

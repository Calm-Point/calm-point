import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { currentIntakeSession } from "@/server/intake";
import { rateLimit, clientIp } from "@/server/rate-limit";

const answerSchema = z.object({
  questionnaireSlug: z.string(),
  questionnaireVersion: z.number().int().positive(),
  questionId: z.string().cuid(),
  optionId: z.string().cuid(),
});

/**
 * Autosaves one answer for the anonymous screener session. If the question is
 * a safety item answered positively, the response is flagged and the client is
 * told to divert to the crisis path immediately (docs/04 §2.2).
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`intake-answer:${ip}`, 120, 60_000)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  const session = await currentIntakeSession();
  if (!session) {
    return Response.json({ error: "No active screener session" }, { status: 401 });
  }

  const parsed = answerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const { questionnaireSlug, questionnaireVersion, questionId, optionId } = parsed.data;

  // Validate that question + option belong to the claimed published questionnaire.
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      questionnaire: {
        slug: questionnaireSlug,
        version: questionnaireVersion,
        isPublished: true,
      },
    },
    include: { options: { where: { id: optionId } }, questionnaire: true },
  });
  const option = question?.options[0];
  if (!question || !option) {
    return Response.json({ error: "Unknown question or option" }, { status: 400 });
  }

  const isCrisis = question.isSafetyItem && option.value > 0;

  await prisma.$transaction(async (tx) => {
    let response = await tx.questionnaireResponse.findFirst({
      where: {
        intakeSessionId: session.id,
        questionnaireId: question.questionnaireId,
        completedAt: null,
      },
    });
    response ??= await tx.questionnaireResponse.create({
      data: {
        questionnaireId: question.questionnaireId,
        intakeSessionId: session.id,
      },
    });
    await tx.answer.upsert({
      where: { responseId_questionId: { responseId: response.id, questionId } },
      update: { optionId, valueInt: option.value },
      create: { responseId: response.id, questionId, optionId, valueInt: option.value },
    });
    if (isCrisis && !response.flaggedSafety) {
      await tx.questionnaireResponse.update({
        where: { id: response.id },
        data: { flaggedSafety: true },
      });
    }
  });

  if (isCrisis) {
    // Flag for care-team review queue; never silently dropped (docs/05 §6).
    await audit({
      action: "intake.safety-flag",
      resourceType: "IntakeSession",
      resourceId: session.id,
      ip,
      metadata: { questionnaireSlug },
    });
    return Response.json({ ok: true, crisis: true });
  }
  return Response.json({ ok: true });
}

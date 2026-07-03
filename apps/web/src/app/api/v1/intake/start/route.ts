import crypto from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@calm-point/db";
import { CONDITIONS } from "@calm-point/shared";
import { rateLimit, clientIp } from "@/server/rate-limit";

const startSchema = z.object({
  conditionSlug: z.enum(
    CONDITIONS.map((c) => c.slug) as [string, ...string[]],
  ),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(100).optional(),
    })
    .optional(),
});

const INTAKE_COOKIE = "cp_intake";
const INTAKE_TTL_DAYS = 30;

/**
 * Starts (or resumes) an anonymous pre-auth screener session (docs/02 D7) and
 * returns the published questionnaire content — without scoring values or
 * safety-item markers, which stay server-side.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`intake-start:${ip}`, 20, 60_000)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const condition = CONDITIONS.find((c) => c.slug === parsed.data.conditionSlug)!;
  if (!condition.screener) {
    return Response.json({ error: "This condition has no screener" }, { status: 400 });
  }

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { slug: condition.screener, isPublished: true },
    orderBy: { version: "desc" },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!questionnaire) {
    return Response.json({ error: "Screener unavailable" }, { status: 503 });
  }

  // Resume an existing session when the cookie is valid; otherwise create one.
  const jar = await cookies();
  const existingToken = jar.get(INTAKE_COOKIE)?.value;
  let session =
    existingToken != null
      ? await prisma.intakeSession.findUnique({ where: { token: existingToken } })
      : null;
  if (!session || session.patientId || session.expiresAt < new Date()) {
    session = await prisma.intakeSession.create({
      data: {
        token: crypto.randomBytes(24).toString("base64url"),
        conditionSlug: condition.slug,
        utm: parsed.data.utm as never,
        expiresAt: new Date(Date.now() + INTAKE_TTL_DAYS * 24 * 3600 * 1000),
      },
    });
  }

  jar.set(INTAKE_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: INTAKE_TTL_DAYS * 24 * 3600,
    path: "/",
  });

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
}

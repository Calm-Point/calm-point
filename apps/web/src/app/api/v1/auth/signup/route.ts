import { prisma, audit } from "@calm-point/db";
import { signupSchema } from "@calm-point/shared";
import { hashPassword } from "@/server/auth/password";
import { rateLimit, clientIp } from "@/server/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`signup:${ip}`, 10, 60_000)) {
    return Response.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { email, password, firstName, lastName, intakeSessionToken } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Do not leak account existence beyond what login already reveals.
    return Response.json({ error: "That email can't be used. Try signing in." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        role: "PATIENT",
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        patientProfile: { create: {} },
      },
      include: { patientProfile: true },
    });

    // Atomically claim the pre-auth screener session and its responses (docs/02 D7).
    if (intakeSessionToken) {
      const intake = await tx.intakeSession.findUnique({ where: { token: intakeSessionToken } });
      if (intake && !intake.patientId && intake.expiresAt > new Date()) {
        await tx.intakeSession.update({
          where: { id: intake.id },
          data: { patientId: created.patientProfile!.id },
        });
        await tx.questionnaireResponse.updateMany({
          where: { intakeSessionId: intake.id },
          data: { patientId: created.patientProfile!.id },
        });
      }
    }
    return created;
  });

  await audit({
    actorId: user.id,
    action: "auth.signup",
    resourceType: "User",
    resourceId: user.id,
    ip,
    metadata: { linkedIntake: Boolean(intakeSessionToken) },
  });

  return Response.json({ ok: true }, { status: 201 });
}

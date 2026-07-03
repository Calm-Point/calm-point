import { prisma, audit } from "@calm-point/db";
import { onboardingSchema, CONSENT_DOC_VERSIONS } from "@calm-point/shared";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { clientIp } from "@/server/rate-limit";

/** Completes patient onboarding: demographics, emergency contact, consents. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    const parsed = onboardingSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const input = parsed.data;
    const ip = clientIp(req);

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.patientProfile.update({
        where: { id: profile.id },
        data: {
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
          stateOfResidence: input.stateOfResidence,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          pharmacyName: input.pharmacyName,
          pharmacyAddress: input.pharmacyAddress,
          onboardingCompletedAt: profile.onboardingCompletedAt ?? new Date(),
        },
      });
      for (const [docKey, docVersion] of Object.entries(CONSENT_DOC_VERSIONS)) {
        await tx.consentRecord.upsert({
          where: {
            patientId_docKey_docVersion: { patientId: profile.id, docKey, docVersion },
          },
          update: {},
          create: { patientId: profile.id, docKey, docVersion, ip },
        });
      }
    });

    await audit({
      actorId: user.id,
      action: "patient.onboarding.completed",
      resourceType: "PatientProfile",
      resourceId: profile.id,
      ip,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

import { prisma } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

/**
 * Providers the signed-in patient can book: licensed in their state,
 * accepting new patients (docs/04 §3.1 matching).
 */
export async function GET() {
  try {
    const user = await requireRole("PATIENT");
    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile?.stateOfResidence) {
      return Response.json(
        { error: "Complete onboarding first", code: "ONBOARDING_REQUIRED" },
        { status: 409 },
      );
    }

    const providers = await prisma.providerProfile.findMany({
      where: {
        acceptingNew: true,
        licenses: {
          some: {
            state: profile.stateOfResidence,
            verifiedAt: { not: null },
            expiresAt: { gt: new Date() },
          },
        },
      },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      providers: providers.map((p) => ({
        id: p.id,
        name: `${p.user.firstName} ${p.user.lastName}, ${p.credentials}`,
        bio: p.bio,
        specialties: p.specialties,
        avatarUrl: p.user.avatarUrl,
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

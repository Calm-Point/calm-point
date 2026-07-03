import { prisma } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

/** The other side(s) of the caller's active care relationships. */
export async function GET() {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const relationships = await prisma.careRelationship.findMany({
      where:
        user.role === "PATIENT"
          ? { endedAt: null, patient: { userId: user.id } }
          : { endedAt: null, provider: { userId: user.id } },
      include: {
        provider: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        patient: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      take: 100,
    });
    const seen = new Set<string>();
    const contacts = relationships.flatMap((rel) => {
      const other = user.role === "PATIENT" ? rel.provider.user : rel.patient.user;
      if (seen.has(other.id)) return [];
      seen.add(other.id);
      return [
        {
          userId: other.id,
          name:
            user.role === "PATIENT"
              ? `${other.firstName} ${other.lastName}, ${rel.provider.credentials}`
              : `${other.firstName} ${other.lastName}`,
        },
      ];
    });
    return Response.json({ contacts });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

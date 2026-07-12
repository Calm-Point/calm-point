import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

export const runtime = "nodejs";

/**
 * POST → admin credentialing: mark this provider's licenses verified. This is
 * the gate that clears a provider to see patients. Idempotent.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  try {
    const admin = await requireRole("ADMIN");
    const { providerId } = await params;

    const provider = await prisma.providerProfile.findUnique({
      where: { id: providerId },
      include: { licenses: true },
    });
    if (!provider) return Response.json({ error: "Unknown provider" }, { status: 404 });
    if (provider.licenses.length === 0) {
      return Response.json({ error: "Provider has no licenses to verify" }, { status: 409 });
    }

    const now = new Date();
    await prisma.providerLicense.updateMany({
      where: { providerId, verifiedAt: null },
      data: { verifiedAt: now },
    });

    await audit({
      actorId: admin.id,
      action: "provider.credentialed",
      resourceType: "ProviderProfile",
      resourceId: providerId,
    });

    return Response.json({ ok: true, verifiedLicenses: provider.licenses.length });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

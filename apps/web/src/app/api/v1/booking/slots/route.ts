import { prisma } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { availableSlotsForProvider } from "@/server/scheduling";

export async function GET(req: Request) {
  try {
    await requireRole("PATIENT");
    const url = new URL(req.url);
    const providerId = url.searchParams.get("providerId");
    const days = Math.min(Number(url.searchParams.get("days") ?? 7), 14);
    if (!providerId) {
      return Response.json({ error: "providerId required" }, { status: 400 });
    }
    const provider = await prisma.providerProfile.findUnique({ where: { id: providerId } });
    if (!provider) return Response.json({ error: "Unknown provider" }, { status: 404 });

    const slots = await availableSlotsForProvider(providerId, days);
    return Response.json({
      slots: slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

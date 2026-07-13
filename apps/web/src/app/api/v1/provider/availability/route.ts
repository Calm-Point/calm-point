import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

export const runtime = "nodejs";

const blockSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMin: z.number().int().min(0).max(1439),
    endMin: z.number().int().min(1).max(1440),
    slotSizeMin: z.number().int().min(15).max(120),
  })
  .refine((b) => b.startMin < b.endMin, { message: "Start must be before end" });

const putSchema = z.object({ blocks: z.array(blockSchema).max(7 * 4) });

/** GET → the caller's currently-effective recurring availability template. */
export async function GET() {
  try {
    const user = await requireRole("PROVIDER");
    const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No provider profile" }, { status: 404 });

    const now = new Date();
    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        providerId: profile.id,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
    });
    return Response.json({
      blocks: blocks.map((b) => ({
        id: b.id,
        dayOfWeek: b.dayOfWeek,
        startMin: b.startMin,
        endMin: b.endMin,
        slotSizeMin: b.slotSizeMin,
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** PUT → replace the caller's recurring weekly template wholesale. */
export async function PUT(req: Request) {
  try {
    const user = await requireRole("PROVIDER");
    const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No provider profile" }, { status: 404 });

    const parsed = putSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.availabilityBlock.deleteMany({ where: { providerId: profile.id } }),
      prisma.availabilityBlock.createMany({
        data: parsed.data.blocks.map((b) => ({ ...b, providerId: profile.id })),
      }),
    ]);
    await audit({
      actorId: user.id,
      action: "provider.availability.updated",
      resourceType: "ProviderProfile",
      resourceId: profile.id,
      metadata: { blockCount: parsed.data.blocks.length },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

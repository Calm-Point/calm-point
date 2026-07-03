import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

/** Flags that must never be enabled without recorded human sign-off (CLAUDE.md). */
const SIGN_OFF_GATED = new Set(["ai-therapist"]);

export async function GET() {
  try {
    await requireRole("ADMIN");
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
    return Response.json({
      flags: flags.map((f) => ({
        key: f.key,
        enabled: f.enabled,
        value: f.value,
        description: f.description,
        gated: SIGN_OFF_GATED.has(f.key),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  signOffNote: z.string().max(500).optional(),
});

export async function PUT(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const { key, enabled, signOffNote } = parsed.data;

    // The clinical/legal sign-off gate is enforced in software, not just docs:
    // enabling a gated flag requires an explicit sign-off note, which lands in
    // the immutable audit log with the actor identity.
    if (SIGN_OFF_GATED.has(key) && enabled && !signOffNote?.trim()) {
      return Response.json(
        {
          error:
            "This flag requires clinical + legal sign-off. Record who approved it in the sign-off note.",
        },
        { status: 428 },
      );
    }

    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return Response.json({ error: "Unknown flag" }, { status: 404 });

    await prisma.featureFlag.update({ where: { key }, data: { enabled } });
    await audit({
      actorId: admin.id,
      action: enabled ? "admin.flag.enabled" : "admin.flag.disabled",
      resourceType: "FeatureFlag",
      resourceId: key,
      metadata: signOffNote ? { signOffNote } : undefined,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

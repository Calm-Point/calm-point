import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { decodeImageDataUrl, putBinary } from "@/server/storage";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["drivers_license", "state_id", "passport"]),
  image: z.string().min(32),
});

/** POST → upload the caller's government ID photo (stored encrypted, key only). */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    if (!(await rateLimit(`id-upload:${user.id}`, 10, 60_000))) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    let storageKey: string;
    try {
      const { buffer, contentType } = decodeImageDataUrl(parsed.data.image);
      storageKey = await putBinary(
        `identity/${profile.id}/${parsed.data.kind}-${Date.now()}`,
        buffer,
        contentType,
      );
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Bad image" }, { status: 400 });
    }

    const doc = await prisma.identityDocument.create({
      data: { patientId: profile.id, kind: parsed.data.kind, storageKey },
    });
    await audit({
      actorId: user.id,
      action: "identity.uploaded",
      resourceType: "IdentityDocument",
      resourceId: doc.id,
    });
    return Response.json({ ok: true, id: doc.id }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

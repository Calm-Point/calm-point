import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { clientIp } from "@/server/rate-limit";

export const runtime = "nodejs";

const DOC_KEYS = ["telehealth-consent", "hipaa-npp", "terms", "privacy"] as const;

const schema = z.object({
  consents: z
    .array(z.object({ docKey: z.enum(DOC_KEYS), docVersion: z.string().min(1).max(40) }))
    .min(1),
});

/** POST → record the caller's consent acceptances (versioned, immutable, IP-stamped). */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    const ip = clientIp(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    let recorded = 0;
    for (const c of parsed.data.consents) {
      // Idempotent per (patient, doc, version): a re-accept is a no-op.
      await prisma.consentRecord.upsert({
        where: {
          patientId_docKey_docVersion: {
            patientId: profile.id,
            docKey: c.docKey,
            docVersion: c.docVersion,
          },
        },
        create: { patientId: profile.id, docKey: c.docKey, docVersion: c.docVersion, ip },
        update: {},
      });
      recorded++;
    }

    await audit({
      actorId: user.id,
      action: "consent.recorded",
      resourceType: "ConsentRecord",
      ip,
    });
    return Response.json({ ok: true, recorded }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

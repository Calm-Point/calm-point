import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { decodeImageDataUrl, putBinary } from "@/server/storage";
import { encryptSecret } from "@/server/auth/mfa";

export const runtime = "nodejs";

const schema = z
  .object({
    selfPay: z.boolean().optional(),
    payerName: z.string().min(1).max(120).optional(),
    memberId: z.string().min(1).max(64).optional(),
    groupNumber: z.string().max(64).optional(),
    frontImage: z.string().min(32).optional(),
    backImage: z.string().min(32).optional(),
  })
  .refine((v) => v.selfPay || (v.payerName && v.memberId), {
    message: "payerName and memberId are required unless selfPay",
  });

/** POST → capture the caller's insurance (or self-pay). Card photos stored by key. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    if (!rateLimit(`ins:${user.id}`, 10, 60_000)) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    const data = parsed.data;
    let frontKey: string | undefined;
    let backKey: string | undefined;
    try {
      if (data.frontImage) {
        const { buffer, contentType } = decodeImageDataUrl(data.frontImage);
        frontKey = await putBinary(`insurance/${profile.id}/front-${Date.now()}`, buffer, contentType);
      }
      if (data.backImage) {
        const { buffer, contentType } = decodeImageDataUrl(data.backImage);
        backKey = await putBinary(`insurance/${profile.id}/back-${Date.now()}`, buffer, contentType);
      }
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Bad image" }, { status: 400 });
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        patientId: profile.id,
        selfPay: Boolean(data.selfPay),
        payerName: data.payerName ?? "Self-pay",
        // Member identifiers are AES-256-GCM encrypted at rest (spec §5.2);
        // they're display-only, never queried, so ciphertext storage is safe.
        memberId: data.memberId ? encryptSecret(data.memberId) : "",
        groupNumber: data.groupNumber ? encryptSecret(data.groupNumber) : null,
        frontImageKey: frontKey ?? null,
        backImageKey: backKey ?? null,
      },
    });
    await audit({
      actorId: user.id,
      action: "insurance.captured",
      resourceType: "InsurancePolicy",
      resourceId: policy.id,
    });
    return Response.json({ ok: true, id: policy.id }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

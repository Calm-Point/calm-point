import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { eligibilityVendor } from "@/server/eligibility";

export const runtime = "nodejs";

const schema = z.object({
  insurancePolicyId: z.string().optional(),
  payerName: z.string().min(1).max(120),
  memberId: z.string().min(1).max(64),
});

/** POST → run a real-time eligibility check for the caller and persist the result. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT");
    if (!(await rateLimit(`elig:${user.id}`, 6, 60_000))) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });

    const vendor = eligibilityVendor();
    let result;
    try {
      result = await vendor.check({
        payerName: parsed.data.payerName,
        memberId: parsed.data.memberId,
      });
    } catch (e) {
      await prisma.eligibilityCheck.create({
        data: {
          patientId: profile.id,
          insurancePolicyId: parsed.data.insurancePolicyId ?? null,
          vendor: vendor.name,
          status: "ERROR",
          payerName: parsed.data.payerName,
        },
      });
      throw e;
    }

    const check = await prisma.eligibilityCheck.create({
      data: {
        patientId: profile.id,
        insurancePolicyId: parsed.data.insurancePolicyId ?? null,
        vendor: vendor.name,
        status: result.status,
        payerName: result.payerName,
        copayCents: result.copayCents ?? null,
        coverage: (result.coverage ?? undefined) as object | undefined,
      },
    });

    await audit({
      actorId: user.id,
      action: "eligibility.checked",
      resourceType: "EligibilityCheck",
      resourceId: check.id,
    });

    return Response.json({
      ok: true,
      status: result.status,
      copayCents: result.copayCents ?? null,
    });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}

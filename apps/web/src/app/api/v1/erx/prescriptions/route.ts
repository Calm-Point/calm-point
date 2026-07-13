import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, requirePatientAccess, authzErrorResponse } from "@/server/authorize";
import { rateLimit } from "@/server/rate-limit";
import { erxVendor } from "@/server/erx";

export const runtime = "nodejs";

const createSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  medicationName: z.string().min(1).max(200),
  directions: z.string().max(500).optional(),
  pharmacyNcpdpId: z.string().min(1).max(20),
  pharmacyName: z.string().min(1).max(200),
  isControlled: z.boolean().default(false),
});

/**
 * POST → create + route a prescription (provider only, CareRelationship-gated).
 * Hard gates (spec §3.5 + CLAUDE.md): the `erx` feature flag must be ON, and
 * controlled substances are refused without EPCS verification.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PROVIDER");
    if (!rateLimit(`erx:${user.id}`, 20, 60_000)) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }

    const flag = await prisma.featureFlag.findUnique({ where: { key: "erx" } });
    if (!flag?.enabled) {
      return Response.json(
        { error: "E-prescribing is not enabled (pending vendor contract + sign-off)" },
        { status: 403 },
      );
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const data = parsed.data;

    await requirePatientAccess(user, data.patientId);
    const provider = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!provider) return Response.json({ error: "No provider profile" }, { status: 404 });

    if (data.isControlled) {
      // EPCS: DEA-compliant two-factor identity proofing is a per-provider
      // enrollment through the eRx vendor; without it, refuse outright.
      return Response.json(
        { error: "Controlled substances require EPCS enrollment (not yet verified for this provider)" },
        { status: 403 },
      );
    }

    const rx = await prisma.prescription.create({
      data: {
        patientId: data.patientId,
        providerId: provider.id,
        appointmentId: data.appointmentId ?? null,
        vendor: erxVendor().name,
        medicationName: data.medicationName,
        directions: data.directions ?? null,
        pharmacyName: data.pharmacyName,
        pharmacyNcpdpId: data.pharmacyNcpdpId,
        isControlled: false,
        status: "SUBMITTED",
      },
    });

    try {
      const routed = await erxVendor().routePrescription({
        prescriptionId: rx.id,
        medicationName: rx.medicationName,
        directions: rx.directions ?? undefined,
        pharmacyNcpdpId: data.pharmacyNcpdpId,
        isControlled: false,
      });
      await prisma.prescription.update({
        where: { id: rx.id },
        data: { status: "ROUTED", vendorRxId: routed.vendorRxId, routedAt: new Date() },
      });
    } catch (routeErr) {
      await prisma.prescription.update({ where: { id: rx.id }, data: { status: "ERROR" } });
      throw routeErr;
    }

    await audit({
      actorId: user.id,
      action: "prescription.routed",
      resourceType: "Prescription",
      resourceId: rx.id,
    });
    return Response.json({ ok: true, prescriptionId: rx.id }, { status: 201 });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}

/** GET ?patientId= → prescriptions for a patient (relationship-gated) or the caller's own. */
export async function GET(req: Request) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER", "ADMIN");
    const url = new URL(req.url);
    let patientId = url.searchParams.get("patientId");
    if (user.role === "PATIENT") {
      const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return Response.json({ error: "No patient profile" }, { status: 404 });
      patientId = profile.id;
    }
    if (!patientId) return Response.json({ error: "patientId required" }, { status: 400 });
    await requirePatientAccess(user, patientId);

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    await audit({
      actorId: user.id,
      action: "prescription.list",
      resourceType: "Prescription",
    });
    return Response.json({
      prescriptions: prescriptions.map((p) => ({
        id: p.id,
        medicationName: p.medicationName,
        status: p.status,
        pharmacyName: p.pharmacyName,
        routedAt: p.routedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

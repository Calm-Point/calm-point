import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { hashPassword } from "@/server/auth/password";
import { sendEmail, appBaseUrl } from "@/server/notifications";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  credentials: z.string().min(1).max(40), // "MD" | "PMHNP-BC" | "LCSW" ...
  specialties: z.array(z.string()).max(8).default([]),
  npi: z.string().max(20).optional(),
  bio: z.string().max(1000).optional(),
  tempPassword: z.string().min(12).max(200),
  licenses: z
    .array(
      z.object({
        state: z.string().length(2),
        licenseNumber: z.string().min(1).max(40),
        licenseType: z.string().min(1).max(40),
        expiresAt: z.string(), // ISO date
      }),
    )
    .default([]),
});

const DEFAULT_AVAILABILITY = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startMin: 9 * 60,
  endMin: 17 * 60,
  slotSizeMin: 30,
}));

/**
 * POST → admin onboards a provider: creates the account + profile + licenses
 * (unverified, pending credentialing) + default Mon–Fri 9–5 availability, then
 * emails an invite. The provider is walked through MFA enrollment on first login
 * (middleware). Licenses are activated by the credentialing endpoint.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const email = data.email.trim().toLowerCase();

    if (await prisma.user.findUnique({ where: { email } })) {
      return Response.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.tempPassword);
    const provider = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: "PROVIDER",
          status: "ACTIVE",
          passwordHash,
          providerProfile: {
            create: {
              credentials: data.credentials,
              specialties: data.specialties,
              npi: data.npi ?? null,
              bio: data.bio ?? null,
              availability: { create: DEFAULT_AVAILABILITY },
              licenses: {
                create: data.licenses.map((l) => ({
                  state: l.state.toUpperCase(),
                  licenseNumber: l.licenseNumber,
                  licenseType: l.licenseType,
                  expiresAt: new Date(l.expiresAt),
                })),
              },
            },
          },
        },
        include: { providerProfile: true },
      });
      return user.providerProfile!;
    });

    await audit({
      actorId: admin.id,
      action: "provider.onboarded",
      resourceType: "ProviderProfile",
      resourceId: provider.id,
    });

    // Invite email (PHI-free) — link to sign in and finish MFA setup.
    try {
      await sendEmail({
        to: email,
        subject: "Your Calm Point provider account",
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <p style="color:#3e6b5c;font-weight:700;font-size:18px">Calm Point</p>
          <div style="background:#fff;border:1px solid #eee;border-radius:16px;padding:28px">
            <h2 style="font-size:20px">Welcome to the care team</h2>
            <p style="color:#565a67;line-height:1.6">An account has been created for you. Sign in with the temporary password you were given, then you'll set up two-factor authentication.</p>
            <a href="${appBaseUrl()}/login" style="display:inline-block;background:#3e6b5c;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;margin-top:12px">Sign in</a>
          </div></div>`,
        text: `Your Calm Point provider account is ready. Sign in: ${appBaseUrl()}/login`,
      });
    } catch (e) {
      console.error("[provider-onboard] invite email failed", e);
    }

    return Response.json({ ok: true, providerId: provider.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "field";
      return Response.json({ error: `A provider with that ${target} already exists` }, { status: 409 });
    }
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** GET → list providers (admin panel), with license verification status. */
export async function GET() {
  try {
    await requireRole("ADMIN");
    const providers = await prisma.providerProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true } },
        licenses: { select: { state: true, verifiedAt: true, expiresAt: true } },
      },
      take: 200,
    });
    return Response.json({
      providers: providers.map((p) => ({
        id: p.id,
        name: `${p.user.firstName} ${p.user.lastName}`,
        email: p.user.email,
        credentials: p.credentials,
        specialties: p.specialties,
        acceptingNew: p.acceptingNew,
        licenses: p.licenses.map((l) => ({
          state: l.state,
          verified: Boolean(l.verifiedAt),
          expiresAt: l.expiresAt.toISOString(),
        })),
        credentialed: p.licenses.length > 0 && p.licenses.every((l) => l.verifiedAt),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

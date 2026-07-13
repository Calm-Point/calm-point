import { prisma } from "@calm-point/db";

export const runtime = "nodejs";

/**
 * Internal billing lookup for the voice-bridge billing agent (docs/10 spec
 * Prompt 3). Service-token guarded (PLATFORM_SERVICE_TOKEN) — never exposed to
 * browsers. Returns billing state ONLY: no names, no clinical data, no PHI
 * beyond the caller-supplied email and phone last-4 used for verification.
 */
export async function GET(req: Request) {
  const token = process.env.PLATFORM_SERVICE_TOKEN;
  const provided = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || provided !== token) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      patientProfile: { include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
  if (!user) return Response.json(null);

  const sub = user.patientProfile?.subscriptions[0] ?? null;
  return Response.json({
    email,
    phoneLast4: (user.phone ?? "").replace(/\D/g, "").slice(-4),
    membershipStatus: sub?.status ?? "NONE",
    openBalanceCents: 0, // invoice balance integration lands with Stripe billing portal
    nextInvoiceDate: sub?.currentPeriodEnd.toISOString().slice(0, 10) ?? undefined,
  });
}

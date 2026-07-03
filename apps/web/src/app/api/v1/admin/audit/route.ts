import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";

export async function GET(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const url = new URL(req.url);
    const action = url.searchParams.get("action")?.trim();
    const actor = url.searchParams.get("actor")?.trim();
    const events = await prisma.auditEvent.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(actor ? { actor: { email: { contains: actor, mode: "insensitive" } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { email: true, role: true } } },
    });
    // Auditing audit reads keeps the access trail complete (HIPAA §164.312(b)).
    await audit({ actorId: admin.id, action: "admin.audit.search", resourceType: "AuditEvent" });
    return Response.json({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        actorEmail: e.actor?.email ?? null,
        actorRole: e.actor?.role ?? null,
        ip: e.ip,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

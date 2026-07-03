import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { clientIp } from "@/server/rate-limit";

export async function GET(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });
    await audit({
      actorId: admin.id,
      action: "admin.users.list",
      resourceType: "User",
      metadata: { query },
    });
    return Response.json({ users });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  userId: z.string().min(1), // cuid in app-created rows; readable ids in seeds
  action: z.enum(["suspend", "reactivate", "reset-mfa"]),
});

export async function PUT(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const { userId, action } = parsed.data;
    if (userId === admin.id) {
      return Response.json({ error: "You can't modify your own account here." }, { status: 409 });
    }
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return Response.json({ error: "Not found" }, { status: 404 });

    if (action === "suspend") {
      await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
    } else if (action === "reactivate") {
      await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null },
      });
    }
    await audit({
      actorId: admin.id,
      action: `admin.user.${action}`,
      resourceType: "User",
      resourceId: userId,
      ip: clientIp(req),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

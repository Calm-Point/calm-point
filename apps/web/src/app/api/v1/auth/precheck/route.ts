import { z } from "zod";
import { prisma } from "@calm-point/db";
import { verifyPassword } from "@/server/auth/password";
import { rateLimit, clientIp } from "@/server/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

/**
 * Step 1 of login: verifies credentials and tells the client whether a TOTP
 * code is needed, so the login form can reveal the MFA field. Deliberately
 * returns the same shape for bad credentials as for unknown accounts.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!(await rateLimit(`precheck:${ip}`, 20, 60_000))) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user?.passwordHash || user.status !== "ACTIVE") {
    return Response.json({ ok: false });
  }
  const valid = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!valid) return Response.json({ ok: false });

  return Response.json({ ok: true, mfaRequired: user.mfaEnabled });
}

import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireUser, authzErrorResponse } from "@/server/authorize";
import { encryptSecret, generateMfaSecret, otpauthUrl, verifyTotp } from "@/server/auth/mfa";
import { rateLimit } from "@/server/rate-limit";

/** POST → provision a pending TOTP secret and return the otpauth URL for QR display. */
export async function POST() {
  try {
    const user = await requireUser();
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (dbUser.mfaEnabled) {
      return Response.json({ error: "MFA already enabled" }, { status: 409 });
    }
    const secret = generateMfaSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: encryptSecret(secret), mfaEnabled: false },
    });
    return Response.json({ otpauth: otpauthUrl(dbUser.email, secret), secret });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const verifySchema = z.object({ code: z.string().length(6) });

/** PUT → confirm the pending secret with a live code; enables MFA. */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!(await rateLimit(`mfa-verify:${user.id}`, 10, 60_000))) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const parsed = verifySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid code" }, { status: 400 });

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!dbUser.mfaSecret) {
      return Response.json({ error: "No pending MFA setup" }, { status: 409 });
    }
    if (!(await verifyTotp(dbUser.mfaSecret, parsed.data.code))) {
      return Response.json({ error: "That code didn't match. Try again." }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    await audit({
      actorId: user.id,
      action: "auth.mfa.enabled",
      resourceType: "User",
      resourceId: user.id,
    });
    // Session JWT still carries mfaEnabled=false — client must re-authenticate.
    return Response.json({ ok: true, reauthRequired: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

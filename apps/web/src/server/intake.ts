import { cookies } from "next/headers";
import { prisma } from "@calm-point/db";

export const INTAKE_COOKIE = "cp_intake";

/** Resolves the caller's live (unexpired, unlinked-or-owned) intake session. */
export async function currentIntakeSession() {
  const jar = await cookies();
  const token = jar.get(INTAKE_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.intakeSession.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

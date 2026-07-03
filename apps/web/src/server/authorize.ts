import { prisma, type Role } from "@calm-point/db";
import { auth } from "@/auth";

export class AuthzError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export interface SessionUser {
  id: string;
  role: Role;
  mfaEnabled: boolean;
}

/** Every protected handler starts here. Throws AuthzError — handlers map it to a response. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthzError(401, "Not authenticated");
  return session.user as SessionUser;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthzError(403, "Forbidden");
  if ((user.role === "PROVIDER" || user.role === "ADMIN") && !user.mfaEnabled) {
    throw new AuthzError(403, "MFA setup required");
  }
  return user;
}

/**
 * Provider access boundary: an active CareRelationship is the ONLY path to a
 * patient's records (docs/03 §1). Admin access is allowed but always audited
 * by the caller.
 */
export async function requirePatientAccess(
  user: SessionUser,
  patientProfileId: string,
): Promise<void> {
  if (user.role === "ADMIN") return;
  if (user.role === "PATIENT") {
    const profile = await prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      select: { userId: true },
    });
    if (profile?.userId === user.id) return;
    throw new AuthzError(403, "Forbidden");
  }
  if (user.role === "PROVIDER") {
    const relationship = await prisma.careRelationship.findFirst({
      where: {
        patientId: patientProfileId,
        endedAt: null,
        provider: { userId: user.id },
      },
      select: { id: true },
    });
    if (relationship) return;
    throw new AuthzError(403, "Forbidden");
  }
  throw new AuthzError(403, "Forbidden");
}

export function authzErrorResponse(err: unknown): Response | null {
  if (err instanceof AuthzError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}

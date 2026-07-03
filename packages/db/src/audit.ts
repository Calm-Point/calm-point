import { prisma } from "./index";

export interface AuditInput {
  actorId?: string | null;
  action: string; // dot-namespaced: "auth.login", "note.sign", "admin.impersonate"
  resourceType: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail (HIPAA §164.312(b)). Every clinical read/write and
 * every auth/admin event goes through here. Audit failures are logged but never
 * crash the calling request — losing one audit row is better than denying care;
 * the error path is monitored.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata as never,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console -- deliberate: audit write failure must be visible in logs/alerts
    console.error("[audit] write failed", { action: input.action, err });
  }
}

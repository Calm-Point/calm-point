import { prisma } from "@calm-point/db";

/**
 * PHI retention scrubber (docs/10 spec §5.2). Federal records-retention gives a
 * 7-year floor; after a patient has been DEACTIVATED for 7+ years we scrub
 * direct identifiers while preserving de-identified clinical records and the
 * append-only audit trail (which is itself a legal record). Runs from a daily
 * cron; idempotent — already-scrubbed users are skipped.
 */

export const RETENTION_YEARS = 7;

/** Pure: the cutoff instant — anything deactivated on/before this is scrubbable. */
export function retentionCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - RETENTION_YEARS);
  return d;
}

export async function processRetention(now = new Date()) {
  const cutoff = retentionCutoff(now);
  // DEACTIVATED users whose last update predates the cutoff and who still
  // carry an email that isn't already anonymized.
  const users = await prisma.user.findMany({
    where: {
      status: "DEACTIVATED",
      updatedAt: { lte: cutoff },
      email: { not: { startsWith: "scrubbed+" } },
    },
    include: { patientProfile: { select: { id: true } } },
    take: 100, // bounded batch per tick
  });

  let scrubbed = 0;
  for (const user of users) {
    const anon = `scrubbed+${user.id}@retention.invalid`;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: anon,
          firstName: "Removed",
          lastName: "PerRetention",
          phone: null,
          passwordHash: null,
          mfaSecret: null,
        },
      });
      if (user.patientProfile) {
        const pid = user.patientProfile.id;
        await tx.patientProfile.update({
          where: { id: pid },
          data: {
            dateOfBirth: null,
            pronouns: null,
            emergencyContactName: null,
            emergencyContactPhone: null,
            pharmacyName: null,
            pharmacyAddress: null,
          },
        });
        // Identity documents + insurance card references are direct identifiers.
        await tx.identityDocument.deleteMany({ where: { patientId: pid } });
        await tx.insurancePolicy.updateMany({
          where: { patientId: pid },
          data: { memberId: "", groupNumber: null, frontImageKey: null, backImageKey: null },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorId: null,
          action: "retention.scrubbed",
          resourceType: "User",
          resourceId: user.id,
        },
      });
    });
    scrubbed++;
  }
  return { scanned: users.length, scrubbed, cutoff: cutoff.toISOString() };
}

import { prisma } from "@calm-point/db";

/**
 * Appointment reminders (docs/04 §3.1): T-24h and T-1h tiers. The cron
 * endpoint calls `processDueReminders` every ~15 minutes; delivery is
 * IN_APP always, plus EMAIL/SMS once those vendors are configured (BAA'd).
 * Reminder content is PHI-free — "You have a visit coming up" — details
 * live behind authentication.
 */

export type ReminderTier = "24h" | "1h";

const TIERS: Array<{ tier: ReminderTier; windowStartMin: number; windowEndMin: number }> = [
  // Fire when the visit is within (start, end] minutes from now.
  { tier: "24h", windowStartMin: 23 * 60, windowEndMin: 24 * 60 },
  { tier: "1h", windowStartMin: 0, windowEndMin: 60 },
];

/** Pure: which tiers are due for a visit starting `minutesOut` from now. */
export function dueTiers(minutesOut: number): ReminderTier[] {
  return TIERS.filter(
    (t) => minutesOut > t.windowStartMin && minutesOut <= t.windowEndMin,
  ).map((t) => t.tier);
}

export async function processDueReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60_000);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      startsAt: { gt: now, lte: horizon },
    },
    include: {
      patient: { select: { userId: true } },
      provider: { select: { userId: true } },
    },
  });

  let created = 0;
  for (const appointment of appointments) {
    const minutesOut = (appointment.startsAt.getTime() - now.getTime()) / 60_000;
    for (const tier of dueTiers(minutesOut)) {
      const template = `visit-reminder-${tier}`;
      for (const userId of [appointment.patient.userId, appointment.provider.userId]) {
        // Dedupe: one notification per (user, appointment, tier).
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            template,
            meta: { path: ["appointmentId"], equals: appointment.id },
          },
        });
        if (existing) continue;
        await prisma.notification.create({
          data: {
            userId,
            channel: "IN_APP",
            template,
            sentAt: now,
            meta: { appointmentId: appointment.id },
          },
        });
        created++;
        // EMAIL/SMS delivery slots in here once SES/Twilio are configured
        // (PHI-free template bodies only — docs/05 §push/SMS rule).
      }
    }
  }
  return { scanned: appointments.length, created };
}

// ── ICS calendar files ──────────────────────────────────────────────────────

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Pure ICS generator — deliberately PHI-light (no condition, no notes). */
export function buildIcs(input: {
  uid: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  url?: string;
}): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calm Point//Visits//EN",
    "BEGIN:VEVENT",
    `UID:${icsEscape(input.uid)}@calmpoint`,
    `DTSTAMP:${icsDate(new Date(input.startsAt))}`,
    `DTSTART:${icsDate(input.startsAt)}`,
    `DTEND:${icsDate(input.endsAt)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    ...(input.url ? [`URL:${icsEscape(input.url)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upcoming visit",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

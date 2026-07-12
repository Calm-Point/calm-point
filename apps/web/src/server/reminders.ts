import { prisma } from "@calm-point/db";
import { sendVisitReminder } from "./notifications";

/**
 * Appointment reminders (docs/10 §1.7): T-24h, T-1h, and T-5min tiers. The
 * cron endpoint calls `processDueReminders` frequently (≤5 min cadence so the
 * 5-minute tier fires on time — see apps/web/vercel.json). Every recipient
 * (patient AND provider) gets an IN_APP notification plus EMAIL + SMS with a
 * secure join link once those vendors are configured. Content is PHI-free.
 */

export type ReminderTier = "24h" | "1h" | "5m";

const TIERS: Array<{ tier: ReminderTier; windowStartMin: number; windowEndMin: number }> = [
  // Fire when the visit is within (start, end] minutes from now. Non-overlapping.
  { tier: "24h", windowStartMin: 23 * 60, windowEndMin: 24 * 60 },
  { tier: "1h", windowStartMin: 30, windowEndMin: 60 },
  { tier: "5m", windowStartMin: 0, windowEndMin: 6 },
];

const TIER_LABEL: Record<ReminderTier, string> = {
  "24h": "in 24 hours",
  "1h": "in 1 hour",
  "5m": "in 5 minutes",
};

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
      patient: { select: { userId: true, user: { select: { email: true, phone: true } } } },
      provider: { select: { userId: true, user: { select: { email: true, phone: true } } } },
    },
  });

  let created = 0;
  let delivered = 0;
  for (const appointment of appointments) {
    const minutesOut = (appointment.startsAt.getTime() - now.getTime()) / 60_000;
    for (const tier of dueTiers(minutesOut)) {
      const template = `visit-reminder-${tier}`;
      const recipients = [
        { userId: appointment.patient.userId, contact: appointment.patient.user },
        { userId: appointment.provider.userId, contact: appointment.provider.user },
      ];
      for (const { userId, contact } of recipients) {
        // Dedupe: one reminder bundle per (user, appointment, tier).
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
        // EMAIL + SMS (PHI-free, with join link). Non-fatal on vendor error.
        try {
          await sendVisitReminder({
            email: contact.email,
            phone: contact.phone,
            minutesLabel: TIER_LABEL[tier],
            appointmentId: appointment.id,
          });
          delivered++;
        } catch (err) {
          console.error("[reminders] delivery failed", appointment.id, tier, err);
        }
      }
    }
  }
  return { scanned: appointments.length, created, delivered };
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

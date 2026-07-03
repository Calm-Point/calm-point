import { prisma, type AvailabilityBlock } from "@calm-point/db";

/**
 * Slot generation for provider availability templates (docs/04 §3.1).
 * All wall-clock math happens in the PROVIDER's IANA timezone and is converted
 * to UTC instants via Intl — DST-safe (covered by unit tests).
 */

const MS_PER_MIN = 60_000;
export const MIN_NOTICE_MIN = 120; // patients can't book inside 2 hours

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/** Convert a wall-clock (Y-M-D + minutes past midnight) in `timeZone` to a UTC Date. */
export function zonedToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  minutesPastMidnight: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minutesPastMidnight);
  // Two-pass offset resolution handles DST transitions.
  const offset1 = tzOffsetMs(guess, timeZone);
  const offset2 = tzOffsetMs(guess - offset1, timeZone);
  return new Date(guess - offset2);
}

/** Day-of-week (0=Sun) and Y/M/D of a UTC instant as seen in `timeZone`. */
export function zonedDayParts(utc: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(dtf.formatToParts(utc).map((p) => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayOfWeek: dow,
  };
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

/** Pure slot expansion: availability template × date window − busy intervals. */
export function expandSlots(options: {
  blocks: Pick<
    AvailabilityBlock,
    "dayOfWeek" | "startMin" | "endMin" | "slotSizeMin" | "effectiveFrom" | "effectiveTo"
  >[];
  timeZone: string;
  from: Date;
  days: number;
  busy: Array<{ startsAt: Date; endsAt: Date }>;
  now?: Date;
}): Slot[] {
  const { blocks, timeZone, from, days, busy } = options;
  const now = options.now ?? new Date();
  const earliest = new Date(now.getTime() + MIN_NOTICE_MIN * MS_PER_MIN);
  const slots: Slot[] = [];

  for (let d = 0; d < days; d++) {
    const dayUtc = new Date(from.getTime() + d * 24 * 3600 * 1000);
    const parts = zonedDayParts(dayUtc, timeZone);
    for (const block of blocks) {
      if (block.dayOfWeek !== parts.dayOfWeek) continue;
      const dayStart = zonedToUtc(parts.year, parts.month, parts.day, 0, timeZone);
      if (block.effectiveFrom > dayStart) continue;
      if (block.effectiveTo && block.effectiveTo < dayStart) continue;
      for (let m = block.startMin; m + block.slotSizeMin <= block.endMin; m += block.slotSizeMin) {
        const startsAt = zonedToUtc(parts.year, parts.month, parts.day, m, timeZone);
        const endsAt = new Date(startsAt.getTime() + block.slotSizeMin * MS_PER_MIN);
        if (startsAt < earliest) continue;
        const conflict = busy.some((b) => startsAt < b.endsAt && endsAt > b.startsAt);
        if (!conflict) slots.push({ startsAt, endsAt });
      }
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] as const;

export async function availableSlotsForProvider(
  providerId: string,
  days = 7,
  from = new Date(),
): Promise<Slot[]> {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: { user: { select: { timezone: true } }, availability: true },
  });
  if (!provider) return [];
  const to = new Date(from.getTime() + days * 24 * 3600 * 1000);
  const busy = await prisma.appointment.findMany({
    where: {
      providerId,
      status: { in: [...ACTIVE_STATUSES] },
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: { startsAt: true, endsAt: true },
  });
  return expandSlots({
    blocks: provider.availability,
    timeZone: provider.user.timezone,
    from,
    days,
    busy,
  });
}

/**
 * Books a slot atomically. A per-provider transaction-scoped advisory lock
 * serializes concurrent bookings so double-booking is impossible even under
 * racing requests (verified by the booking contention test).
 */
export async function bookSlot(input: {
  patientId: string;
  providerId: string;
  startsAt: Date;
  kind: "INITIAL" | "FOLLOW_UP" | "THERAPY";
}): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
  const { patientId, providerId, startsAt, kind } = input;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${providerId}))`;

    // Re-validate the slot against the template + current bookings inside the lock.
    const slots = await (async () => {
      const provider = await tx.providerProfile.findUnique({
        where: { id: providerId },
        include: { user: { select: { timezone: true } }, availability: true },
      });
      if (!provider) return [];
      const from = new Date();
      const to = new Date(from.getTime() + 14 * 24 * 3600 * 1000);
      const busy = await tx.appointment.findMany({
        where: {
          providerId,
          status: { in: [...ACTIVE_STATUSES] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { startsAt: true, endsAt: true },
      });
      return expandSlots({
        blocks: provider.availability,
        timeZone: provider.user.timezone,
        from,
        days: 14,
        busy,
      });
    })();

    const slot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
    if (!slot) return { ok: false as const, error: "That time is no longer available." };

    const appointment = await tx.appointment.create({
      data: {
        patientId,
        providerId,
        kind,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      },
    });

    // First booking establishes the clinical relationship (docs/04 §3.1).
    const existing = await tx.careRelationship.findFirst({
      where: { patientId, providerId, endedAt: null },
    });
    if (!existing) {
      await tx.careRelationship.create({ data: { patientId, providerId } });
    }

    return { ok: true as const, appointmentId: appointment.id };
  });
}

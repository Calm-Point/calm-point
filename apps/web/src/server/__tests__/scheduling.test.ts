import { describe, expect, it } from "vitest";
import { expandSlots, zonedToUtc, zonedDayParts } from "../scheduling";

const NY = "America/New_York";

const block = {
  dayOfWeek: 1, // Monday
  startMin: 9 * 60,
  endMin: 11 * 60,
  slotSizeMin: 30,
  effectiveFrom: new Date("2020-01-01T00:00:00Z"),
  effectiveTo: null,
};

describe("zonedToUtc", () => {
  it("converts NY wall-clock to UTC in winter (EST, UTC-5)", () => {
    expect(zonedToUtc(2026, 1, 12, 9 * 60, NY).toISOString()).toBe(
      "2026-01-12T14:00:00.000Z",
    );
  });

  it("converts NY wall-clock to UTC in summer (EDT, UTC-4)", () => {
    expect(zonedToUtc(2026, 7, 13, 9 * 60, NY).toISOString()).toBe(
      "2026-07-13T13:00:00.000Z",
    );
  });

  it("handles the spring-forward DST boundary (Mar 8 2026)", () => {
    // 9am on the Monday after spring-forward is EDT.
    expect(zonedToUtc(2026, 3, 9, 9 * 60, NY).toISOString()).toBe(
      "2026-03-09T13:00:00.000Z",
    );
    // The day before the transition is still EST.
    expect(zonedToUtc(2026, 3, 7, 9 * 60, NY).toISOString()).toBe(
      "2026-03-07T14:00:00.000Z",
    );
  });

  it("round-trips day parts across timezones", () => {
    const utc = zonedToUtc(2026, 7, 13, 9 * 60, NY);
    const parts = zonedDayParts(utc, NY);
    expect(parts).toMatchObject({ year: 2026, month: 7, day: 13, dayOfWeek: 1 });
  });
});

describe("expandSlots", () => {
  const now = new Date("2026-07-12T00:00:00Z"); // Sunday

  it("generates Monday slots in provider-local time, converted to UTC", () => {
    const slots = expandSlots({
      blocks: [block],
      timeZone: NY,
      from: now,
      days: 3,
      busy: [],
      now,
    });
    // Mon Jul 13, 9:00–11:00 EDT, 30-min slots → 4 slots starting 13:00Z.
    expect(slots).toHaveLength(4);
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-07-13T13:00:00.000Z");
    expect(slots[3]!.startsAt.toISOString()).toBe("2026-07-13T14:30:00.000Z");
  });

  it("excludes slots that conflict with existing appointments", () => {
    const slots = expandSlots({
      blocks: [block],
      timeZone: NY,
      from: now,
      days: 3,
      busy: [
        {
          startsAt: new Date("2026-07-13T13:30:00.000Z"),
          endsAt: new Date("2026-07-13T14:00:00.000Z"),
        },
      ],
      now,
    });
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.startsAt.toISOString())).not.toContain(
      "2026-07-13T13:30:00.000Z",
    );
  });

  it("enforces the minimum-notice window", () => {
    // "Now" is 8:30am ET Monday; 9:00 + 9:30 slots are inside 2h notice.
    const lateNow = new Date("2026-07-13T12:30:00.000Z");
    const slots = expandSlots({
      blocks: [block],
      timeZone: NY,
      from: lateNow,
      days: 1,
      busy: [],
      now: lateNow,
    });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      "2026-07-13T14:30:00.000Z",
    ]);
  });

  it("respects effectiveFrom/effectiveTo bounds", () => {
    const slots = expandSlots({
      blocks: [{ ...block, effectiveTo: new Date("2026-07-01T00:00:00Z") }],
      timeZone: NY,
      from: now,
      days: 7,
      busy: [],
      now,
    });
    expect(slots).toHaveLength(0);
  });
});

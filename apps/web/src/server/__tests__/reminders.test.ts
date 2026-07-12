import { describe, expect, it } from "vitest";
import { buildIcs, dueTiers } from "../reminders";

describe("reminder tiers", () => {
  it("fires the 1h tier inside the final hour only", () => {
    expect(dueTiers(59)).toEqual(["1h"]);
    expect(dueTiers(60)).toEqual(["1h"]);
    expect(dueTiers(61)).toEqual([]);
    expect(dueTiers(0)).toEqual([]); // visit already starting — no reminder
  });

  it("fires the 24h tier in the 23–24h window only", () => {
    expect(dueTiers(23 * 60 + 30)).toEqual(["24h"]);
    expect(dueTiers(24 * 60)).toEqual(["24h"]);
    expect(dueTiers(24 * 60 + 1)).toEqual([]);
    expect(dueTiers(22 * 60)).toEqual([]);
  });

  it("fires the 5-minute tier inside the final ~5 minutes only", () => {
    expect(dueTiers(5)).toEqual(["5m"]);
    expect(dueTiers(6)).toEqual(["5m"]);
    expect(dueTiers(7)).toEqual([]);
    expect(dueTiers(0)).toEqual([]); // visit already starting — no reminder
  });

  it("tiers never overlap for any minutesOut", () => {
    for (let m = 0; m <= 24 * 60 + 5; m++) {
      expect(dueTiers(m).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("ICS generation", () => {
  const ics = buildIcs({
    uid: "appt123",
    startsAt: new Date("2026-07-10T14:00:00.000Z"),
    endsAt: new Date("2026-07-10T14:30:00.000Z"),
    title: "Calm Point visit with Sam Chen; MD, PLLC",
    url: "https://calmpoint.example/app/visit/appt123",
  });

  it("emits valid VCALENDAR structure with UTC times", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20260710T140000Z");
    expect(ics).toContain("DTEND:20260710T143000Z");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
  });

  it("escapes reserved characters in text fields", () => {
    expect(ics).toContain("SUMMARY:Calm Point visit with Sam Chen\\; MD\\, PLLC");
  });

  it("contains no clinical details (PHI-light by construction)", () => {
    expect(ics.toLowerCase()).not.toMatch(/anxiety|depression|adhd|diagnos/);
  });
});

import { describe, expect, it } from "vitest";
import { scoreResponse, severityForScore } from "../scoring";
import type { Instrument } from "../content/instruments";
import {
  ASRS_A,
  AUDIT_C,
  GAD7,
  INSTRUMENTS,
  INTAKE_BATTERY,
  INTAKE_ITEM_COUNT,
  ISI,
  PCPTSD5,
  PHQ9,
} from "../content/instruments";

/** Max SUM score respecting per-question option overrides. */
function maxScore(inst: Instrument): number {
  return inst.questions.reduce((n, q) => {
    const opts = q.options ?? inst.options;
    return n + Math.max(...opts.map((o) => o.value));
  }, 0);
}

// Clinical-logic tests — these assert the canonical published cutoffs.
// A failing test here means someone changed clinically defined thresholds.

describe("PHQ-9", () => {
  it("has 9 questions, 0–3 options, and item 9 as the safety item", () => {
    expect(PHQ9.questions).toHaveLength(9);
    expect(PHQ9.options.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    expect(PHQ9.questions[8]!.isSafetyItem).toBe(true);
    expect(PHQ9.questions.filter((q) => q.isSafetyItem)).toHaveLength(1);
  });

  it("scores as a sum with max 27", () => {
    const all3 = PHQ9.questions.map(() => ({ value: 3 }));
    expect(scoreResponse("SUM", all3)).toBe(27);
  });

  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "moderately-severe"],
    [19, "moderately-severe"],
    [20, "severe"],
    [27, "severe"],
  ])("canonical cutoffs: score %i → %s", (score, severity) => {
    expect(severityForScore(PHQ9.rules, score)).toBe(severity);
  });

  it("rules cover the full 0–27 range with no gaps or overlaps", () => {
    for (let s = 0; s <= 27; s++) {
      expect(PHQ9.rules.filter((r) => s >= r.minScore && s <= r.maxScore)).toHaveLength(1);
    }
  });
});

describe("GAD-7", () => {
  it("has 7 questions and max score 21", () => {
    expect(GAD7.questions).toHaveLength(7);
    expect(scoreResponse("SUM", GAD7.questions.map(() => ({ value: 3 })))).toBe(21);
  });

  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "severe"],
    [21, "severe"],
  ])("canonical cutoffs: score %i → %s", (score, severity) => {
    expect(severityForScore(GAD7.rules, score)).toBe(severity);
  });
});

describe("ASRS v1.1 Part A", () => {
  it("has 6 questions with shaded thresholds (1–3 from Sometimes, 4–6 from Often)", () => {
    expect(ASRS_A.questions).toHaveLength(6);
    expect(ASRS_A.questions.slice(0, 3).map((q) => q.shadedMin)).toEqual([2, 2, 2]);
    expect(ASRS_A.questions.slice(3).map((q) => q.shadedMin)).toEqual([3, 3, 3]);
  });

  it("counts shaded boxes, not sums", () => {
    // Q1 "Sometimes"(2) = shaded; Q4 "Sometimes"(2) = NOT shaded (threshold Often).
    const answers = ASRS_A.questions.map((q, i) => ({
      value: i === 0 || i === 3 ? 2 : 0,
      shadedMin: q.shadedMin,
    }));
    expect(scoreResponse("SHADED_COUNT", answers)).toBe(1);
  });

  it("4+ shaded boxes is a positive screen; 3 is negative", () => {
    expect(severityForScore(ASRS_A.rules, 3)).toBe("negative-screen");
    expect(severityForScore(ASRS_A.rules, 4)).toBe("positive-screen");
    expect(severityForScore(ASRS_A.rules, 6)).toBe("positive-screen");
  });
});

describe("ISI (Insomnia Severity Index)", () => {
  it("has 7 items and max score 28", () => {
    expect(ISI.questions).toHaveLength(7);
    expect(maxScore(ISI)).toBe(28);
  });

  it.each([
    [0, "no-clinical-insomnia"],
    [7, "no-clinical-insomnia"],
    [8, "subthreshold"],
    [14, "subthreshold"],
    [15, "moderate"],
    [21, "moderate"],
    [22, "severe"],
    [28, "severe"],
  ])("canonical cutoffs: score %i → %s", (score, severity) => {
    expect(severityForScore(ISI.rules, score)).toBe(severity);
  });
});

describe("AUDIT-C (alcohol consumption)", () => {
  it("has 3 items with per-item anchors and max score 12", () => {
    expect(AUDIT_C.questions).toHaveLength(3);
    expect(AUDIT_C.questions.every((q) => q.options && q.options.length === 5)).toBe(true);
    expect(maxScore(AUDIT_C)).toBe(12);
  });

  it.each([
    [0, "lower-risk"],
    [3, "lower-risk"],
    [4, "at-risk"],
    [12, "at-risk"],
  ])("cutoffs: score %i → %s", (score, severity) => {
    expect(severityForScore(AUDIT_C.rules, score)).toBe(severity);
  });
});

describe("PC-PTSD-5", () => {
  it("has 5 yes/no items and max score 5", () => {
    expect(PCPTSD5.questions).toHaveLength(5);
    expect(PCPTSD5.options.map((o) => o.value)).toEqual([0, 1]);
    expect(maxScore(PCPTSD5)).toBe(5);
  });

  it("cutoff ≥3 is a positive screen", () => {
    expect(severityForScore(PCPTSD5.rules, 2)).toBe("negative-screen");
    expect(severityForScore(PCPTSD5.rules, 3)).toBe("positive-screen");
    expect(severityForScore(PCPTSD5.rules, 5)).toBe("positive-screen");
  });
});

describe("intake battery", () => {
  it("orders the six validated instruments and totals 37 scored items", () => {
    expect(INTAKE_BATTERY.map((b) => b.slug)).toEqual([
      "phq-9",
      "gad-7",
      "asrs-v1.1",
      "isi",
      "pc-ptsd-5",
      "audit-c",
    ]);
    expect(INTAKE_ITEM_COUNT).toBe(37);
  });

  it("every battery instrument exists and every SUM instrument has gap-free rules", () => {
    for (const b of INTAKE_BATTERY) {
      const inst = INSTRUMENTS.find((i) => i.slug === b.slug);
      expect(inst, `missing instrument ${b.slug}`).toBeDefined();
      if (inst!.scoringMethod === "SUM") {
        for (let s = 0; s <= maxScore(inst!); s++) {
          expect(
            inst!.rules.filter((r) => s >= r.minScore && s <= r.maxScore),
            `${inst!.slug} score ${s} must map to exactly one rule`,
          ).toHaveLength(1);
        }
      }
    }
  });

  it("exactly one safety item across the battery (PHQ-9 item 9)", () => {
    const safety = INSTRUMENTS.flatMap((i) => i.questions).filter((q) => q.isSafetyItem);
    expect(safety).toHaveLength(1);
  });
});

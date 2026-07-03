import { describe, expect, it } from "vitest";
import { scoreResponse, severityForScore } from "../scoring";
import { ASRS_A, GAD7, PHQ9 } from "../content/instruments";

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

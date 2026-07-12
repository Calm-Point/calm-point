import { describe, expect, it } from "vitest";
import { buildAnalysisInput, computeRiskFlags } from "../analysis";

// Deterministic risk logic — must never depend on model output.

const rules27 = [{ maxScore: 4 }, { maxScore: 27 }];
const rules6 = [{ maxScore: 3 }, { maxScore: 6 }];

describe("buildAnalysisInput", () => {
  it("derives instrument max from the top scoring rule and aggregates safety", () => {
    const input = buildAnalysisInput([
      {
        totalScore: 22,
        severity: "severe",
        flaggedSafety: true,
        questionnaire: { slug: "phq-9", title: "PHQ-9", scoringRules: rules27 },
      },
      {
        totalScore: 5,
        severity: "positive-screen",
        flaggedSafety: false,
        questionnaire: { slug: "asrs-v1.1", title: "ASRS v1.1 (Part A)", scoringRules: rules6 },
      },
    ]);
    expect(input.instruments[0]!.max).toBe(27);
    expect(input.instruments[1]!.max).toBe(6);
    expect(input.safetyFlagged).toBe(true);
  });
});

describe("computeRiskFlags", () => {
  it("emits a CRITICAL flag when a safety item is endorsed", () => {
    const flags = computeRiskFlags({
      instruments: [
        { slug: "phq-9", title: "PHQ-9", score: 10, max: 27, severity: "moderate", flaggedSafety: true },
      ],
      safetyFlagged: true,
    });
    expect(flags[0]!.severity).toBe("critical");
    expect(flags.filter((f) => f.severity === "critical")).toHaveLength(1);
  });

  it("maps severe/moderately-severe → high and positive screens → medium", () => {
    const flags = computeRiskFlags({
      instruments: [
        { slug: "phq-9", title: "PHQ-9", score: 22, max: 27, severity: "severe", flaggedSafety: false },
        { slug: "gad-7", title: "GAD-7", score: 12, max: 21, severity: "moderate", flaggedSafety: false },
        { slug: "asrs", title: "ASRS", score: 5, max: 6, severity: "positive-screen", flaggedSafety: false },
      ],
      safetyFlagged: false,
    });
    expect(flags.find((f) => f.label.startsWith("PHQ-9"))!.severity).toBe("high");
    expect(flags.find((f) => f.label.startsWith("GAD-7"))!.severity).toBe("medium");
    expect(flags.find((f) => f.label.startsWith("ASRS"))!.severity).toBe("medium");
  });

  it("emits no flags for a clean low-severity profile", () => {
    const flags = computeRiskFlags({
      instruments: [
        { slug: "phq-9", title: "PHQ-9", score: 2, max: 27, severity: "minimal", flaggedSafety: false },
        { slug: "gad-7", title: "GAD-7", score: 3, max: 21, severity: "minimal", flaggedSafety: false },
      ],
      safetyFlagged: false,
    });
    expect(flags).toHaveLength(0);
  });
});

/**
 * Server-side questionnaire scoring (docs/02 D6). Clinical thresholds are
 * data (ScoringRule rows seeded from ./content); this module is the math.
 * CLINICAL LOGIC — changes require tests to pass and human sign-off (CLAUDE.md).
 */

export type ScoringMethod = "SUM" | "SHADED_COUNT";

export interface ScorableAnswer {
  /** Numeric option value (e.g. PHQ-9: 0–3). */
  value: number;
  /**
   * For SHADED_COUNT (ASRS): minimum option value that counts as a shaded box
   * for this question. Undefined answers never count.
   */
  shadedMin?: number;
}

export interface SeverityRule {
  minScore: number;
  maxScore: number;
  severity: string;
}

export function scoreResponse(method: ScoringMethod, answers: ScorableAnswer[]): number {
  switch (method) {
    case "SUM":
      return answers.reduce((total, a) => total + a.value, 0);
    case "SHADED_COUNT":
      return answers.reduce(
        (count, a) =>
          a.shadedMin !== undefined && a.value >= a.shadedMin ? count + 1 : count,
        0,
      );
  }
}

export function severityForScore(rules: SeverityRule[], score: number): string | null {
  const rule = rules.find((r) => score >= r.minScore && score <= r.maxScore);
  return rule?.severity ?? null;
}

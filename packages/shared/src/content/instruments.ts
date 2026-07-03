/**
 * Canonical clinical instrument content — the single source seeded into the
 * Questionnaire tables and asserted by unit tests.
 *
 * ⚠️ CLINICAL CONTENT: cutoffs and wording are clinically defined
 * (PHQ-9/GAD-7: Kroenke, Spitzer & Williams — public domain; ASRS v1.1: WHO).
 * Do not modify without clinical sign-off (CLAUDE.md §must-not).
 */

import type { ScoringMethod } from "../scoring";

export interface InstrumentOption {
  label: string;
  value: number;
}

export interface InstrumentQuestion {
  prompt: string;
  isSafetyItem?: boolean;
  /** SHADED_COUNT instruments: min option value counting as shaded. */
  shadedMin?: number;
}

export interface InstrumentRule {
  minScore: number;
  maxScore: number;
  severity: string;
  recommendation: string;
}

export interface Instrument {
  slug: string;
  version: number;
  title: string;
  description: string;
  scoringMethod: ScoringMethod;
  preamble: string;
  options: InstrumentOption[];
  questions: InstrumentQuestion[];
  rules: InstrumentRule[];
}

const FREQUENCY_4 = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

const FREQUENCY_5 = [
  { label: "Never", value: 0 },
  { label: "Rarely", value: 1 },
  { label: "Sometimes", value: 2 },
  { label: "Often", value: 3 },
  { label: "Very often", value: 4 },
];

export const PHQ9: Instrument = {
  slug: "phq-9",
  version: 1,
  title: "PHQ-9",
  description: "Patient Health Questionnaire — depression screen",
  scoringMethod: "SUM",
  preamble:
    "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  options: FREQUENCY_4,
  questions: [
    { prompt: "Little interest or pleasure in doing things" },
    { prompt: "Feeling down, depressed, or hopeless" },
    { prompt: "Trouble falling or staying asleep, or sleeping too much" },
    { prompt: "Feeling tired or having little energy" },
    { prompt: "Poor appetite or overeating" },
    {
      prompt:
        "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    },
    {
      prompt:
        "Trouble concentrating on things, such as reading the newspaper or watching television",
    },
    {
      prompt:
        "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
    },
    {
      prompt:
        "Thoughts that you would be better off dead or of hurting yourself in some way",
      isSafetyItem: true,
    },
  ],
  rules: [
    { minScore: 0, maxScore: 4, severity: "minimal", recommendation: "Monitor; visit optional" },
    { minScore: 5, maxScore: 9, severity: "mild", recommendation: "Visit recommended" },
    { minScore: 10, maxScore: 14, severity: "moderate", recommendation: "Visit recommended; treatment plan" },
    { minScore: 15, maxScore: 19, severity: "moderately-severe", recommendation: "Prompt visit; active treatment" },
    { minScore: 20, maxScore: 27, severity: "severe", recommendation: "Prompt visit; active treatment; safety review" },
  ],
};

export const GAD7: Instrument = {
  slug: "gad-7",
  version: 1,
  title: "GAD-7",
  description: "Generalized Anxiety Disorder scale",
  scoringMethod: "SUM",
  preamble:
    "Over the last 2 weeks, how often have you been bothered by the following problems?",
  options: FREQUENCY_4,
  questions: [
    { prompt: "Feeling nervous, anxious, or on edge" },
    { prompt: "Not being able to stop or control worrying" },
    { prompt: "Worrying too much about different things" },
    { prompt: "Trouble relaxing" },
    { prompt: "Being so restless that it's hard to sit still" },
    { prompt: "Becoming easily annoyed or irritable" },
    { prompt: "Feeling afraid as if something awful might happen" },
  ],
  rules: [
    { minScore: 0, maxScore: 4, severity: "minimal", recommendation: "Monitor; visit optional" },
    { minScore: 5, maxScore: 9, severity: "mild", recommendation: "Visit recommended" },
    { minScore: 10, maxScore: 14, severity: "moderate", recommendation: "Visit recommended; treatment plan" },
    { minScore: 15, maxScore: 21, severity: "severe", recommendation: "Prompt visit; active treatment" },
  ],
};

/** ASRS v1.1 Part A — positive screen = 4+ shaded boxes (WHO scoring). */
export const ASRS_A: Instrument = {
  slug: "asrs-v1.1",
  version: 1,
  title: "ASRS v1.1 (Part A)",
  description: "Adult ADHD Self-Report Scale screener",
  scoringMethod: "SHADED_COUNT",
  preamble:
    "How often have you experienced the following over the past 6 months?",
  options: FREQUENCY_5,
  questions: [
    {
      prompt:
        "How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?",
      shadedMin: 2,
    },
    {
      prompt:
        "How often do you have difficulty getting things in order when you have to do a task that requires organization?",
      shadedMin: 2,
    },
    {
      prompt: "How often do you have problems remembering appointments or obligations?",
      shadedMin: 2,
    },
    {
      prompt:
        "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?",
      shadedMin: 3,
    },
    {
      prompt:
        "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?",
      shadedMin: 3,
    },
    {
      prompt:
        "How often do you feel overly active and compelled to do things, like you were driven by a motor?",
      shadedMin: 3,
    },
  ],
  rules: [
    { minScore: 0, maxScore: 3, severity: "negative-screen", recommendation: "Screen negative; clinical evaluation may still be warranted" },
    { minScore: 4, maxScore: 6, severity: "positive-screen", recommendation: "Positive ADHD screen; full clinical evaluation recommended" },
  ],
};

export const INSTRUMENTS = [PHQ9, GAD7, ASRS_A];

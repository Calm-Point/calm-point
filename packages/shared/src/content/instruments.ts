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
  /**
   * Per-question option scale override. Some validated instruments (ISI,
   * AUDIT-C) use different response anchors per item; when set, these options
   * apply to this question instead of the instrument-level `options`.
   */
  options?: InstrumentOption[];
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

/**
 * ISI — Insomnia Severity Index (Morin). 7 items, total 0–28. Public-domain
 * research scale. Per-item anchors differ, so options are set per question.
 */
const ISI_SEVERITY = [
  { label: "None", value: 0 },
  { label: "Mild", value: 1 },
  { label: "Moderate", value: 2 },
  { label: "Severe", value: 3 },
  { label: "Very severe", value: 4 },
];
export const ISI: Instrument = {
  slug: "isi",
  version: 1,
  title: "ISI",
  description: "Insomnia Severity Index",
  scoringMethod: "SUM",
  preamble: "Please rate the following regarding your sleep over the last 2 weeks.",
  options: ISI_SEVERITY,
  questions: [
    { prompt: "Difficulty falling asleep", options: ISI_SEVERITY },
    { prompt: "Difficulty staying asleep", options: ISI_SEVERITY },
    { prompt: "Problem waking up too early", options: ISI_SEVERITY },
    {
      prompt: "How satisfied/dissatisfied are you with your current sleep pattern?",
      options: [
        { label: "Very satisfied", value: 0 },
        { label: "Satisfied", value: 1 },
        { label: "Moderately satisfied", value: 2 },
        { label: "Dissatisfied", value: 3 },
        { label: "Very dissatisfied", value: 4 },
      ],
    },
    {
      prompt:
        "How noticeable to others do you think your sleep problem is in terms of impairing the quality of your life?",
      options: [
        { label: "Not at all noticeable", value: 0 },
        { label: "A little", value: 1 },
        { label: "Somewhat", value: 2 },
        { label: "Much", value: 3 },
        { label: "Very much noticeable", value: 4 },
      ],
    },
    {
      prompt: "How worried/distressed are you about your current sleep problem?",
      options: [
        { label: "Not at all worried", value: 0 },
        { label: "A little", value: 1 },
        { label: "Somewhat", value: 2 },
        { label: "Much", value: 3 },
        { label: "Very much worried", value: 4 },
      ],
    },
    {
      prompt:
        "To what extent do you consider your sleep problem to interfere with your daily functioning (e.g. daytime fatigue, mood, ability to function at work/daily chores, concentration, memory) currently?",
      options: [
        { label: "Not at all interfering", value: 0 },
        { label: "A little", value: 1 },
        { label: "Somewhat", value: 2 },
        { label: "Much", value: 3 },
        { label: "Very much interfering", value: 4 },
      ],
    },
  ],
  rules: [
    { minScore: 0, maxScore: 7, severity: "no-clinical-insomnia", recommendation: "No clinically significant insomnia" },
    { minScore: 8, maxScore: 14, severity: "subthreshold", recommendation: "Subthreshold insomnia; sleep hygiene review" },
    { minScore: 15, maxScore: 21, severity: "moderate", recommendation: "Clinical insomnia (moderate); visit recommended" },
    { minScore: 22, maxScore: 28, severity: "severe", recommendation: "Clinical insomnia (severe); prompt visit" },
  ],
};

/**
 * AUDIT-C — alcohol use screen (WHO/Bush). 3 items, total 0–12. Each item has
 * its own frequency/quantity anchors. At-risk cutoff ≥4 (males), ≥3 (females);
 * we flag ≥4 generically and note the sex-based nuance for the provider.
 */
export const AUDIT_C: Instrument = {
  slug: "audit-c",
  version: 1,
  title: "AUDIT-C",
  description: "Alcohol Use Disorders Identification Test (consumption)",
  scoringMethod: "SUM",
  preamble: "The next questions ask about your use of alcohol.",
  options: [{ label: "0", value: 0 }],
  questions: [
    {
      prompt: "How often do you have a drink containing alcohol?",
      options: [
        { label: "Never", value: 0 },
        { label: "Monthly or less", value: 1 },
        { label: "2–4 times a month", value: 2 },
        { label: "2–3 times a week", value: 3 },
        { label: "4 or more times a week", value: 4 },
      ],
    },
    {
      prompt:
        "How many standard drinks containing alcohol do you have on a typical day when you are drinking?",
      options: [
        { label: "1 or 2", value: 0 },
        { label: "3 or 4", value: 1 },
        { label: "5 or 6", value: 2 },
        { label: "7 to 9", value: 3 },
        { label: "10 or more", value: 4 },
      ],
    },
    {
      prompt: "How often do you have six or more drinks on one occasion?",
      options: [
        { label: "Never", value: 0 },
        { label: "Less than monthly", value: 1 },
        { label: "Monthly", value: 2 },
        { label: "Weekly", value: 3 },
        { label: "Daily or almost daily", value: 4 },
      ],
    },
  ],
  rules: [
    { minScore: 0, maxScore: 3, severity: "lower-risk", recommendation: "Lower-risk use (note: ≥3 may be significant for female patients)" },
    { minScore: 4, maxScore: 12, severity: "at-risk", recommendation: "At-risk / hazardous use; provider review recommended" },
  ],
};

/**
 * PC-PTSD-5 — Primary Care PTSD Screen for DSM-5 (VA). 5 yes/no items after a
 * trauma-exposure gate. Cutoff ≥3 = positive. The gate is handled by the battery
 * runner (a negative gate ends the screen); these 5 items are the scored core.
 */
const YES_NO = [
  { label: "No", value: 0 },
  { label: "Yes", value: 1 },
];
export const PCPTSD5: Instrument = {
  slug: "pc-ptsd-5",
  version: 1,
  title: "PC-PTSD-5",
  description: "Primary Care PTSD Screen for DSM-5",
  scoringMethod: "SUM",
  preamble:
    "Thinking about a frightening, horrible, or traumatic experience you may have had — in the past month, have you…",
  options: YES_NO,
  questions: [
    { prompt: "Had nightmares about the event(s) or thought about the event(s) when you did not want to?" },
    { prompt: "Tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?" },
    { prompt: "Been constantly on guard, watchful, or easily startled?" },
    { prompt: "Felt numb or detached from people, activities, or your surroundings?" },
    { prompt: "Felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?" },
  ],
  rules: [
    { minScore: 0, maxScore: 2, severity: "negative-screen", recommendation: "Screen negative for probable PTSD" },
    { minScore: 3, maxScore: 5, severity: "positive-screen", recommendation: "Positive PTSD screen; further assessment recommended" },
  ],
};

export const INSTRUMENTS = [PHQ9, GAD7, ASRS_A, ISI, AUDIT_C, PCPTSD5];

/**
 * The intake battery: the ordered set of validated instruments administered to
 * a new patient (~37 scored items). Demographics/history are captured separately
 * (see schemas/onboarding.ts) and round the full intake out to ~45 questions.
 * Order places the two highest-priority mood/anxiety screens first.
 */
export const INTAKE_BATTERY: { slug: string; domain: string }[] = [
  { slug: "phq-9", domain: "depression" },
  { slug: "gad-7", domain: "anxiety" },
  { slug: "asrs-v1.1", domain: "adhd" },
  { slug: "isi", domain: "sleep" },
  { slug: "pc-ptsd-5", domain: "trauma" },
  { slug: "audit-c", domain: "alcohol" },
];

/** Total scored item count across the intake battery (for progress display). */
export const INTAKE_ITEM_COUNT = INSTRUMENTS.filter((i) =>
  INTAKE_BATTERY.some((b) => b.slug === i.slug),
).reduce((n, i) => n + i.questions.length, 0);

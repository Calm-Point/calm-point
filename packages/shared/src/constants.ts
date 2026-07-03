/**
 * Condition funnels — each maps to a landing page; screener is the validated
 * instrument slug, or null when the funnel goes straight to signup (a proper
 * instrument for those conditions is tracked in the build plan).
 */
export const CONDITIONS = [
  { slug: "adhd", label: "ADHD", screener: "asrs-v1.1" },
  { slug: "anxiety", label: "Anxiety", screener: "gad-7" },
  { slug: "depression", label: "Depression", screener: "phq-9" },
  { slug: "weight-loss", label: "Weight management", screener: null },
  { slug: "sleep", label: "Sleep & insomnia", screener: null },
] as const;

export type ConditionSlug = (typeof CONDITIONS)[number]["slug"];

/** Crisis resources shown by the safety interstitial and the AI Therapist crisis mode. */
export const CRISIS_RESOURCES = {
  lifeline: { label: "988 Suicide & Crisis Lifeline", phone: "988" },
  crisisText: { label: "Crisis Text Line", instruction: "Text HOME to 741741" },
  emergency: { label: "Emergency services", phone: "911" },
} as const;

/** Cancellation policy windows (hours before visit start). */
export const RESCHEDULE_WINDOW_HOURS = 24;
export const LATE_CANCEL_WINDOW_HOURS = 24;

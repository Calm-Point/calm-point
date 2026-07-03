import type { ConditionSlug } from "@calm-point/shared";

export interface ConditionContent {
  slug: ConditionSlug;
  label: string;
  headline: string;
  subhead: string;
  bullets: string[];
  faq: Array<{ q: string; a: string }>;
}

// Marketing copy — claims language must stay on the wellness/care-access side
// (docs/05 §5): no cure claims, no guaranteed prescriptions, no diagnosis.
export const CONDITION_CONTENT: ConditionContent[] = [
  {
    slug: "adhd",
    label: "ADHD",
    headline: "Focus feels impossible? Let's figure it out together.",
    subhead:
      "A licensed provider can evaluate your attention, energy, and follow-through — and build a plan that actually fits your life.",
    bullets: [
      "Clinically validated ADHD screening in ~2 minutes",
      "Video evaluation with a licensed provider",
      "Personalized plan: therapy, coaching, and medication when clinically appropriate",
      "Ongoing check-ins and messaging with your care team",
    ],
    faq: [
      {
        q: "Will I be prescribed stimulant medication?",
        a: "Treatment is always the provider's clinical decision made with you. We don't prescribe controlled substances (like stimulants) through the platform today; providers can discuss non-stimulant options and therapy-based approaches.",
      },
      {
        q: "Is the screener a diagnosis?",
        a: "No — it's a validated first step (the ASRS v1.1 screener) that helps your provider understand what you're experiencing. Only a licensed clinician can evaluate and diagnose.",
      },
      {
        q: "How fast can I see someone?",
        a: "Most new patients can book a video visit within a few days, depending on your state.",
      },
    ],
  },
  {
    slug: "anxiety",
    label: "Anxiety",
    headline: "The worry doesn't have to run the show.",
    subhead:
      "Get matched with a licensed provider who listens, and a plan to help you feel steadier — from your couch.",
    bullets: [
      "GAD-7 anxiety check-in — 2 minutes, clinically validated",
      "Video visits with licensed providers who specialize in anxiety",
      "Skills, therapy referrals, and medication when clinically appropriate",
      "Message your care team between visits",
    ],
    faq: [
      {
        q: "What happens after the questionnaire?",
        a: "You'll create an account, pick a time, and meet your provider by video. They review your answers before the visit so you don't start from zero.",
      },
      {
        q: "Do you take insurance?",
        a: "We're direct-pay at launch with transparent pricing. Insurance support is on our roadmap.",
      },
    ],
  },
  {
    slug: "depression",
    label: "Depression",
    headline: "When everything feels heavy, the first step should be light.",
    subhead:
      "A two-minute check-in, a real provider, and a plan — without waiting rooms or phone tag.",
    bullets: [
      "PHQ-9 depression check-in — the same tool clinicians use",
      "Video visits with licensed providers",
      "A plan you help shape: therapy, lifestyle, medication when appropriate",
      "Regular check-ins so progress is visible",
    ],
    faq: [
      {
        q: "Is this a replacement for therapy?",
        a: "It can include therapy, medication management, or both — your provider will recommend what fits. If you're in crisis, please use the crisis resources we surface immediately.",
      },
    ],
  },
  {
    slug: "weight-loss",
    label: "Weight management",
    headline: "Sustainable weight care, minus the shame.",
    subhead:
      "Behavioral, medical, and emotional support from licensed providers — built around your real life.",
    bullets: [
      "Whole-person evaluation with a licensed provider",
      "Behavioral program with weekly check-ins",
      "Compassionate, judgment-free care",
    ],
    faq: [
      {
        q: "Do you prescribe GLP-1 medications?",
        a: "Medication decisions are always made by your provider based on your health history. Availability varies by state and clinical appropriateness.",
      },
    ],
  },
  {
    slug: "sleep",
    label: "Sleep & insomnia",
    headline: "Tired of being tired.",
    subhead:
      "Evidence-based insomnia care (CBT-I first) from licensed providers, on your schedule.",
    bullets: [
      "Sleep evaluation with a licensed provider",
      "CBT-I-informed program — the gold standard for insomnia",
      "Check-ins that track whether sleep is actually improving",
    ],
    faq: [
      {
        q: "Will I just be given sleeping pills?",
        a: "No — first-line care for chronic insomnia is behavioral (CBT-I). Medication is a provider decision when clinically appropriate.",
      },
    ],
  },
];

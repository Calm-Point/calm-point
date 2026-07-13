import type { Metadata } from "next";
import { Wordmark } from "@/components/brand";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From a two-minute check-in to a video visit and ongoing support — here's how care works at Calm Point.",
};

const STEPS = [
  {
    title: "Take a short check-in",
    body: "Answer a clinically validated questionnaire in about two minutes. It's private, and it helps us understand what you're experiencing.",
  },
  {
    title: "Create your account",
    body: "Your answers carry over. Tell us your state so we can match you with a provider licensed where you are.",
  },
  {
    title: "Meet your provider by video",
    body: "Pick a time that works — most new patients get in within days. Your provider reviews your check-in before the visit, so you don't start from zero.",
  },
  {
    title: "Leave with a plan",
    body: "Every visit ends with a clear plan. An AI scribe drafts the notes so your provider spends the visit with you, not a keyboard.",
  },
  {
    title: "Stay supported between visits",
    body: "Message your care team, complete recurring check-ins that track your progress, and (once available) practice skills with your AI companion.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <div className="mb-12 text-center">
        <a href="/" aria-label="Calm Point home" className="inline-flex justify-center">
          <Wordmark />
        </a>
        <h1 className="mt-3 text-4xl font-medium tracking-tight">How care works</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Real clinicians, real plans — without waiting rooms or phone tag.
        </p>
      </div>

      <ol className="flex flex-col gap-5">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-lg border border-ink/5 bg-surface p-5 shadow-soft"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 text-center">
        <a
          href="/#conditions"
          className="inline-flex h-12 items-center rounded-full bg-brand px-8 text-base font-medium text-on-brand shadow-soft"
        >
          Start your check-in
        </a>
      </div>
    </main>
  );
}

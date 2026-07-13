import type { Metadata } from "next";
import { CRISIS_RESOURCES } from "@calm-point/shared";

export const metadata: Metadata = {
  title: "You deserve support right now",
  robots: { index: false },
};

// Crisis interstitial (docs/07 §3): solid surface — never glass — biggest type
// on the platform, two giant actions, zero decorative motion.
export default function CrisisPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Thank you for being honest. Let&apos;s get you real support, right now.
        </h1>
        <p className="text-lg leading-relaxed text-ink-soft">
          Some of what you shared tells us you deserve more immediate care than
          an online visit can offer today. You&apos;re not alone in this — free,
          confidential help is available 24/7 from people who are very good at
          listening.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <a
          href={`tel:${CRISIS_RESOURCES.lifeline.phone}`}
          className="flex min-h-[76px] items-center justify-between rounded-lg bg-brand px-6 py-5 text-on-brand shadow-soft transition-transform active:scale-[0.99]"
        >
          <span className="text-xl font-semibold">Call 988</span>
          <span className="text-sm opacity-90">{CRISIS_RESOURCES.lifeline.label}</span>
        </a>
        <a
          href="sms:741741&body=HOME"
          className="flex min-h-[76px] items-center justify-between rounded-lg border-2 border-brand bg-surface px-6 py-5 text-brand shadow-soft transition-transform active:scale-[0.99]"
        >
          <span className="text-xl font-semibold">Text HOME to 741741</span>
          <span className="text-sm opacity-80">{CRISIS_RESOURCES.crisisText.label}</span>
        </a>
      </div>

      <div className="rounded-lg bg-ink/5 p-5 text-base leading-relaxed">
        <p>
          If you&apos;re in immediate danger or worried you might act on these
          thoughts, please call <a className="font-semibold underline" href="tel:911">911</a>{" "}
          or go to your nearest emergency room.
        </p>
      </div>

      <p className="text-sm text-ink-soft">
        When you&apos;re through this moment, we&apos;re still here — and we&apos;d be glad
        to help you find ongoing care.
      </p>
    </main>
  );
}

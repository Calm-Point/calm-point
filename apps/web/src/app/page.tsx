import { CONDITIONS } from "@calm-point/shared";

// Placeholder home page — real marketing site lands in Phase 2.1
// (docs/04-build-plan.md). Design language: docs/07-design-system.md.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-4">
        <span className="text-sm font-medium uppercase tracking-widest text-brand">
          Calm Point
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Mental health care that meets you where you are
        </h1>
        <p className="mx-auto max-w-xl text-lg text-ink-soft">
          Licensed providers for ADHD, anxiety, depression, and more. Video
          visits, secure messaging, and real support between appointments.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {CONDITIONS.map((condition) => (
          <span
            key={condition.slug}
            className="rounded-full bg-brand-tint px-5 py-2.5 text-sm font-medium text-brand"
          >
            {condition.label}
          </span>
        ))}
      </div>

      <p className="text-sm text-ink-soft">
        In crisis? Call or text{" "}
        <a href="tel:988" className="font-semibold text-brand underline">
          988
        </a>{" "}
        — the Suicide &amp; Crisis Lifeline is available 24/7.
      </p>
    </main>
  );
}

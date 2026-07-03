import { CONDITIONS } from "@calm-point/shared";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-16 pt-24 text-center">
        <span className="text-sm font-semibold uppercase tracking-widest text-brand">
          Calm Point
        </span>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Mental health care that meets you where you are
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-ink-soft">
          Licensed providers for ADHD, anxiety, depression, and more. Video
          visits, secure messaging, and real support between appointments.
        </p>
        <div className="flex items-center gap-3">
          <a
            href="#conditions"
            className="inline-flex h-13 min-h-[52px] items-center rounded-full bg-brand px-8 text-base font-medium text-white shadow-soft transition-transform active:scale-[0.97]"
          >
            Get started
          </a>
          <a
            href="/login"
            className="inline-flex h-13 min-h-[52px] items-center rounded-full bg-brand-tint px-8 text-base font-medium text-brand"
          >
            Sign in
          </a>
        </div>
      </section>

      <section id="conditions" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight">
          What brings you here today?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CONDITIONS.map((condition) => (
            <a
              key={condition.slug}
              href={`/${condition.slug}`}
              className="rounded-lg border border-ink/5 bg-surface p-6 text-lg font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted"
            >
              {condition.label} →
            </a>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-ink-soft">
          In crisis? Call or text{" "}
          <a href="tel:988" className="font-semibold text-brand underline">
            988
          </a>{" "}
          — the Suicide &amp; Crisis Lifeline is available 24/7.
        </p>
      </section>

      <footer className="border-t border-ink/5 py-10 text-center text-xs text-ink-soft">
        <p>
          © {new Date().getFullYear()} Calm Point ·{" "}
          <a href="/legal/privacy" className="underline">Privacy</a> ·{" "}
          <a href="/legal/terms" className="underline">Terms</a> ·{" "}
          <a href="/legal/telehealth-consent" className="underline">Telehealth consent</a> ·{" "}
          <a href="/legal/hipaa-npp" className="underline">HIPAA Notice</a>
        </p>
      </footer>
    </main>
  );
}

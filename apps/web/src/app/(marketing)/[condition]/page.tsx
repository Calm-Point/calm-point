import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONDITIONS } from "@calm-point/shared";
import { Card } from "@calm-point/ui";
import { CONDITION_CONTENT } from "../content";

export function generateStaticParams() {
  return CONDITION_CONTENT.map((c) => ({ condition: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ condition: string }>;
}): Promise<Metadata> {
  const { condition } = await params;
  const content = CONDITION_CONTENT.find((c) => c.slug === condition);
  return {
    title: content ? `${content.label} care online` : "Calm Point",
    description: content?.subhead,
  };
}

export default async function ConditionLanding({
  params,
}: {
  params: Promise<{ condition: string }>;
}) {
  const { condition } = await params;
  const content = CONDITION_CONTENT.find((c) => c.slug === condition);
  if (!content) notFound();
  const config = CONDITIONS.find((c) => c.slug === content.slug);
  const ctaHref = config?.screener ? `/screener/${content.slug}` : "/signup";

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pb-16 pt-24 text-center">
        <a href="/" className="text-sm font-semibold uppercase tracking-widest text-brand">
          Calm Point
        </a>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {content.headline}
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-ink-soft">{content.subhead}</p>
        <a
          href={ctaHref}
          className="inline-flex h-13 min-h-[52px] items-center rounded-full bg-brand px-8 text-base font-medium text-white shadow-soft transition-transform active:scale-[0.97]"
        >
          {config?.screener ? "Start your free 2-minute check-in" : "Get started"}
        </a>
        <p className="text-xs text-ink-soft">
          Private and secure. Not for emergencies — in crisis, call or text{" "}
          <a href="tel:988" className="underline">988</a>.
        </p>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {content.bullets.map((bullet) => (
            <Card key={bullet} className="p-5">
              <p className="text-base leading-relaxed">{bullet}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["1. Check in", "Answer a short, clinically validated questionnaire."],
            ["2. Meet your provider", "Book a video visit — most patients get in within days."],
            ["3. Feel supported", "A plan, check-ins, and messaging with your care team."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-ink/5 bg-surface p-5 shadow-soft">
              <p className="mb-1 font-semibold">{title}</p>
              <p className="text-sm text-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Common questions</h2>
        <div className="flex flex-col gap-3">
          {content.faq.map((item) => (
            <details key={item.q} className="group rounded-lg border border-ink/5 bg-surface p-5 shadow-soft">
              <summary className="cursor-pointer list-none font-medium">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <a
            href={ctaHref}
            className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-base font-medium text-white shadow-soft"
          >
            {config?.screener ? "Start the check-in" : "Get started"}
          </a>
        </div>
      </section>

      <footer className="border-t border-ink/5 py-10 text-center text-xs text-ink-soft">
        <p>
          © {new Date().getFullYear()} Calm Point ·{" "}
          <a href="/legal/privacy" className="underline">Privacy</a> ·{" "}
          <a href="/legal/terms" className="underline">Terms</a> ·{" "}
          <a href="/legal/telehealth-consent" className="underline">Telehealth consent</a>
        </p>
      </footer>
    </main>
  );
}

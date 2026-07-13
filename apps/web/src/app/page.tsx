import { CONDITIONS } from "@calm-point/shared";
import { BotanicalBranch, LeafIcon, Wordmark } from "@/components/brand";

/* Pastel icon chips per condition — from the approved design reference. */
const CONDITION_ART: Record<string, { chip: string; icon: React.ReactNode }> = {
  adhd: {
    chip: "bg-brand-tint text-brand",
    icon: (
      <path d="M12 4a5 5 0 0 0-5 5c0 1.1.3 2 .9 2.9L7 15h2v3h5v-2h2v-3h1.5L16 9.9c.6-1.6.3-3.4-1-4.6A5 5 0 0 0 12 4zm-1.5 5.5c.8-.8 2.2-.8 3 0M10 8c.5-.5 1.2-.8 2-.8" />
    ),
  },
  anxiety: {
    chip: "bg-[#E6E1F2] text-[#7A6BA8] dark:bg-[#2C2838] dark:text-[#B4A8DC]",
    icon: (
      <path d="M12 5c1 2 3.5 3 3.5 5.5S13.5 14 12 14s-3.5-1-3.5-3.5S11 7 12 5zm-5 9c1.5 1 3 1.5 5 1.5s3.5-.5 5-1.5c-.5 2.5-2.5 4.5-5 4.5s-4.5-2-5-4.5z" />
    ),
  },
  depression: {
    chip: "bg-[#DDE8F0] text-[#5B7E99] dark:bg-[#243038] dark:text-[#9FC0D8]",
    icon: (
      <path d="M7.5 16a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 16.7 10 3.2 3.2 0 0 1 16.5 16h-9z" />
    ),
  },
  "weight-loss": {
    chip: "bg-[#F0E8CE] text-[#9A7F35] dark:bg-[#37301E] dark:text-[#D8C07C]",
    icon: (
      <path d="M6 8.5 12 5l6 3.5v7L12 19l-6-3.5v-7zM12 5v7m0 0 6-3.5M12 12 6 8.5" />
    ),
  },
  sleep: {
    chip: "bg-brand-tint text-brand",
    icon: (
      <path d="M15.5 5a6.8 6.8 0 0 0 3 9.3A7.5 7.5 0 1 1 15.5 5zM17 4l.6 1.6L19 6l-1.4.5L17 8l-.5-1.5L15 6l1.5-.4L17 4z" />
    ),
  },
};

function ConditionIcon({ slug }: { slug: string }) {
  const art = CONDITION_ART[slug] ?? CONDITION_ART.adhd!;
  return (
    <span className={`grid size-12 place-items-center rounded-2xl ${art.chip}`}>
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {art.icon}
      </svg>
    </span>
  );
}

function Chevron({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none">
      <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-x-clip">
      <section className="relative mx-auto max-w-3xl px-6 pb-14 pt-12">
        <BotanicalBranch className="absolute -right-8 -top-2 h-64 w-56 opacity-70 sm:-right-2" />

        <div className="relative flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-5 text-sm font-medium text-ink-soft">
            <a href="/how-it-works" className="hidden whitespace-nowrap hover:text-ink sm:inline">How it works</a>
            <a href="/pricing" className="hidden hover:text-ink sm:inline">Pricing</a>
            <a href="/login" className="whitespace-nowrap text-brand hover:underline">Sign in</a>
          </nav>
        </div>

        <h1 className="relative mt-12 max-w-xl text-[2.75rem] font-medium leading-[1.08] tracking-tight sm:text-6xl">
          Mental health care that meets <em>you</em> where you are.
        </h1>
        <p className="relative mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
          Licensed care for ADHD, anxiety, depression, and more—designed
          around you.
        </p>

        <div className="relative mt-10 flex max-w-xl flex-col gap-3">
          <a
            href="#conditions"
            className="flex h-14 items-center justify-between rounded-lg bg-brand px-6 text-base font-semibold text-on-brand shadow-soft transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <LeafIcon className="size-6 text-on-brand/90" />
              Get started
            </span>
            <Chevron className="size-5 text-on-brand/80" />
          </a>
          <a
            href="/signup"
            className="flex h-14 items-center justify-between rounded-lg border border-ink/5 bg-surface px-6 text-base font-medium text-ink shadow-soft transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" aria-hidden className="size-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <rect x="4" y="5.5" width="16" height="15" rx="3" />
                <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M9.5 14.5l2 2 3.5-3.5" />
              </svg>
              Book a free consultation
            </span>
            <Chevron className="size-5 text-ink-soft" />
          </a>
        </div>
      </section>

      <section id="conditions" className="mx-auto max-w-3xl px-6 pb-10">
        <h2 className="mb-5 text-xl font-medium tracking-tight">Care for what matters</h2>
        <div className="grid grid-cols-6 gap-4">
          {CONDITIONS.map((condition, i) => (
            <a
              key={condition.slug}
              href={`/${condition.slug}`}
              className={`${i < 3 ? "col-span-2 flex-col items-start gap-4 p-3.5 sm:p-5" : "col-span-6 sm:col-span-3 items-center gap-4 p-5"} flex rounded-lg border border-ink/5 bg-surface shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted`}
            >
              <ConditionIcon slug={condition.slug} />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 self-stretch">
                <span className={`${i < 3 ? "text-[13px] sm:text-base" : ""} font-medium leading-snug`}>
                  {condition.label}
                </span>
                <Chevron className="size-4 flex-none text-ink-soft" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-brand-tint/70 p-5">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" aria-hidden className="size-8 flex-none text-brand" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-4.5" />
            </svg>
            <p className="max-w-[16rem] text-sm leading-snug text-ink">
              Licensed providers. Evidence-based care. HIPAA-compliant.
              You&apos;re in good hands.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex -space-x-2.5" aria-hidden>
              <span className="grid size-9 place-items-center rounded-full bg-brand text-xs font-semibold text-on-brand ring-2 ring-surface">PR</span>
              <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-white ring-2 ring-surface">SC</span>
              <span className="grid size-9 place-items-center rounded-full bg-[#7A6BA8] text-xs font-semibold text-white ring-2 ring-surface">EM</span>
            </span>
            <span className="rounded-full bg-surface px-3 py-2 text-center shadow-soft">
              <span className="block text-sm font-bold leading-none text-brand">1K+</span>
              <span className="block text-[10px] leading-tight text-ink-soft">lives<br />supported</span>
            </span>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-ink-soft">
          In crisis? Call or text{" "}
          <a href="tel:988" className="font-semibold text-brand underline">988</a>{" "}
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

import { cn } from "@calm-point/ui";

/**
 * Brand marks from the approved design reference: a circle-enclosed sprout
 * leaf, the letterspaced wordmark, and a soft botanical branch used as a
 * decorative flourish behind hero headings.
 */

/** Bare leaf (no enclosing circle) — for buttons and small chips. */
export function LeafIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.5 4.5c.9 6.6-2.2 10.9-8.3 11.6-.6-6.3 2.3-10.6 8.3-11.6z" />
      <path
        d="M10.6 16c-2.5 1-4 2.4-4.6 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("text-brand", className)}>
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2.75" />
      {/* leaf blade */}
      <path
        d="M35 9.5c1.6 10.2-3.2 16.9-12.6 18-1-9.7 3.5-16.4 12.6-18z"
        fill="currentColor"
      />
      {/* stem sweeping toward the lower left */}
      <path
        d="M23.5 27c-4.9 1.9-8 5-9.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LeafMark className={cn("size-8 flex-none", markClassName)} />
      <span className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.25em] text-ink">
        Calm Point
      </span>
    </span>
  );
}

/** Watercolor-soft eucalyptus branch — position absolutely behind hero copy. */
export function BotanicalBranch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 260"
      aria-hidden
      className={cn("pointer-events-none text-brand", className)}
    >
      <g fill="currentColor" stroke="none">
        <path d="M150 250C130 180 120 110 150 30" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
        <path d="M148 210c-32-4-50-20-56-46 30 2 50 18 56 46z" opacity="0.30" />
        <path d="M142 156c-30-8-44-26-46-52 28 6 44 24 46 52z" opacity="0.38" />
        <path d="M141 104c-24-12-34-30-32-56 24 10 34 30 32 56z" opacity="0.30" />
        <path d="M150 196c28-8 42-24 46-50-28 4-44 22-46 50z" opacity="0.42" />
        <path d="M148 140c26-12 36-30 36-56-26 8-38 28-36 56z" opacity="0.32" />
        <path d="M150 86c20-14 28-32 24-58-22 12-30 32-24 58z" opacity="0.40" />
      </g>
    </svg>
  );
}

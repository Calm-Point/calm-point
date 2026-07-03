import * as React from "react";
import { cn } from "./cn";

/**
 * Chrome material — blur + saturation + hairline border (docs/07 §3).
 * Solid-surface fallback applies automatically where backdrop-filter is
 * unsupported via the supports- variant.
 */
export function GlassPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ink/5 bg-surface shadow-soft",
        "supports-[backdrop-filter]:bg-surface/60 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150",
        className,
      )}
      {...props}
    />
  );
}

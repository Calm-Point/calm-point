import * as React from "react";
import { cn } from "./cn";

const tones = {
  brand: "bg-brand-tint text-brand",
  neutral: "bg-ink/5 text-ink-soft",
  positive: "bg-positive/10 text-positive",
  warn: "bg-warn/10 text-warn",
  danger: "bg-danger/10 text-danger",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

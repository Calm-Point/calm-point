import * as React from "react";
import { cn } from "./cn";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  showLabel?: boolean;
  className?: string;
}

/** Continuous progress track — docs/07 `progress` motion token (spring width, crossfade fallback). */
export function ProgressBar({ value, max = 100, label, showLabel = false, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel ? <p className="text-sm text-ink-soft">{label}</p> : null}
      <div
        role="progressbar"
        aria-label={showLabel ? undefined : label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-spring"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

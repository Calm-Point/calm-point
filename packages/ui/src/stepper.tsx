import * as React from "react";
import { cn } from "./cn";

export interface StepperProps {
  steps: string[];
  current: number;
  className?: string;
}

/** Discrete step indicator for multi-screen flows (signup, verify, checkout). */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "grid size-7 flex-none place-items-center rounded-full text-xs font-semibold transition-colors",
                done ? "bg-brand text-white" : active ? "bg-brand-tint text-brand" : "bg-ink/5 text-ink-soft",
              )}
            >
              {done ? (
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
                  <path
                    d="M3.5 8.5l3 3 6-6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className={cn("hidden text-sm font-medium sm:inline", active ? "text-ink" : "text-ink-soft")}>
              {label}
            </span>
            {i < steps.length - 1 ? <span aria-hidden className="h-px flex-1 bg-ink/10" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

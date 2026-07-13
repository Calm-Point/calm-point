"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  side?: "bottom" | "right";
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Glass sheet — slides up (mobile-style bottom sheet) or in from the right
 * (desktop panel). Traps focus, closes on Escape/backdrop, restores focus to
 * the trigger on close. Motion respects prefers-reduced-motion via the
 * `motion-reduce:` variant (crossfade instead of slide) — docs/07 §1.5.
 */
export function Sheet({ open, onClose, title, description, side = "bottom", children, footer }: SheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const lastFocused = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();
  // Same hydration-safety concern as ToastProvider — defer portal rendering
  // until after mount so an `open`-on-first-render caller doesn't mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const toFocus = panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    toFocus?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 motion-reduce:animate-none motion-safe:animate-fade-in"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col bg-surface shadow-lifted outline-none",
          "border border-ink/5 supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl motion-safe:animate-slide-up motion-reduce:animate-fade-in"
            : "inset-y-0 right-0 w-full max-w-md motion-safe:animate-slide-in-right motion-reduce:animate-fade-in",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/5 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 flex-none place-items-center rounded-full text-ink-soft hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-4">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-ink/5 px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

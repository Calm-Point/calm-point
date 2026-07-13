"use client";

import { useState } from "react";
import { Sheet } from "@calm-point/ui";

/** Small-screen nav — PortalShell hides its nav links below `sm`, so this is the only way to switch sections on mobile. */
export function MobileNav({ nav }: { nav: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:hidden"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-5">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="right">
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </Sheet>
    </>
  );
}

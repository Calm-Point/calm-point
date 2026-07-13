"use client";

import * as React from "react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: Size;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Photo avatar with initials fallback — decorative image, name carries the a11y label via alt/aria on the initials span. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImage = src && !errored;
  return (
    <span
      className={cn(
        "relative inline-grid flex-none place-items-center overflow-hidden rounded-full bg-brand-tint font-semibold text-brand",
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          onError={() => setErrored(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-label={name}>{initials(name)}</span>
      )}
    </span>
  );
}

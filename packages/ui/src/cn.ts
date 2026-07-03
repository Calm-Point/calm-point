/** Tiny class-joiner — swap for tailwind-merge if class conflicts ever bite. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

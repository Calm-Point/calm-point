import type { Config } from "tailwindcss";

// "Calm Glass" design tokens — docs/07-design-system.md.
// Consumed by apps via `presets: [calmGlassPreset]`; CSS variables are defined
// in each app's global stylesheet (web: apps/web/src/app/globals.css).
export const calmGlassPreset: Omit<Config, "content"> = {
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--cp-bg) / <alpha-value>)",
        surface: "rgb(var(--cp-surface) / <alpha-value>)",
        ink: "rgb(var(--cp-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--cp-ink-soft) / <alpha-value>)",
        brand: "rgb(var(--cp-brand) / <alpha-value>)",
        "brand-tint": "rgb(var(--cp-brand-tint) / <alpha-value>)",
        "on-brand": "rgb(var(--cp-on-brand) / <alpha-value>)",
        accent: "rgb(var(--cp-accent) / <alpha-value>)",
        positive: "rgb(var(--cp-positive) / <alpha-value>)",
        warn: "rgb(var(--cp-warn) / <alpha-value>)",
        danger: "rgb(var(--cp-danger) / <alpha-value>)",
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)",
        lifted: "0 2px 4px rgb(0 0 0 / 0.05), 0 16px 40px rgb(0 0 0 / 0.10)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      fontFamily: {
        // Serif display face for headings (brand reference). Apps provide
        // --font-display (web: Fraunces via next/font); Georgia is the fallback.
        display: ["var(--font-display, Georgia)", "Georgia", "serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "toast-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 320ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-in-right": "slide-in-right 320ms cubic-bezier(0.32, 0.72, 0, 1)",
        "toast-in": "toast-in 320ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
};

export default calmGlassPreset;

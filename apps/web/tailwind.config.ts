import type { Config } from "tailwindcss";

// "Calm Glass" tokens — see docs/07-design-system.md. This will move to a
// shared preset in packages/ui during Phase 1.3.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
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
        accent: "rgb(var(--cp-accent) / <alpha-value>)",
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
    },
  },
  plugins: [],
};

export default config;

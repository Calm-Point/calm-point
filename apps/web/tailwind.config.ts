import type { Config } from "tailwindcss";
import { calmGlassPreset } from "@calm-point/ui/tailwind-preset";

const config: Config = {
  presets: [calmGlassPreset as Config],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};

export default config;

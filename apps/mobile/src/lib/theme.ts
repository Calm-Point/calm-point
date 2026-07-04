import { useColorScheme } from "react-native";

/** "Calm Glass" tokens — mirrors packages/ui/tailwind-preset (docs/07 §2). */
export const palette = {
  light: {
    bg: "#F7F6F3",
    surface: "#FFFFFF",
    ink: "#1C1E26",
    inkSoft: "#5A5E6B",
    brand: "#3E6B5C",
    brandTint: "#E8F0EC",
    accent: "#C58A5A",
    positive: "#3D8168",
    warn: "#B98A2F",
    danger: "#B4483E",
    hairline: "rgba(28,30,38,0.06)",
  },
  dark: {
    bg: "#0F1115",
    surface: "#171A21",
    ink: "#F2F1EC",
    inkSoft: "#9BA0AD",
    brand: "#7FB8A4",
    brandTint: "#1E2B27",
    accent: "#D9A87C",
    positive: "#6FB39A",
    warn: "#D6AC5E",
    danger: "#E07A70",
    hairline: "rgba(242,241,236,0.08)",
  },
} as const;

export type Palette = Record<keyof (typeof palette)["light"], string>;

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const spacing = (n: number) => n * 4;

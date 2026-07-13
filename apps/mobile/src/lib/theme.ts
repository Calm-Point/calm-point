import { useColorScheme } from "react-native";

/** "Calm Glass" tokens — mirrors packages/ui/tailwind-preset (docs/07 §2),
 * tuned to the approved design reference: cream paper, forest ink, sage brand. */
export const palette = {
  light: {
    bg: "#F3EFE6",
    surface: "#FBF9F4",
    ink: "#1F3327",
    inkSoft: "#5C635A",
    brand: "#4A6B55",
    brandTint: "#E4EAD8",
    onBrand: "#FFFFFF",
    accent: "#C58A5A",
    positive: "#3D8168",
    warn: "#B0822C",
    danger: "#B4483E",
    hairline: "rgba(31,51,39,0.06)",
  },
  dark: {
    bg: "#121612",
    surface: "#1A1F1A",
    ink: "#ECEEE5",
    inkSoft: "#9CA598",
    brand: "#8AB595",
    brandTint: "#222D24",
    onBrand: "#121612",
    accent: "#D9A87C",
    positive: "#6FB39A",
    warn: "#D6AC5E",
    danger: "#E07A70",
    hairline: "rgba(236,238,229,0.08)",
  },
} as const;

export type Palette = Record<keyof (typeof palette)["light"], string>;

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const spacing = (n: number) => n * 4;

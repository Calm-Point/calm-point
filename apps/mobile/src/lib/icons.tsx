import Svg, { Path, Rect, Circle } from "react-native-svg";

/**
 * Shared icon set — mirrors the path data used in the web app's icon system
 * (apps/web/public/demo/app.html) so mobile and web read as one product.
 * react-native-svg renders identically on iOS, Android, and web (react-native-web),
 * unlike expo-symbols (iOS-only) or emoji (inconsistent across platforms).
 */

const PATHS: Record<string, string> = {
  home: "M3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 21v-7h6v7",
  calendar: "M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4",
  message: "M20 15.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z",
  spark: "M12 3c.5 3.5 2 5 5.5 5.5C14 9 12.5 10.5 12 14c-.5-3.5-2-5-5.5-5.5C10 8 11.5 6.5 12 3ZM19 13c.2 1.5.8 2.1 2.3 2.3-1.5.2-2.1.8-2.3 2.3-.2-1.5-.8-2.1-2.3-2.3 1.5-.2 2.1-.8 2.3-2.3Z",
  care: "M20.5 8.6A5.2 5.2 0 0 0 12 6.5 5.2 5.2 0 0 0 3.5 8.6c0 2.2 1.5 3.9 3 5.3l5.5 5.2 5.5-5.2c1.5-1.4 3-3.1 3-5.3ZM3.8 12H9l1-2 2 4 1.5-3 1 1h5.7",
  mic: "M12 18v4",
  cam: "m22 8-5 4 5 4z",
  check: "M20 6 9 17l-5-5",
  chev: "m9 18 6-6-6-6",
  clock: "M12 7v5l3 2",
  lock: "M8 10V7a4 4 0 0 1 8 0v3",
  shield: "M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9.5 12l1.8 1.8 3.5-3.6",
  card: "M2 10h20",
};

const RECTS: Record<string, { x: number; y: number; width: number; height: number; rx: number } | null> = {
  card: { x: 2, y: 5, width: 20, height: 14, rx: 2.5 },
  calendar: { x: 3, y: 4, width: 18, height: 18, rx: 2.5 },
  mic: { x: 9, y: 2, width: 6, height: 12, rx: 3 },
  cam: { x: 2, y: 6, width: 14, height: 12, rx: 2.5 },
  lock: { x: 4, y: 10, width: 16, height: 11, rx: 2.5 },
};

const CIRCLES: Record<string, { cx: number; cy: number; r: number } | null> = {
  clock: { cx: 12, cy: 12, r: 9 },
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  color = "currentColor",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const rect = RECTS[name];
  const circle = CIRCLES[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {rect ? <Rect {...rect} stroke={color} strokeWidth={1.8} /> : null}
      {circle ? <Circle {...circle} stroke={color} strokeWidth={1.8} /> : null}
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

import { useEffect } from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { GlassView } from "expo-glass-effect";
import { radius, spacing, useTheme } from "@/lib/theme";

/** "Calm Glass" spring — mirrors the web design system's cubic-bezier(.32,.72,0,1). */
const SPRING = { damping: 18, stiffness: 180, mass: 0.9 };

/**
 * Elevated surface with real "liquid glass" translucency where the platform
 * supports it (iOS 26+ via expo-glass-effect's GlassView), and a themed opaque
 * card everywhere else (Android, web, older iOS) — never a broken blur.
 * Every card animates in with a spring on mount (docs/07 §motion).
 */
export function GlassCard({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const t = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING));
  }, [progress, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  const canUseGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  const base = {
    borderRadius: radius.lg,
    padding: spacing(5),
    borderWidth: 1,
    borderColor: t.hairline,
  };

  if (canUseGlass) {
    return (
      <Animated.View style={[{ borderRadius: radius.lg }, animatedStyle, style]}>
        <GlassView glassEffectStyle="regular" style={[base, { overflow: "hidden" }]}>
          {children}
        </GlassView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, style]}>
      <View style={[base, { backgroundColor: t.surface }]}>{children}</View>
    </Animated.View>
  );
}

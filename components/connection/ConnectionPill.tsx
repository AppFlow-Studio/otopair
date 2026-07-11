/**
 * ConnectionPill — floating glass status pill. Presentational only; the host
 * (ConnectionPillHost) decides which variant to show and when.
 */
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { BrandColors, SemanticColors } from "@/constants/theme";

export type PillVariant = "reconnecting" | "offline" | "recovering";

interface ConnectionPillProps {
  variant: PillVariant;
  /** Only used by the `offline` variant's Retry action. */
  onRetry?: () => void;
}

const DOT_COLOR: Record<PillVariant, string> = {
  reconnecting: SemanticColors.warningAmber, // #D97706
  offline: SemanticColors.errorRed, // #DC2626
  recovering: SemanticColors.successGreen, // #059669
};

const LABEL: Record<PillVariant, string> = {
  reconnecting: "Reconnecting…",
  offline: "No connection",
  recovering: "Back online",
};

function PulsingDot({ color, pulse }: { color: string; pulse: boolean }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (pulse) {
      opacity.value = withRepeat(
        withTiming(0.35, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = 1;
    }
  }, [pulse, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function ConnectionPill({ variant, onRetry }: ConnectionPillProps) {
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(15).stiffness(250)}
      exiting={FadeOutUp.duration(200)}
      style={styles.wrapper}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {/* Solid fallback fill sits under the blur so text stays legible where
            backdrop blur is unsupported. */}
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
        {/* Specular top-edge sheen. */}
        <View style={styles.sheen} pointerEvents="none" />
        <View style={styles.row}>
          <PulsingDot color={DOT_COLOR[variant]} pulse={variant === "reconnecting"} />
          <Text size="sm" weight="semiBold" color={BrandColors.primary}>
            {LABEL[variant]}
          </Text>
          {variant === "offline" && onRetry ? (
            <>
              <View style={styles.hairline} />
              <Pressable onPress={onRetry} hitSlop={8}>
                <Text size="sm" weight="bold" color={SemanticColors.primaryBlueDark}>
                  Retry
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", width: "100%" },
  pill: {
    flexDirection: "row",
    borderRadius: 9999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.92)", // fallback fill
    shadowColor: "#141C24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hairline: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(20,28,36,0.14)",
    marginHorizontal: 2,
  },
});

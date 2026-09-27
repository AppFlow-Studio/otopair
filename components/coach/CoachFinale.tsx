/**
 * CoachFinale — the end of the tour, as a screen rather than a tooltip.
 *
 * The closing beat used to be another coach-mark bubble pointing at nothing,
 * which read as the tour running out rather than finishing. A driver who has
 * just been walked through four screens has earned a moment, and the moment is
 * also where the one action we want from them lives.
 *
 * So: full bleed, a badge that springs in with two rings expanding out of it,
 * copy that arrives just behind, and the real first task as the primary
 * button. Reduced motion gets the same screen with everything already in
 * place — the sequence is decoration, the content is not.
 */

import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FontFamily } from "@/constants/theme";
import { OtoEasing, SpringConfig } from "@/constants/animations";
import { useReducedMotion } from "@/lib/accessibility";
import { haptics } from "@/lib/haptics";

const INK = "#141C24";
const ACCENT = "#5299FE";
const MUTED = "#5A6675";

interface CoachFinaleProps {
  onPrimary: () => void;
  onDismiss: () => void;
}

export function CoachFinale({ onPrimary, onDismiss }: CoachFinaleProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const badge = useSharedValue(reduceMotion ? 1 : 0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const copy = useSharedValue(reduceMotion ? 1 : 0);
  const cta = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    // The success haptic is the point of the beat — it is the only place in
    // the tour that congratulates rather than instructs.
    haptics.success();
    if (reduceMotion) return;
    badge.value = withSpring(1, SpringConfig.bouncy);
    copy.value = withDelay(140, withTiming(1, { duration: 340, easing: OtoEasing.enter }));
    cta.value = withDelay(260, withTiming(1, { duration: 340, easing: OtoEasing.enter }));
    ring1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: OtoEasing.standard }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    ring2.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: OtoEasing.standard }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [reduceMotion, badge, copy, cta, ring1, ring2]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + badge.value * 0.4 }],
    opacity: badge.value,
  }));
  // Written out twice rather than through a helper: a factory that calls
  // useAnimatedStyle is a hook in everything but name, and the rules-of-hooks
  // lint is right to reject it.
  const r1 = useAnimatedStyle(() => ({
    opacity: (1 - ring1.value) * 0.35,
    transform: [{ scale: 1 + ring1.value * 1.25 }],
  }));
  const r2 = useAnimatedStyle(() => ({
    opacity: (1 - ring2.value) * 0.35,
    transform: [{ scale: 1 + ring2.value * 1.25 }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copy.value,
    transform: [{ translateY: (1 - copy.value) * 14 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: cta.value,
    transform: [{ translateY: (1 - cta.value) * 14 }],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.badgeWrap}>
          <Animated.View style={[styles.ring, r1]} pointerEvents="none" />
          <Animated.View style={[styles.ring, r2]} pointerEvents="none" />
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Check size={44} color="#FFFFFF" strokeWidth={3.5} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Text style={styles.headline}>You&rsquo;re all set</Text>
          <Text style={styles.body}>
            That&rsquo;s Otopair. Add your car and it starts tracking what the car needs
            straight away — about a minute&rsquo;s work.
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.footer, ctaStyle, { paddingBottom: insets.bottom + 18 }]}
      >
        <Pressable
          onPress={() => {
            haptics.cta();
            onPrimary();
          }}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Add my car</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button">
          <Text style={styles.secondary}>I&rsquo;ll do it later</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#EFF4FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  badgeWrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  badge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  copy: { alignItems: "center", marginTop: 34 },
  headline: {
    fontFamily: FontFamily.extraBold,
    fontSize: 30,
    // Explicit, and generous. Urbanist ExtraBold at 30 overshoots the default
    // line box and the ascenders were being clipped flat.
    lineHeight: 40,
    paddingTop: 2,
    color: INK,
    textAlign: "center",
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: "center",
    marginTop: 12,
  },
  footer: { paddingHorizontal: 40, gap: 16, alignItems: "center" },
  primary: {
    alignSelf: "stretch",
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryPressed: { opacity: 0.9 },
  primaryText: { fontFamily: FontFamily.semiBold, fontSize: 17, color: "#FFFFFF" },
  secondary: { fontFamily: FontFamily.medium, fontSize: 15, color: MUTED },
});

export default CoachFinale;

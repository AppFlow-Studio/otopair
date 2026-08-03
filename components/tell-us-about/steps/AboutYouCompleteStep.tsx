/**
 * AboutYouCompleteStep
 *
 * Completion payoff for the "About You" (tell-us-about) questionnaire.
 * Reuses the completion aesthetic of the Create Account carousel
 * (AnalyzingScreen's complete phase — same gradient, pin, cascade) but
 * WITHOUT the loading/carousel phase, and with lighter, personalization
 * flavored copy. This is deliberately a *different, lighter* beat than
 * the entry carousel: entry = "you're in", About You = "we get you now".
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx (the `complete` step)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Text, FontFamily, FontSize, Spacing } from "@/components/shared-ui";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { haptics } from "@/lib/haptics";

interface Props {
  onDone: () => void;
}

// Palette + stops copied verbatim from AnalyzingScreen so the two
// completion moments read as one continuous brand language.
const BLUE_GRADIENT: readonly [string, string, ...string[]] = [
  "#1A3A5C", "#204B78", "#2E6AAE", "#5299FE", "#6DACFE",
  "#8ABFFE", "#A6D0FE", "#C2E0FE", "#D9ECFE", "#E8F3FE",
  "#F2F8FF", "#F9FCFF", "#FFFFFF",
];
const GRADIENT_LOCATIONS: readonly [number, number, ...number[]] = [
  0, 0.12, 0.24, 0.36, 0.46, 0.55, 0.63, 0.71, 0.78, 0.84, 0.90, 0.95, 1,
];
const CTA_GRADIENT: [string, string, string] = ["#6DACFE", "#5299FE", "#3A7FE0"];

// Subtitle keyed to the car-knowledge level they picked on the very
// first question — so the payoff reflects what they just told us.
function resolveSubline(level: 1 | 2 | 3 | null | undefined): string {
  switch (level) {
    case 1:
      return "We'll make car stuff make sense.";
    case 2:
      return "We'll meet you where you're at.";
    case 3:
      return "We'll get straight to the details.";
    default:
      return "We've tailored Otopair to how you like things.";
  }
}

export function AboutYouCompleteStep({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);

  const firstName = data.firstName?.split(" ")[0]?.trim() || null;
  const heading = firstName ? `Perfect, ${firstName}` : "Perfect";
  const subline = resolveSubline(data.carKnowledgeLevel);

  // Pin bob + cascade-in of copy/CTA. Start hidden; fire on mount.
  const pinBob = useSharedValue(0);
  const pinOp = useSharedValue(0);
  const pinScale = useSharedValue(0.92);
  const titleY = useSharedValue(10);
  const titleOp = useSharedValue(0);
  const subY = useSharedValue(10);
  const subOp = useSharedValue(0);
  const ctaY = useSharedValue(20);
  const ctaOp = useSharedValue(0);
  const ctaScale = useSharedValue(1);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    haptics.success();

    pinOp.value = withTiming(1, { duration: 420 });
    pinScale.value = withSpring(1, { damping: 12, stiffness: 140 });
    pinBob.value = withDelay(
      420,
      withRepeat(
        withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    titleOp.value = withDelay(160, withTiming(1, { duration: 450 }));
    titleY.value = withDelay(
      160,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    subOp.value = withDelay(280, withTiming(1, { duration: 450 }));
    subY.value = withDelay(
      280,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    ctaOp.value = withDelay(460, withTiming(1, { duration: 450 }));
    ctaY.value = withDelay(
      460,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinStyle = useAnimatedStyle(() => ({
    opacity: pinOp.value,
    transform: [{ translateY: pinBob.value }, { scale: pinScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({
    opacity: subOp.value,
    transform: [{ translateY: subY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOp.value,
    transform: [{ translateY: ctaY.value }, { scale: ctaScale.value }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={BLUE_GRADIENT}
        locations={GRADIENT_LOCATIONS}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView intensity={40} tint="default" style={StyleSheet.absoluteFill} />

      {/* Top mist — matches the entry carousel's atmosphere. */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(255,255,255,0.16)",
          "rgba(255,255,255,0)",
        ]}
        locations={[0, 0.55, 1]}
        style={styles.topMist}
        pointerEvents="none"
      />

      <View style={styles.pinBlock} pointerEvents="none">
        <Animated.View style={pinStyle}>
          <Image
            source={require("@/assets/images/pin-logo-3d.png")}
            style={styles.pin}
            contentFit="contain"
            accessibilityLabel="Otopair"
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.copyBlock, titleStyle]}>
        <Text weight="extraBold" style={styles.title}>
          {heading}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.subBlock, subStyle]}>
        <Text weight="bold" style={styles.subText}>
          {subline}
        </Text>
      </Animated.View>

      {/* Soft bottom fade behind the CTA — no hard cutoff. */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(255,255,255,0.25)",
          "rgba(255,255,255,0.55)",
        ]}
        locations={[0, 0.55, 1]}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      <Animated.View
        style={[styles.ctaWrap, { paddingBottom: insets.bottom + Spacing.lg }, ctaStyle]}
      >
        <Pressable
          onPress={() => onDoneRef.current()}
          onPressIn={() => {
            ctaScale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
          }}
          onPressOut={() => {
            ctaScale.value = withSpring(1, { damping: 20, stiffness: 300 });
          }}
        >
          <View style={styles.ctaShadow}>
            <LinearGradient
              colors={CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaInner}
            >
              <Text weight="bold" style={styles.ctaText}>
                Done
              </Text>
            </LinearGradient>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A3A5C",
  },
  pinBlock: {
    position: "absolute",
    top: "28%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: { width: 180, height: 180 },

  topMist: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "28%",
  },

  copyBlock: {
    position: "absolute",
    top: "54%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  title: {
    fontSize: 38,
    lineHeight: 46,
    color: "#1A3A5C",
    textAlign: "center",
    letterSpacing: -0.6,
    paddingVertical: 4,
    maxWidth: 340,
  },
  subBlock: {
    position: "absolute",
    top: "66%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  subText: {
    fontSize: FontSize.lg,
    color: "rgba(26,58,92,0.75)",
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 340,
  },

  ctaWrap: {
    position: "absolute",
    left: Spacing["2xl"],
    right: Spacing["2xl"],
    bottom: 0,
  },
  ctaShadow: {
    borderRadius: 32,
    shadowColor: "#0A2545",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaInner: {
    borderRadius: 32,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: FontSize.lg,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

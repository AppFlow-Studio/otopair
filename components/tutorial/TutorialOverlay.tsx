/**
 * TutorialOverlay — the first-run tour.
 *
 * ONE INDEX AND ONE PROGRESS VALUE, not a navigator. The phone and the copy
 * are the only things that move, and routing per step would fight the swipe:
 * a drag has to be able to SCRUB the transition, which means the same value
 * the Next button animates must be the one the gesture writes to. A stack
 * would replay a canned animation on release instead.
 *
 * The phone leads the copy by 60ms so the eye lands on the new sentence just
 * after the new crop is already sitting there. Reversed, the copy changes
 * under a stale image and the step reads as a glitch.
 *
 * DESIGN + MOTION SPEC: Figma `kI9Em7mHSzkgAwDCtCNJYi` → T0…T5 · Tutorial and
 * the "Tutorial — Interaction Notes" board beside them.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpringConfig } from "@/constants/animations";
import { BrandColors, FontFamily } from "@/constants/theme";
import { PhoneMock } from "./PhoneMock";
import { BookingsCrop } from "./crops/BookingsCrop";
import { CarsCrop } from "./crops/CarsCrop";
import { HomeCrop } from "./crops/HomeCrop";
import { OtoCrop } from "./crops/OtoCrop";
import {
  COUNTED_STEP_COUNT,
  TUTORIAL_STEPS,
  countedIndexOf,
  isLastStep,
  progressLabel,
  type TutorialCrop,
} from "./steps";

const INK = BrandColors.primary;
const ACCENT = BrandColors.secondary;
const MUTED = "#5A6675";
const DIM = "#D0D7E1";

const { width: SCREEN_W } = Dimensions.get("window");
/** Past this fraction of the width, a release commits instead of springing
 *  back. Below it the gesture reads as a peek rather than an intent. */
const COMMIT_FRACTION = 0.35;

const PHONE_OUT = 180;
const PHONE_IN = 260;
const COPY_LAG = 60;

interface TutorialOverlayProps {
  visible: boolean;
  /** Fired on completion, skip, or hardware back — all three mean "done", so
   *  the caller stamps the seen flag once for all of them. */
  onDismiss: (reason: "completed" | "skipped") => void;
  /** Completion only. Lets the tour hand straight to add-vehicle rather than
   *  closing to Home and making the driver find it. */
  onAddCar: () => void;
}

function Crop({
  crop,
  play,
  reduceMotion,
}: {
  crop: TutorialCrop;
  play: boolean;
  reduceMotion: boolean;
}) {
  switch (crop) {
    case "home":
      return <HomeCrop play={play} reduceMotion={reduceMotion} />;
    case "cars":
      return <CarsCrop play={play} reduceMotion={reduceMotion} />;
    case "bookings":
      return <BookingsCrop play={play} reduceMotion={reduceMotion} />;
    case "oto":
      return <OtoCrop play={play} reduceMotion={reduceMotion} />;
  }
}

export function TutorialOverlay({ visible, onDismiss, onAddCar }: TutorialOverlayProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  /** Gates the in-crop beats. Held false during a transition so a step's
   *  animation starts when it ARRIVES, not while it is still sliding in. */
  const [beatsPlaying, setBeatsPlaying] = useState(false);

  const phone = useSharedValue(1);
  const copy = useSharedValue(1);
  const drag = useSharedValue(0);
  const busy = useRef(false);

  const step = TUTORIAL_STEPS[index];

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Announce each step so a screen-reader user gets the same "where am I"
  // signal the dots give everyone else.
  useEffect(() => {
    if (!visible) return;
    const label = progressLabel(index);
    AccessibilityInfo.announceForAccessibility(
      label ? `${step.headline}. ${label}` : step.headline,
    );
  }, [visible, index, step.headline]);

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      setBeatsPlaying(false);
      phone.value = 1;
      copy.value = 1;
      return;
    }
    // Let the modal's own fade settle before the first crop starts moving.
    const t = setTimeout(() => setBeatsPlaying(true), 260);
    return () => clearTimeout(t);
  }, [visible, phone, copy]);

  const settle = useCallback((next: number) => {
    setIndex(next);
    setBeatsPlaying(true);
    busy.current = false;
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = index + dir;
      if (next < 0 || next >= TUTORIAL_STEPS.length || busy.current) return;
      busy.current = true;
      setBeatsPlaying(false);

      if (reduceMotion) {
        // No translate, no scale, no springs — a crossfade and nothing else.
        phone.value = withTiming(0, { duration: 100 }, () => {
          runOnJS(settle)(next);
          phone.value = withTiming(1, { duration: 100 });
        });
        copy.value = withTiming(0, { duration: 100 }, () => {
          copy.value = withTiming(1, { duration: 100 });
        });
        return;
      }

      const ease = Easing.bezier(0.16, 1, 0.3, 1);
      phone.value = withTiming(0, { duration: PHONE_OUT, easing: ease }, () => {
        runOnJS(settle)(next);
        phone.value = withTiming(1, { duration: PHONE_IN, easing: ease });
      });
      copy.value = withTiming(0, { duration: PHONE_OUT - 40, easing: ease }, () => {
        copy.value = withTiming(1, {
          duration: PHONE_IN - COPY_LAG,
          easing: ease,
        });
      });
    },
    [index, reduceMotion, phone, copy, settle],
  );

  const finish = useCallback(
    (reason: "completed" | "skipped") => {
      onDismiss(reason);
    },
    [onDismiss],
  );

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index === 0) {
        finish("skipped");
        return true;
      }
      go(-1);
      return true;
    });
    return () => sub.remove();
  }, [visible, index, go, finish]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-14, 14])
        .onUpdate((e) => {
          drag.value = e.translationX;
        })
        .onEnd((e) => {
          const past = Math.abs(e.translationX) > SCREEN_W * COMMIT_FRACTION;
          const dir = e.translationX < 0 ? 1 : -1;
          drag.value = withSpring(0, SpringConfig.snappy);
          if (past) runOnJS(go)(dir as 1 | -1);
        }),
    [drag, go],
  );

  const phoneStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: phone.value };
    return {
      opacity: phone.value,
      transform: [
        { translateX: drag.value * 0.35 + (1 - phone.value) * 28 },
        { scale: 0.94 + phone.value * 0.06 },
      ],
    };
  });

  const copyStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: copy.value };
    return {
      opacity: copy.value,
      transform: [{ translateY: (1 - copy.value) * 14 }],
    };
  });

  const counted = countedIndexOf(index);

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.root}>
        {/* Skip leads the focus order on purpose: someone reaching for the
            exit should not have to traverse the whole tour to find it. */}
        {!isLastStep(index) && index !== 0 ? (
          <Pressable
            onPress={() => finish("skipped")}
            style={[styles.skip, { top: insets.top + 12 }]}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}

        <GestureDetector gesture={pan}>
          <View style={styles.body}>
            {step.crop ? (
              <Animated.View style={phoneStyle}>
                <PhoneMock screenColor={step.crop === "oto" ? "#FFFFFF" : "#F2F6F9"}>
                  <Crop crop={step.crop} play={beatsPlaying} reduceMotion={reduceMotion} />
                </PhoneMock>
              </Animated.View>
            ) : (
              <View style={styles.cardArt} />
            )}

            <Animated.View style={[styles.copy, copyStyle]} accessible accessibilityRole="text">
              <Text style={styles.headline}>{step.headline}</Text>
              <Text style={styles.bodyText}>{step.body}</Text>
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
          {counted >= 0 ? (
            <View
              style={styles.dots}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={progressLabel(index) ?? undefined}
            >
              {Array.from({ length: COUNTED_STEP_COUNT }).map((_, i) => (
                <Dot key={i} active={i === counted} reduceMotion={reduceMotion} />
              ))}
            </View>
          ) : (
            <View style={styles.dotsSpacer} />
          )}

          <Pressable
            onPress={() => (isLastStep(index) ? onAddCar() : go(1))}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={step.primaryCta}
          >
            <Text style={styles.ctaText}>{step.primaryCta}</Text>
          </Pressable>

          {step.secondaryCta ? (
            <Pressable
              onPress={() => finish(isLastStep(index) ? "completed" : "skipped")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={step.secondaryCta}
            >
              <Text style={styles.secondary}>{step.secondaryCta}</Text>
            </Pressable>
          ) : (
            <View style={styles.secondarySpacer} />
          )}
        </View>
      </View>
    </Modal>
  );
}

/** The active dot is a pill, not a bigger circle — width is readable at a
 *  glance where a few pixels of diameter are not. */
function Dot({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const w = useSharedValue(active ? 20 : 7);
  useEffect(() => {
    w.value = reduceMotion
      ? active
        ? 20
        : 7
      : withSpring(active ? 20 : 7, SpringConfig.snappy);
  }, [active, reduceMotion, w]);
  const s = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[styles.dot, active && styles.dotActive, s]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EFF4FA" },
  skip: { position: "absolute", right: 20, zIndex: 10, padding: 8 },
  skipText: { fontFamily: FontFamily.medium, fontSize: 15, color: MUTED },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 44, paddingHorizontal: 40 },
  // Title and closing cards carry their own art; reserving the phone's height
  // keeps the copy and CTA from jumping between card and step.
  cardArt: { height: 232 },
  copy: { gap: 10, alignItems: "center" },
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: INK,
    textAlign: "center",
  },
  bodyText: {
    fontFamily: FontFamily.regular,
    fontSize: 15.5,
    lineHeight: 23,
    color: MUTED,
    textAlign: "center",
  },
  footer: { paddingHorizontal: 40, gap: 18, alignItems: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 7, height: 7 },
  dotsSpacer: { height: 7 },
  dot: { height: 7, borderRadius: 4, backgroundColor: DIM },
  dotActive: { backgroundColor: ACCENT },
  cta: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: { fontFamily: FontFamily.semiBold, fontSize: 16.5, color: "#FFFFFF" },
  secondary: { fontFamily: FontFamily.medium, fontSize: 15, color: MUTED },
  secondarySpacer: { height: 18 },
});

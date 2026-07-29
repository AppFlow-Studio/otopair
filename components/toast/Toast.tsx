/**
 * Brand-blue Airbnb-style toast.
 *
 * Visual (per Ahmad): every variant wears the brand-blue pill with a
 * diagonal gradient, white text, naked icon. Variant tokens still
 * drive icon choice + a11y role but the palette is force-locked so
 * the toast reads as the "Book Service" CTA family across the app.
 *
 * Motion (per PM): emerges from the tab bar (translateY 100 → 0
 * spring), retracts DOWN into the tab bar on dismiss instead of
 * fading away in place.
 */

import { useEffect } from "react";
import {
  AccessibilityRole,
  Dimensions,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";

import { FontFamily } from "@/constants/theme";
import { useReducedMotion } from "@/lib/accessibility";

import { ToastIcon } from "./ToastIcon";
import { DEFAULT_DURATION_MS, TOAST_SHADOW } from "./tokens";
import type { ToastQueueItem, ToastVariant } from "./types";

// Motion — the PM's "emerge from tab bar" pattern. Starts 100pt below
// the rest position (i.e. below the visible tab-bar top edge, given
// our resting bottom offset), springs up to 0, retracts back down on
// dismiss. Small entry delay so a trigger-source tap animation
// doesn't race the spring.
const HIDDEN_TRANSLATE = 100;
const ENTER_DELAY_MS = 80;
const ENTER_SPRING = { damping: 18, stiffness: 240, mass: 1 } as const;
const ENTER_FADE_MS = 180;
const EXIT_TIMING = {
  duration: 240,
  easing: Easing.in(Easing.cubic),
} as const;
const REDUCE_FADE = { duration: 200, easing: Easing.linear } as const;
const SWIPE_DISMISS_THRESHOLD = 40;
const SWIPE_VELOCITY_THRESHOLD = 400;

// Pill sizing — Airbnb "hug the content" rather than a full-width
// banner. Container drops width fill and self-centers inside an
// outer that spans the screen with 16pt insets.
const TOAST_MIN_WIDTH = 180;
const TOAST_MAX_WIDTH = 320;

// Brand-blue color lock. Every toast reads like the Book Service CTA
// regardless of variant. Variant still drives icon choice.
const TOAST_BG = "#5299FE";
const TOAST_FG = "#FFFFFF";
// Diagonal gradient (top-left light → bottom-right deep) painted
// over the flat brand-blue card. Two tints sampled from the base
// #5299FE — lighter for the top edge, deeper for the bottom edge
// — so the toast reads as a soft glassy pill instead of a flat
// rectangle. Direction is TL→BR to suggest a highlight running
// across the top-left, the same trick the Book Service CTA uses.
// Exported for EnrichmentStatusPill, which wears the same brand-blue
// glass so the persistent status pill and the toasts read as one family.
export const TOAST_GRADIENT = ["#7BB1FF", "#3D7AC8"] as const;
const TOAST_BG_OVERRIDE = {
  bg: TOAST_BG,
  border: TOAST_BG,
  iconColor: TOAST_FG,
  iconContainerBg: "transparent",
  iconContainerBorder: undefined,
} as const;
const TOAST_TEXT_OVERRIDE = {
  title: TOAST_FG,
  body: "rgba(255, 255, 255, 0.92)",
} as const;

const POLITE_VARIANTS = new Set<ToastVariant>(["info", "trust", "success"]);

function liveRegion(variant: ToastVariant): "polite" | "assertive" {
  return variant === "error" || variant === "warning" ? "assertive" : "polite";
}

function dynamicTypeScale(base: number): number {
  const scale = Math.min(PixelRatio.getFontScale(), 1.6);
  return base * scale;
}

interface Props {
  item: ToastQueueItem;
  bottomOffset: number;
  onRequestDismiss: (id: string) => void;
}

export function Toast({ item, bottomOffset, onRequestDismiss }: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = TOAST_BG_OVERRIDE;
  const textColors = TOAST_TEXT_OVERRIDE;
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(reduceMotion ? 0 : HIDDEN_TRANSLATE);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = withTiming(1, REDUCE_FADE);
    } else {
      translateY.value = withDelay(ENTER_DELAY_MS, withSpring(0, ENTER_SPRING));
      opacity.value = withDelay(
        ENTER_DELAY_MS,
        withTiming(1, { duration: ENTER_FADE_MS }),
      );
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (!item.persistent) {
      const duration = item.duration ?? DEFAULT_DURATION_MS[item.variant];
      timer = setTimeout(() => dismiss("auto"), duration);
    }
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimation(translateY);
      cancelAnimation(opacity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  function finalize() {
    onRequestDismiss(item.id);
  }

  function dismiss(_reason: "auto" | "tap" | "swipe") {
    if (reduceMotion) {
      opacity.value = withTiming(0, REDUCE_FADE, (done) => {
        if (done) runOnJS(finalize)();
      });
      return;
    }
    opacity.value = withTiming(0, EXIT_TIMING);
    // Retract DOWN into the tab bar edge (positive translateY).
    translateY.value = withTiming(HIDDEN_TRANSLATE, EXIT_TIMING, (done) => {
      if (done) runOnJS(finalize)();
    });
  }

  function handlePress() {
    item.onPress?.();
    dismiss("tap");
  }

  const swipeGesture = Gesture.Pan()
    .activeOffsetY([0, 12])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        opacity.value = Math.max(0.6, 1 - event.translationY / 120);
      }
    })
    .onEnd((event) => {
      const fastEnough = event.velocityY > SWIPE_VELOCITY_THRESHOLD;
      const farEnough = event.translationY > SWIPE_DISMISS_THRESHOLD;
      if (fastEnough || farEnough) {
        translateY.value = withTiming(
          HIDDEN_TRANSLATE,
          EXIT_TIMING,
          (done) => {
            if (done) runOnJS(finalize)();
          },
        );
        opacity.value = withTiming(0, EXIT_TIMING);
      } else if (reduceMotion) {
        translateY.value = withTiming(0, REDUCE_FADE);
        opacity.value = withTiming(1, REDUCE_FADE);
      } else {
        translateY.value = withSpring(0, ENTER_SPRING);
        opacity.value = withTiming(1, { duration: 160 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const shadow = TOAST_SHADOW[scheme === "dark" ? "dark" : "light"];
  const role: AccessibilityRole = POLITE_VARIANTS.has(item.variant)
    ? "summary"
    : "alert";

  const screen = Dimensions.get("window");
  const maxHeight = screen.height * 0.4;

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        style={[styles.outer, { bottom: bottomOffset }, animatedStyle]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={handlePress}
          accessible
          accessibilityRole={role}
          accessibilityLiveRegion={liveRegion(item.variant)}
          accessibilityLabel={
            item.body ? `${item.title}. ${item.body}` : item.title
          }
          accessibilityHint="Double tap to dismiss"
          accessibilityActions={[
            { name: "activate", label: "Dismiss notification" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "activate") {
              dismiss("tap");
            }
          }}
          style={[
            styles.container,
            {
              backgroundColor: palette.bg,
              borderColor: TOAST_GRADIENT[1],
              maxHeight,
            },
            shadow,
          ]}
        >
          <LinearGradient
            colors={TOAST_GRADIENT as unknown as readonly [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.row}>
            <ToastIcon variant={item.variant} palette={palette} />
            <View style={styles.textCol}>
              <Animated.Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={[
                  styles.title,
                  {
                    color: textColors.title,
                    fontSize: dynamicTypeScale(13),
                    lineHeight: dynamicTypeScale(17),
                  },
                ]}
              >
                {item.title}
              </Animated.Text>
              {item.body ? (
                <Animated.Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={[
                    styles.body,
                    {
                      color: textColors.body,
                      fontSize: dynamicTypeScale(12),
                      lineHeight: dynamicTypeScale(16),
                    },
                  ]}
                >
                  {item.body}
                </Animated.Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: "center",
    zIndex: 9999,
    ...(Platform.OS === "android" ? { elevation: 24 } : null),
  },
  container: {
    minWidth: TOAST_MIN_WIDTH,
    maxWidth: TOAST_MAX_WIDTH,
    alignSelf: "center",
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textCol: {
    flexShrink: 1,
  },
  title: {
    fontFamily: FontFamily.bold,
  },
  body: {
    fontFamily: FontFamily.semiBold,
    marginTop: 2,
  },
});

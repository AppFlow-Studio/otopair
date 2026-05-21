import { useEffect } from "react";
import {
  AccessibilityRole,
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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { FontFamily } from "@/constants/theme";
import { useReducedMotion } from "@/lib/accessibility";

import { ToastIcon } from "./ToastIcon";
import { TrustToastBackground } from "./TrustToast";
import {
  DEFAULT_DURATION_MS,
  TOAST_SHADOW,
  TOAST_TEXT,
  TRUST_SHADOW,
  VARIANT_TOKENS,
} from "./tokens";
import type { ToastQueueItem } from "./types";

const ENTER_SPRING = { damping: 18, stiffness: 220, mass: 0.6 } as const;
const EXIT_TIMING = { duration: 220, easing: Easing.in(Easing.cubic) } as const;
const REDUCE_FADE = { duration: 200, easing: Easing.linear } as const;
const SWIPE_DISMISS_THRESHOLD = 32;
const SWIPE_VELOCITY_THRESHOLD = 600;

const POLITE_VARIANTS = new Set(["info", "trust"]);

interface Props {
  item: ToastQueueItem;
  topOffset: number;
  onRequestDismiss: (id: string) => void;
}

export function Toast({ item, topOffset, onRequestDismiss }: Props) {
  const scheme = useColorScheme() ?? "light";
  const tokens = VARIANT_TOKENS[item.variant];
  const palette = tokens[scheme];
  const textColors = TOAST_TEXT[scheme];
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(reduceMotion ? 0 : -120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = withTiming(1, REDUCE_FADE);
    } else {
      translateY.value = withSpring(0, ENTER_SPRING);
      opacity.value = withTiming(1, { duration: 220 });
    }

    const duration = item.duration ?? DEFAULT_DURATION_MS[item.variant];
    const timer = setTimeout(() => dismiss("auto"), duration);
    return () => {
      clearTimeout(timer);
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
    translateY.value = withTiming(-8, EXIT_TIMING, (done) => {
      if (done) runOnJS(finalize)();
    });
  }

  function handlePress() {
    item.onPress?.();
    dismiss("tap");
  }

  const swipeGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      if (event.translationY < 0) {
        translateY.value = event.translationY;
        opacity.value = Math.max(0, 1 + event.translationY / 120);
      }
    })
    .onEnd((event) => {
      const fastEnough = event.velocityY < -SWIPE_VELOCITY_THRESHOLD;
      const farEnough = event.translationY < -SWIPE_DISMISS_THRESHOLD;
      if (fastEnough || farEnough) {
        translateY.value = withSpring(-200, { damping: 22, stiffness: 280 });
        opacity.value = withTiming(0, { duration: 160 }, (done) => {
          if (done) runOnJS(finalize)();
        });
      } else {
        translateY.value = withSpring(0, ENTER_SPRING);
        opacity.value = withTiming(1, { duration: 160 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const isTrust = item.variant === "trust";
  const shadow = isTrust ? TRUST_SHADOW[scheme] : TOAST_SHADOW[scheme];
  const role: AccessibilityRole = POLITE_VARIANTS.has(item.variant) ? "summary" : "alert";

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        style={[styles.outer, { top: topOffset }, animatedStyle]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={handlePress}
          accessible
          accessibilityRole={role}
          accessibilityLiveRegion={POLITE_VARIANTS.has(item.variant) ? "polite" : "assertive"}
          accessibilityLabel={item.body ? `${item.title}. ${item.body}` : item.title}
          accessibilityHint="Double tap to dismiss"
          style={[
            styles.container,
            {
              backgroundColor: isTrust ? "transparent" : palette.bg,
              borderColor: palette.border,
            },
            shadow,
          ]}
        >
          {isTrust ? (
            <TrustToastBackground scheme={scheme} borderColor={palette.border} />
          ) : null}
          <View style={styles.row}>
            <ToastIcon variant={item.variant} palette={palette} />
            <View style={styles.textCol}>
              <Animated.Text
                numberOfLines={2}
                style={[styles.title, { color: textColors.title }]}
              >
                {item.title}
              </Animated.Text>
              {item.body ? (
                <Animated.Text
                  numberOfLines={3}
                  style={[styles.body, { color: textColors.body }]}
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
    left: 16,
    right: 16,
    // sit above gorhom bottom sheets and most app surfaces
    zIndex: 9999,
    ...(Platform.OS === "android" ? { elevation: 24 } : null),
  },
  container: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});

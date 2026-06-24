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
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
import type { ToastQueueItem, ToastVariant } from "./types";

const ENTER_SPRING = { damping: 18, stiffness: 220, mass: 0.6 } as const;
// Slower, gentler exit per Ahmad — the previous 220ms `Easing.in.cubic`
// felt like a snap-out. 480ms with the standard Material-style
// out-cubic glides the toast back down to the bottom edge.
const EXIT_TIMING = {
  duration: 480,
  easing: Easing.bezier(0.33, 0, 0.67, 1),
} as const;
const REDUCE_FADE = { duration: 200, easing: Easing.linear } as const;
const SWIPE_DISMISS_THRESHOLD = 32;
const SWIPE_VELOCITY_THRESHOLD = 600;

// Airbnb-style title pop: when a toast enters, the title briefly
// renders in brand blue at a slightly larger scale, holds for a
// beat, then eases back to the resting style. Driven by a 0→1
// shared value with two phases (pop then settle), totaling ~600ms.
const TITLE_POP_HOLD_MS = 200;
const TITLE_POP_UP_MS = 220;
const TITLE_POP_DOWN_MS = 400;
const TITLE_POP_SCALE = 1.08;
const TITLE_POP_COLOR = "#5299FE";

const TABLET_MAX_WIDTH = 480;

const POLITE_VARIANTS = new Set<ToastVariant>(["info", "trust", "success"]);

function liveRegion(variant: ToastVariant): "polite" | "assertive" {
  // PLAN §B.7: assertive for Error/Warning, polite for Success/Info/Trust.
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
  const tokens = VARIANT_TOKENS[item.variant];
  const palette = tokens[scheme];
  const textColors = TOAST_TEXT[scheme];
  const reduceMotion = useReducedMotion();

  // Bottom-anchored (Airbnb-style): toast starts BELOW its rest
  // position and slides up. Positive translateY means "down".
  const translateY = useSharedValue(reduceMotion ? 0 : 120);
  const opacity = useSharedValue(0);
  // 0 → resting style; 1 → fully popped (blue + scaled). Driven on
  // mount to do a pop-then-settle pass on the title text only.
  const titlePop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = withTiming(1, REDUCE_FADE);
      // Reduce Motion: skip the pop, leave title at its resting style.
      titlePop.value = 0;
    } else {
      translateY.value = withSpring(0, ENTER_SPRING);
      opacity.value = withTiming(1, { duration: 220 });
      // Pop up, hold, then glide back. The hold is encoded as a
      // delay on the down-ramp so the chain reads naturally even
      // if the user dismisses early (cancelAnimation tears it down).
      titlePop.value = withTiming(
        1,
        { duration: TITLE_POP_UP_MS, easing: Easing.out(Easing.cubic) },
        (done) => {
          if (!done) return;
          titlePop.value = withDelay(
            TITLE_POP_HOLD_MS,
            withTiming(0, {
              duration: TITLE_POP_DOWN_MS,
              easing: Easing.bezier(0.33, 0, 0.67, 1),
            }),
          );
        },
      );
    }

    const duration = item.duration ?? DEFAULT_DURATION_MS[item.variant];
    const timer = setTimeout(() => dismiss("auto"), duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(translateY);
      cancelAnimation(opacity);
      cancelAnimation(titlePop);
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
    // Exit drifts downward by 8pt while fading.
    translateY.value = withTiming(8, EXIT_TIMING, (done) => {
      if (done) runOnJS(finalize)();
    });
  }

  function handlePress() {
    item.onPress?.();
    dismiss("tap");
  }

  // Bottom-anchored swipe-to-dismiss = swipe DOWN. Drag past the
  // threshold OR flick downward fast enough → fly out below.
  const swipeGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        opacity.value = Math.max(0, 1 - event.translationY / 120);
      }
    })
    .onEnd((event) => {
      const fastEnough = event.velocityY > SWIPE_VELOCITY_THRESHOLD;
      const farEnough = event.translationY > SWIPE_DISMISS_THRESHOLD;
      if (fastEnough || farEnough) {
        if (reduceMotion) {
          opacity.value = withTiming(0, REDUCE_FADE, (done) => {
            if (done) runOnJS(finalize)();
          });
        } else {
          translateY.value = withSpring(200, { damping: 22, stiffness: 280 });
          opacity.value = withTiming(0, { duration: 160 }, (done) => {
            if (done) runOnJS(finalize)();
          });
        }
      } else if (reduceMotion) {
        // Fix from Phase 2.5 STRESS-REPORT §4.4: don't spring under Reduce Motion.
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

  // Title pop — color glides from the resting title color to brand
  // blue, scale gently grows then settles. transformOrigin pinned
  // to the left so the text doesn't drift right as it scales up.
  const titleAnimatedStyle = useAnimatedStyle(() => {
    const t = titlePop.value;
    return {
      color: interpolateColor(
        t,
        [0, 1],
        [textColors.title, TITLE_POP_COLOR],
      ),
      transform: [{ scale: 1 + (TITLE_POP_SCALE - 1) * t }],
      transformOrigin: "left center",
    };
  });

  const isTrust = item.variant === "trust";
  const shadow = isTrust ? TRUST_SHADOW[scheme] : TOAST_SHADOW[scheme];
  const role: AccessibilityRole = POLITE_VARIANTS.has(item.variant) ? "summary" : "alert";

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
          accessibilityLabel={item.body ? `${item.title}. ${item.body}` : item.title}
          accessibilityHint="Double tap to dismiss"
          // Fix from Phase 2.5 STRESS-REPORT §4.5: explicit VoiceOver dismiss
          // path since one-finger swipe is intercepted by VoiceOver focus nav.
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
              backgroundColor: isTrust ? "transparent" : palette.bg,
              borderColor: palette.border,
              maxHeight,
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
                ellipsizeMode="tail"
                style={[
                  styles.title,
                  {
                    fontSize: dynamicTypeScale(15),
                    lineHeight: dynamicTypeScale(20),
                  },
                  // Animated color + scale come LAST so they
                  // override the resting title color from
                  // textColors.title during the pop window.
                  titleAnimatedStyle,
                ]}
              >
                {item.title}
              </Animated.Text>
              {item.body ? (
                <Animated.Text
                  numberOfLines={3}
                  ellipsizeMode="tail"
                  style={[
                    styles.body,
                    {
                      color: textColors.body,
                      fontSize: dynamicTypeScale(13),
                      lineHeight: dynamicTypeScale(18),
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
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
    ...(Platform.OS === "android" ? { elevation: 24 } : null),
  },
  container: {
    width: "100%",
    maxWidth: TABLET_MAX_WIDTH,
    alignSelf: "center",
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
  },
  body: {
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
});

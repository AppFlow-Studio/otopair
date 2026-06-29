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
import {
  DEFAULT_DURATION_MS,
  TOAST_SHADOW,
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

// Stadium-wave title effect: a "wave position" shared value sweeps
// across the title text. Each character derives its own scale +
// color from the distance to the wave's current position, so the
// pop traverses letter-by-letter — by the time the wave reaches
// the tail, the leading letters are already back to resting black.
const WAVE_PER_CHAR_MS = 45;     // controls the wave's travel speed
const WAVE_WIDTH = 4;            // chars in the active window (half-width on each side)
const WAVE_PEAK_SCALE = 1.18;
// Wave peak now == rest (#FFFFFF) since the toast bg IS the
// accent blue. Letters still scale but don't color-shift; the
// wave reads as a subtle bounce instead of a color sweep.
const WAVE_PEAK_COLOR = "#FFFFFF";

// Pill-style sizing per Ahmad's PM: match Airbnb's tight
// hug-the-content toast rather than the full-width banner the
// app shipped before. Container drops `width: 100%` and
// `alignSelf: center`s inside an outer that no longer constrains
// horizontal space, so the Pressable's width comes from its
// children. Caps below keep long bodies from sprawling and
// short titles from rendering as a sliver.
const TOAST_MIN_WIDTH = 180;
const TOAST_MAX_WIDTH = 320;

// Brand-blue color lock. PM wants every toast to look like the
// "Book Service" CTA — Otopair accent #5299FE with white text —
// regardless of variant. Variant tokens stay in place
// (success/error/warning/info/trust still drive icon choice and
// accessibility role) but the visual palette is forced. Switch
// to per-variant colors again if/when the design system grows
// distinct toast tones.
const TOAST_BG = "#5299FE";
const TOAST_FG = "#FFFFFF";
const TOAST_BG_OVERRIDE = {
  bg: TOAST_BG,
  border: TOAST_BG,
  iconColor: TOAST_FG,
  iconContainerBg: "transparent",
  iconContainerBorder: undefined,
} as const;
const TOAST_TEXT_OVERRIDE = {
  title: TOAST_FG,
  // Slightly soft body so the secondary line reads as supporting
  // copy without competing with the bold title.
  body: "rgba(255, 255, 255, 0.92)",
} as const;

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
  // Variant tokens are kept for icon choice + accessibility role,
  // but the *visual* palette (bg, border, text, icon color) is
  // locked to the brand-blue override below. Light/dark scheme
  // no longer changes the toast appearance.
  const palette = TOAST_BG_OVERRIDE;
  const textColors = TOAST_TEXT_OVERRIDE;
  const reduceMotion = useReducedMotion();

  // Bottom-anchored (Airbnb-style): toast starts BELOW its rest
  // position and slides up. Positive translateY means "down".
  const translateY = useSharedValue(reduceMotion ? 0 : 120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = withTiming(1, REDUCE_FADE);
    } else {
      translateY.value = withSpring(0, ENTER_SPRING);
      opacity.value = withTiming(1, { duration: 220 });
    }

    // Persistent toasts skip the auto-dismiss timer — they stick around
    // until the user taps or swipes them. Used for tap-to-act surfaces
    // (e.g. "your car is ready — book now").
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

  // Trust gradient overlay is gone in the brand-blue look — the
  // toast is already a flat brand-color card, so a gradient on
  // top would muddy it. Variant still drives the icon
  // (ShieldCheck for trust, CheckCircle2 for success, etc.).
  const shadow = TOAST_SHADOW[scheme === "dark" ? "dark" : "light"];
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
              backgroundColor: palette.bg,
              borderColor: palette.border,
              maxHeight,
            },
            shadow,
          ]}
        >
          <View style={styles.row}>
            <ToastIcon variant={item.variant} palette={palette} />
            <View style={styles.textCol}>
              <WaveTitle
                key={item.id}
                text={item.title}
                restColor={textColors.title}
                fontSize={dynamicTypeScale(15)}
                lineHeight={dynamicTypeScale(20)}
                reduceMotion={reduceMotion}
              />
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

// ============================================================================
// WAVE TITLE — per-char stadium-wave animation
// ============================================================================

interface WaveTitleProps {
  text: string;
  restColor: string;
  fontSize: number;
  lineHeight: number;
  reduceMotion: boolean;
}

/** Renders the toast title as a wrap-row of per-character
 *  `Animated.Text` nodes. A single `wave` shared value sweeps
 *  from -WAVE_WIDTH past `text.length + WAVE_WIDTH`; each char
 *  reads it through `useAnimatedStyle` and computes its own
 *  scale + color from the distance to the wave's current
 *  position. Result: a Mexican-wave-style pulse traveling
 *  letter-by-letter across the title. */
function WaveTitle({
  text,
  restColor,
  fontSize,
  lineHeight,
  reduceMotion,
}: WaveTitleProps) {
  const totalChars = text.length;
  // Start before the first letter, end past the last. Linear so
  // the wave's apparent speed reads as constant across the title.
  const wave = useSharedValue<number>(
    reduceMotion ? totalChars + WAVE_WIDTH : -WAVE_WIDTH,
  );

  useEffect(() => {
    if (reduceMotion) {
      wave.value = totalChars + WAVE_WIDTH;
      return;
    }
    wave.value = -WAVE_WIDTH;
    const totalSpan = totalChars + WAVE_WIDTH * 2;
    wave.value = withTiming(totalChars + WAVE_WIDTH, {
      duration: totalSpan * WAVE_PER_CHAR_MS,
      easing: Easing.linear,
    });
    return () => cancelAnimation(wave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Split by space so each word stays together when wrapping.
  // Each word gets its own non-wrapping row View; spaces between
  // words go inside the word container so they wrap with the word.
  const words = text.split(" ");
  let globalIdx = 0;

  return (
    <View style={waveStyles.wrap} accessible={false}>
      {words.map((word, wIdx) => {
        const chars = Array.from(word);
        const startIdx = globalIdx;
        globalIdx += chars.length;
        // Trailing space char ALSO gets a wave node so the wave
        // sweeps continuously across word boundaries instead of
        // hiccuping over invisible gaps.
        const trailingSpaceIdx = wIdx < words.length - 1 ? globalIdx++ : null;

        return (
          <View
            key={`${wIdx}-${word}`}
            style={waveStyles.word}
            accessible={false}
          >
            {chars.map((c, ci) => (
              <WaveChar
                key={`${wIdx}-${ci}`}
                char={c}
                index={startIdx + ci}
                wave={wave}
                restColor={restColor}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />
            ))}
            {trailingSpaceIdx !== null ? (
              <WaveChar
                char=" "
                index={trailingSpaceIdx}
                wave={wave}
                restColor={restColor}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

interface WaveCharProps {
  char: string;
  index: number;
  wave: ReturnType<typeof useSharedValue<number>>;
  restColor: string;
  fontSize: number;
  lineHeight: number;
}

function WaveChar({
  char,
  index,
  wave,
  restColor,
  fontSize,
  lineHeight,
}: WaveCharProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const dist = Math.abs(wave.value - index);
    // 1 at the wave's exact position; 0 outside the active window.
    const pop = Math.max(0, 1 - dist / WAVE_WIDTH);
    return {
      color: interpolateColor(pop, [0, 1], [restColor, WAVE_PEAK_COLOR]),
      transform: [{ scale: 1 + (WAVE_PEAK_SCALE - 1) * pop }],
      // Pinned to bottom-center so the baseline doesn't shift as
      // the letter scales up.
      transformOrigin: "center bottom",
    };
  });

  return (
    <Animated.Text
      accessible={false}
      style={[
        {
          fontFamily: FontFamily.semiBold,
          fontSize,
          lineHeight,
        },
        animatedStyle,
      ]}
    >
      {char}
    </Animated.Text>
  );
}

const waveStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  word: {
    flexDirection: "row",
  },
});

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    // No left/right pinning — outer spans the screen and the
    // container self-centers inside it, sized to its own
    // content. paddingHorizontal keeps long-bodied toasts from
    // touching the screen edges on the rare case they hit
    // TOAST_MAX_WIDTH.
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: "center",
    zIndex: 9999,
    ...(Platform.OS === "android" ? { elevation: 24 } : null),
  },
  container: {
    // No `width` — content sizes the pill. Min keeps tiny
    // single-word toasts from looking like a chip; max keeps
    // novel-length bodies from sprawling across the screen.
    minWidth: TOAST_MIN_WIDTH,
    maxWidth: TOAST_MAX_WIDTH,
    alignSelf: "center",
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textCol: {
    // `flexShrink: 1` (not `flex: 1`) — only shrink to the max
    // width cap, don't stretch to fill. Lets the row hug the
    // icon + text instead of pushing the icon to the left edge.
    flexShrink: 1,
  },
  title: {
    fontFamily: FontFamily.semiBold,
  },
  body: {
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
});

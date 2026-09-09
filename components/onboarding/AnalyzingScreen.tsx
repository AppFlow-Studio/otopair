/**
 * AnalyzingScreen
 *
 * Onboarding "analyzing / personalizing" loader that transitions
 * in-place to the completion moment. During the loading phase, icons
 * drift right → left through a fixed center with a smoothly warped
 * linear motion; during the complete phase, the icons + progress +
 * status fade out and the greeting title + support line + "Enter
 * Otopair" CTA fade in — with the pin logo staying fixed the entire
 * time, so the whole thing reads as one continuous screen.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  Bell,
  Car,
  CalendarClock,
  Gauge,
  MapPin,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";

import { Text, FontFamily, FontSize, Spacing } from "@/components/shared-ui";
import { SemanticColors } from "@/constants/theme";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { haptics } from "@/lib/haptics";

interface Props {
  onEnter: () => void;
}

const { width: SCREEN_W } = Dimensions.get("window");

// Palette + stops copied verbatim from OnboardingCompleteStep so the
// two screens read as one continuous scene during handoff.
const BLUE_GRADIENT: readonly [string, string, ...string[]] = [
  "#1A3A5C", "#204B78", "#2E6AAE", "#5299FE", "#6DACFE",
  "#8ABFFE", "#A6D0FE", "#C2E0FE", "#D9ECFE", "#E8F3FE",
  "#F2F8FF", "#F9FCFF", "#FFFFFF",
];
const GRADIENT_LOCATIONS: readonly [number, number, ...number[]] = [
  0, 0.12, 0.24, 0.36, 0.46, 0.55, 0.63, 0.71, 0.78, 0.84, 0.90, 0.95, 1,
];

const CTA_GRADIENT: [string, string, string] = ["#6DACFE", "#5299FE", "#3A7FE0"];

interface Step {
  id: string;
  icon: LucideIcon;
  label: string;
}
const STEPS: readonly Step[] = [
  { id: "garage",      icon: Car,           label: "Setting up your garage" },
  { id: "mechanics",   icon: MapPin,        label: "Finding trusted mechanics" },
  { id: "timeline",    icon: CalendarClock, label: "Building your timeline" },
  { id: "diagnostics", icon: Gauge,         label: "Reading vehicle diagnostics" },
  { id: "reminders",   icon: Bell,          label: "Scheduling reminders" },
  { id: "insights",    icon: Sparkles,      label: "Tuning your dashboard" },
  { id: "protection",  icon: ShieldCheck,   label: "Securing your account" },
];

const STEP = Math.round(SCREEN_W * 0.34);   // center-to-center icon spacing
const DISC = 96;
// Glowing halo + orbiting glint drawn just outside the disc. Ring sits
// GLOW px proud of the disc on every side.
const GLOW = 9;
const GLOW_SIZE = DISC + GLOW * 2;
const SPIN_MS = 4800;                        // one full orbit of the glint
// "Step-and-settle" belt: each icon glides into center then dwells
// there before the next slides in. Reads calmer and more deliberate
// than a constant-velocity scroll, and lets every icon actually rest
// at center instead of drifting past.
const GLIDE_MS = 700;                       // travel time between adjacent slots
const DWELL_MS = 460;                       // hold at center before the next glide
const INTRO_MS = 1000;                      // settle before the belt starts moving
// Total belt travel: the first glide + (N-1) dwell+glide segments. The
// progress bar fills continuously over exactly this window so it lands
// full the instant the last icon settles — moving the whole time, with
// no dwell pauses, but still ending at the right moment.
const BELT_MS = GLIDE_MS + (STEPS.length - 1) * (DWELL_MS + GLIDE_MS);
const OUTRO_MS = 600;
// Extra dwell after the last icon lands, before the outro starts.
const FINAL_HOLD_MS = 1200;

function resolveSupportLine(intent: string | undefined): string {
  switch (intent) {
    case "needs_service_now":
      return "Book your first service whenever you're ready — we've got you.";
    case "find_reliable_mechanic":
      return "Trusted mechanics near you are one tap away.";
    case "planning_ahead":
      return "We'll help you plan every mile ahead.";
    default:
      return "You're all set. Let's keep your ride running smooth.";
  }
}

// ─── Icon on the belt ────────────────────────────────────────────
function StepIcon({
  Icon,
  index,
  scroll,
  spin,
}: {
  Icon: LucideIcon;
  index: number;
  scroll: SharedValue<number>;
  spin: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const u = index - scroll.value;
    const translateX = u * STEP;
    const abs = Math.abs(u);
    const scale = interpolate(abs, [0, 1, 2], [1.12, 0.82, 0.62], Extrapolation.CLAMP);
    const opacity = interpolate(abs, [0, 1, 2], [1, 0.4, 0.1], Extrapolation.CLAMP);
    return { transform: [{ translateX }, { scale }], opacity };
  });

  // Glow is reserved for the icon at (or nearest) center — it fades out
  // quickly as the icon drifts to the side, so only the active disc
  // reads as "alive", like the reference.
  const haloStyle = useAnimatedStyle(() => {
    const abs = Math.abs(index - scroll.value);
    return { opacity: interpolate(abs, [0, 0.5], [1, 0], Extrapolation.CLAMP) };
  });
  // Same fade, plus a continuous rotation so the bright arc orbits the ring.
  const glintStyle = useAnimatedStyle(() => {
    const abs = Math.abs(index - scroll.value);
    return {
      opacity: interpolate(abs, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      transform: [{ rotate: `${spin.value}deg` }],
    };
  });

  return (
    <Animated.View style={[styles.iconAbsolute, style]}>
      <View style={styles.discWrap}>
        {/* Soft always-on glow ring (the "border glows"). */}
        <Animated.View style={[styles.glowHalo, haloStyle]} pointerEvents="none" />
        {/* Bright arc that orbits the ring (the "moves around"). */}
        <Animated.View style={[styles.glint, glintStyle]} pointerEvents="none">
          <LinearGradient
            colors={["#F2F8FF", "#A9CEFF", "rgba(169,206,255,0)", "rgba(169,206,255,0)"]}
            locations={[0, 0.16, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.glintFill}
          />
        </Animated.View>
        <LinearGradient
          colors={["#1A3A5C", "#3A7FE0"]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.95, y: 1 }}
          style={styles.disc}
        >
          <Icon size={44} color="#FFFFFF" strokeWidth={1.6} />
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────
export function AnalyzingScreen({ onEnter }: Props) {
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);

  const firstName = data.firstName?.split(" ")[0]?.trim() || null;
  const heading = firstName ? `You're in, ${firstName}` : "You're in";
  const supportLine = resolveSupportLine(data.userIntentions?.[0]);

  const [activeIndex, setActiveIndex] = useState(0);
  // Loading elements fade out at end; complete elements fade in.
  // `phase` gates when the CTA becomes pressable — no navigation.
  const [phase, setPhase] = useState<"loading" | "complete">("loading");

  const pinBob = useSharedValue(0);
  // Continuous 0→360 rotation shared by every disc's glint.
  const spin = useSharedValue(0);
  // Progress bar fill (0→1). Runs on its own linear timeline — decoupled
  // from the stepped belt — so it glides without pausing on the dwells.
  const progress = useSharedValue(0);
  // Continuous linear scroll from -1 → N-1. Icon i is centered when
  // scroll === i (post-warp). Starting at -1 makes icon 0 slide in
  // from the right just like every other icon does, instead of
  // popping in already centered.
  const scroll = useSharedValue(-1);
  // Ramps 0 → 1 during the outro; drives the fade-out of loading UI.
  const outro = useSharedValue(0);

  // Complete-phase entry animations (start hidden; useEffect below
  // fires them once phase flips).
  const titleY = useSharedValue(10);
  const titleOp = useSharedValue(0);
  const subY = useSharedValue(10);
  const subOp = useSharedValue(0);
  const ctaY = useSharedValue(20);
  const ctaOp = useSharedValue(0);
  const ctaScale = useSharedValue(1);

  // Keep `onEnter` in a ref so parent re-renders (fresh arrow closure)
  // don't retrigger the mount effect.
  const onEnterRef = useRef(onEnter);
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  // Pin bob starts on mount and never restarts.
  useEffect(() => {
    pinBob.value = withRepeat(
      withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pinBob]);

  // Glint orbit — one continuous linear rotation for the whole screen.
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  // Progress bar fills linearly across the same window the belt travels —
  // same INTRO delay, same total duration — so it never pauses yet lands
  // exactly full the moment the last icon settles.
  useEffect(() => {
    progress.value = withDelay(
      INTRO_MS,
      withTiming(1, { duration: BELT_MS, easing: Easing.linear }),
    );
  }, [progress]);

  // Drive the scroll linearly from -1 → last item. 1s intro delay so
  // the pin + gradient can settle before the belt starts moving.
  // N segments now instead of N-1 (extra segment = icon 0's entry
  // slide from off-right into the center).
  useEffect(() => {
    // Glide to each slot with an ease-in-out settle, pausing at center
    // before the next icon slides in. Segment 0 is icon 0's intro slide
    // from off-right (no leading dwell); every later segment holds
    // DWELL_MS at the current center first, then glides.
    const settle = Easing.inOut(Easing.cubic);
    const segments = STEPS.map((_, i) =>
      i === 0
        ? withTiming(0, { duration: GLIDE_MS, easing: settle })
        : withDelay(DWELL_MS, withTiming(i, { duration: GLIDE_MS, easing: settle })),
    );
    scroll.value = withDelay(INTRO_MS, withSequence(...segments));
  }, [scroll]);

  // Derive `activeIndex` from scroll on the UI thread; sync back to
  // JS only when the rounded value changes.
  useAnimatedReaction(
    () => Math.round(scroll.value),
    (curr, prev) => {
      if (curr !== prev && curr >= 0 && curr < STEPS.length) {
        runOnJS(setActiveIndex)(curr);
      }
    },
  );

  // Once the last icon has landed, hold, run the outro, then flip
  // phase to `complete`. The pin is untouched throughout.
  useEffect(() => {
    if (activeIndex !== STEPS.length - 1) return;
    const outroTimer = setTimeout(() => {
      outro.value = withTiming(1, {
        duration: OUTRO_MS,
        easing: Easing.out(Easing.cubic),
      });
    }, FINAL_HOLD_MS);
    const phaseTimer = setTimeout(() => {
      setPhase("complete");
      haptics.success();
    }, FINAL_HOLD_MS + OUTRO_MS);
    return () => {
      clearTimeout(outroTimer);
      clearTimeout(phaseTimer);
    };
  }, [activeIndex, outro]);

  // Cascade the complete-phase greeting + CTA in when phase flips.
  useEffect(() => {
    if (phase !== "complete") return;
    titleOp.value = withDelay(100, withTiming(1, { duration: 450 }));
    titleY.value = withDelay(
      100,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    subOp.value = withDelay(220, withTiming(1, { duration: 450 }));
    subY.value = withDelay(
      220,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    ctaOp.value = withDelay(420, withTiming(1, { duration: 450 }));
    ctaY.value = withDelay(
      420,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [phase, titleOp, titleY, subOp, subY, ctaOp, ctaY]);

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pinBob.value }],
  }));
  // Progress bar tied directly to scroll for smooth continuous motion.
  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const stageOutroStyle = useAnimatedStyle(() => {
    const opacity = interpolate(outro.value, [0, 1], [1, 0], Extrapolation.CLAMP);
    const scale = interpolate(outro.value, [0, 1], [1, 0.85], Extrapolation.CLAMP);
    const translateY = interpolate(outro.value, [0, 1], [0, 30], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }, { translateY }] };
  });
  const outroFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(outro.value, [0, 1], [1, 0], Extrapolation.CLAMP),
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
      <BlurView intensity={55} tint="default" style={StyleSheet.absoluteFill} />

      {/* Top mist — atmospheric hazy band around the pin. */}
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

      {/* Otopair pin — vertical middle, gentle bob. Persists across
          both phases; only surrounding elements swap. Soft-focus via
          Image's `blurRadius` during the loading phase so it reads as
          "processing"; snaps sharp on the complete phase. */}
      <View style={styles.pinBlock} pointerEvents="none">
        <Animated.View style={pinStyle}>
          <Image
            source={require("@/assets/images/pin-logo-3d.png")}
            style={styles.pin}
            contentFit="contain"
            blurRadius={phase === "loading" ? 16 : 0}
            accessibilityLabel="Otopair"
          />
        </Animated.View>
      </View>

      {/* Loading-phase title — real page title sitting above the pin.
          Positioned using the safe-area top inset so it clears the
          notch / dynamic island on every device. */}
      {phase === "loading" && (
        <Animated.View
          style={[
            styles.loadingTitleBlock,
            { top: insets.top + Spacing["3xl"] + Spacing.lg },
            outroFadeStyle,
          ]}
        >
          <Text weight="extraBold" style={styles.loadingTitle}>
            Getting things ready...
          </Text>
        </Animated.View>
      )}

      {/* Loading-phase elements — progress + icon belt + status text.
          Kept mounted during the complete phase (their opacity is
          driven to 0 by `outro`) so the pin's context stays stable. */}
      <Animated.View style={[styles.progressTrack, { top: "62%" }, outroFadeStyle]}>
        <Animated.View style={[styles.progressFill, progressFillStyle]} />
      </Animated.View>

      <Animated.View style={[styles.stage, stageOutroStyle]} pointerEvents="none">
        {STEPS.map((s, i) => (
          <StepIcon key={s.id} Icon={s.icon} index={i} scroll={scroll} spin={spin} />
        ))}
      </Animated.View>

      {/* Soft fade along the bottom — no hard cutoff line. */}
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

      {phase === "loading" && (
        <Animated.View
          style={[
            styles.statusBlock,
            { paddingBottom: insets.bottom + Spacing["2xl"] },
            outroFadeStyle,
          ]}
        >
          <View style={styles.statusFixedHeight}>
            <Animated.View
              key={STEPS[activeIndex].id}
              // Crossfade tuned to match the carousel's continuous
              // motion: old label starts fading out as the icon
              // starts leaving center, new label fades in over the
              // same window so the swap is smooth and constant, no
              // empty gap.
              entering={FadeIn.duration(500)}
              exiting={FadeOut.duration(500)}
              style={styles.statusRow}
            >
              <Text weight="bold" style={styles.statusText}>
                {STEPS[activeIndex].label}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* Complete-phase elements — greeting title, support line, and
          "Enter Otopair" CTA. All start hidden and cascade in when the
          phase flips to `complete`. */}
      {phase === "complete" && (
        <>
          <Animated.View style={[styles.completeCopy, titleStyle]}>
            <Text weight="extraBold" style={styles.completeTitle}>
              {heading}
            </Text>
          </Animated.View>
          <Animated.View style={[styles.completeSub, subStyle]}>
            <Text weight="bold" style={styles.completeSubText}>
              {supportLine}
            </Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.ctaWrap,
              { paddingBottom: insets.bottom + Spacing.lg },
              ctaStyle,
            ]}
          >
            <Pressable
              onPress={() => onEnterRef.current()}
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
                    Enter Otopair
                  </Text>
                </LinearGradient>
              </View>
            </Pressable>
          </Animated.View>
        </>
      )}
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

  progressTrack: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: SemanticColors.primaryBlueLightOnDark,
  },

  stage: {
    position: "absolute",
    top: "67%",
    left: 0,
    right: 0,
    height: DISC + 60,
    alignItems: "center",
    justifyContent: "center",
  },

  iconAbsolute: {
    position: "absolute",
    top: (DISC + 60 - DISC) / 2,
    left: (SCREEN_W - DISC) / 2,
    width: DISC,
    height: DISC,
  },
  discWrap: {
    width: DISC,
    height: DISC,
    alignItems: "center",
    justifyContent: "center",
  },
  // Soft glowing ring sitting just outside the disc. The border color
  // gives the ring; the matching shadow bleeds it into a halo.
  glowHalo: {
    position: "absolute",
    top: -GLOW,
    left: -GLOW,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    borderWidth: 2.5,
    borderColor: "rgba(169,206,255,0.45)",
    shadowColor: "#8FC0FF",
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  // Rotating gradient whose bright top edge reads as an arc orbiting the
  // ring. The disc on top masks the centre, leaving only the ring lit.
  glint: {
    position: "absolute",
    top: -GLOW,
    left: -GLOW,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    overflow: "hidden",
  },
  glintFill: {
    width: "100%",
    height: "100%",
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 12,
  },

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

  // Loading-phase title — real page title, sits above the pin near
  // the top of the screen. White since the top of the gradient is
  // deep blue.
  loadingTitleBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  loadingTitle: {
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    textAlign: "center",
    fontFamily: FontFamily.extraBold,
  },

  statusBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  statusFixedHeight: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 22,
    color: "#1A3A5C",
    letterSpacing: 0.1,
    textAlign: "center",
    fontFamily: FontFamily.bold,
  },

  // Complete-phase copy — title + support line sit below the pin on
  // the lighter/white portion of the gradient, so text is deep-blue
  // for legibility rather than white.
  completeCopy: {
    position: "absolute",
    top: "54%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  completeTitle: {
    fontSize: 38,
    lineHeight: 46,
    color: "#1A3A5C",
    textAlign: "center",
    letterSpacing: -0.6,
    paddingVertical: 4,
    maxWidth: 340,
  },
  completeSub: {
    position: "absolute",
    top: "66%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  completeSubText: {
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

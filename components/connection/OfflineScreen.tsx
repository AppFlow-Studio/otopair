/**
 * OfflineScreen — full-screen cold-start offline page (concept id 1a).
 *
 * Visuals implement the approved design concept ("Pill system design
 * feedback" zip → Offline State.dc.html): brand gradient sky, muted 3D pin
 * floating over sonar rings, and a Try again CTA with a live "Connecting…"
 * phase that softly reports failure ("we'll keep trying in the background").
 *
 * Shown by OfflineBootGate when the app opens with no connection and nothing
 * cached. There is no success branch here on purpose — the moment the socket
 * connects, the gate unmounts this screen.
 */
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { COLOR_GRADIENTS } from "@/constants/colorGradients";
import { BorderRadius, BrandColors, SemanticColors, Shadows, Spacing } from "@/constants/theme";

/** How long "Connecting…" shows before softly admitting failure (mock: 2.6s). */
const CONNECT_FEEDBACK_MS = 2600;

// Sky backdrop = the design system's blue gradient (identical stops to the concept).
const GRADIENT_SKY = COLOR_GRADIENTS.blue as [string, string, string];
const RING_BLUE = `${BrandColors.secondary}80`; // secondary @ 50% alpha
// Booking-blocked amber one-off, same literal the payment write-gate uses
// (deliberately not a token — see the Pass A plan's token note).
const FAILED_AMBER = "#92400E";

interface SonarRingProps {
  delayMs: number;
}

/** Expanding sonar ring: scale 0.75 → 1.55 while fading out, on a 2.6s loop. */
function SonarRing({ delayMs }: SonarRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [delayMs, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.7, 1], [0.55, 0, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.75, 1.55]) }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />;
}

/** The muted 3D pin, gently bobbing (±7px over 4s). */
function FloatingPin() {
  const shift = useSharedValue(0);

  useEffect(() => {
    shift.value = withRepeat(
      withTiming(-7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shift]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
  }));

  return (
    <Animated.View style={floatStyle}>
      <Image
        source={require("@/assets/images/pin-logo-3d-offline.png")}
        style={styles.pin}
        resizeMode="contain"
        accessible={false}
      />
    </Animated.View>
  );
}

/** Spinning loader glyph for the "Connecting…" phase. */
function Spinner() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={spinStyle}>
      <LoaderCircle size={19} color={BrandColors.white} />
    </Animated.View>
  );
}

interface OfflineScreenProps {
  onRetry: () => void;
}

export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<"idle" | "connecting">("idle");
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleRetry = () => {
    if (status === "connecting") return;
    setStatus("connecting");
    setFailed(false);
    onRetry();
    // If the retry actually reconnects, OfflineBootGate unmounts us before
    // this fires; otherwise admit it and keep retrying in the background.
    timer.current = setTimeout(() => {
      setStatus("idle");
      setFailed(true);
    }, CONNECT_FEEDBACK_MS);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENT_SKY}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Muted brand header */}
      <View style={[styles.header, { marginTop: insets.top + 8 }]}>
        <Image
          source={require("@/assets/images/homelogo-offline.png")}
          style={styles.headerLogo}
          resizeMode="contain"
          accessible={false}
        />
        <Text size={18} weight="extraBold" color={BrandColors.primary}>
          otopair
        </Text>
      </View>

      {/* Centerpiece: sonar rings + floating muted pin */}
      <View style={styles.center}>
        <View style={styles.pinStage}>
          <SonarRing delayMs={0} />
          <SonarRing delayMs={1300} />
          <FloatingPin />
        </View>

        <Text size={30} weight="extraBold" color={BrandColors.primary} center letterSpacing={-0.6}>
          You&apos;re offline
        </Text>
        <Text
          size={16}
          weight="medium"
          color={SemanticColors.textSecondary}
          center
          lineHeight={1.5}
          style={styles.body}
        >
          We&apos;re having trouble getting to you. Check your connection and
          we&apos;ll get you back on the road.
        </Text>
      </View>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) + 18 }]}>
        {status === "connecting" ? (
          <View style={[styles.cta, styles.ctaConnecting]} accessibilityLabel="Connecting">
            <Spinner />
            <Text size={17} weight="semiBold" color={BrandColors.white}>
              Connecting…
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <RefreshCw size={18} color={BrandColors.white} />
            <Text size={17} weight="semiBold" color={BrandColors.white}>
              Try again
            </Text>
          </Pressable>
        )}

        {status === "idle" && failed ? (
          <View style={styles.failedRow} accessibilityLiveRegion="polite">
            <TriangleAlert size={14} color={FAILED_AMBER} />
            <Text size={13} weight="semiBold" color={FAILED_AMBER}>
              Still no connection — we&apos;ll keep trying in the background.
            </Text>
          </View>
        ) : null}

        {status === "idle" ? (
          <Text size={13} weight="medium" color={SemanticColors.textMuted} center>
            Your bookings and vehicles are safe.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: 22,
    opacity: 0.7,
  },
  headerLogo: { width: 25, height: 24 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  pinStage: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: RING_BLUE,
  },
  pin: { width: 152, height: 152, opacity: 0.9 },
  body: { marginTop: 12, maxWidth: 290 },
  footer: {
    paddingHorizontal: 22,
    paddingTop: Spacing.md,
    alignItems: "center",
    gap: 10,
  },
  cta: {
    width: "100%",
    height: 54,
    borderRadius: BorderRadius.lg,
    backgroundColor: BrandColors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  ctaConnecting: { opacity: 0.85 },
  ctaPressed: { opacity: 0.9 },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});

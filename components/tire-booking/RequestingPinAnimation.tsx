/**
 * RequestingPinAnimation
 *
 * 3D-feel "pinning your location" animation that replaces the previous
 * Apple Maps + multi-pin background on the tire-quote requesting screen.
 * Recreated from the Claude Design HTML prototype (`Logo Loading
 * Animation.html`) — translates its CSS keyframes into Reanimated worklets
 * so the whole loop runs on the UI thread.
 *
 * The 6.5-second master loop:
 *   0–20%  Pin enters from above the screen, scaling + rotating in.
 *   21%    IMPACT — pin overshoots into the ground, sparks fly,
 *          shockwave rings expand outward, ground shadow snaps in.
 *   24–33% Squish-back / settle.
 *   33–92% Pin floats subtly while the radar pulses for nearby shops.
 *   92–100% Fade out, then restart.
 *
 * Stars + light-cone breathe + radar sweep have their own independent
 * loops so the scene doesn't feel mechanically tied to the master timer.
 *
 * USED IN: app/(tire-booking)/requesting.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
} from "react-native-svg";

interface Props {
  width: number;
  height: number;
}

const LOOP_MS = 6500;
const TWINKLE_MS = 4000;
const BREATHE_MS = 3600;
const RADAR_SWEEP_MS = 3500;

// Pin sizing — pin fills ~52% of the available animation area's height.
// The visible animation lives above the FloatingSheet so we compute
// landing point from `height` rather than the device screen height.
const PIN_HEIGHT_RATIO = 0.52;
// Pin tip lands at this fraction of the available animation height.
// 0.65 keeps it visually centered in the upper half while leaving room
// above for the entry trajectory.
const LANDING_Y_RATIO = 0.65;

const SPARK_COUNT = 12;

// --- Keyframe data (from `Logo Loading Animation.html`) ----------------
// Each row: [progressStop, value]. progressStop is in 0..1. The pin
// "translate Y" values are mixed: vh-relative for the descent (pre-21%)
// and px-relative for the post-impact settle. We resolve them to pixel
// offsets at runtime using the screen height + pin height.

const PIN_STOPS = [0, 0.06, 0.14, 0.18, 0.2, 0.21, 0.24, 0.28, 0.33, 0.5, 0.72, 0.92, 1.0] as const;
// Y offset relative to the pin's RESTING tip position (at landing point).
// Pre-impact: large negative numbers (offscreen above). Post-impact: tiny
// pixel oscillations. We multiply by `height` for the vh-style values and
// pass raw px for the settle phase. `MULT_BY_HEIGHT` flags which mode each
// stop uses so the worklet can do the right math.
const PIN_Y_OFFSETS_VH = [-1.0, -0.9, -0.55, -0.22, -0.06, 0, 0, 0, 0, 0, 0, 0, 0] as const;
const PIN_Y_OFFSETS_PX = [0, 0, 0, 0, 0, 14, -8, 4, 0, -10, 0, -4, -4] as const;
const PIN_SCALE = [0.18, 0.22, 0.45, 0.78, 0.95, 1.08, 0.94, 1.03, 1.0, 1.0, 1.0, 1.0, 1.0] as const;
const PIN_ROTATE_DEG = [-22, -20, -12, -5, -2, 0, 2, -1, 0, 0, 0, 0, 0] as const;
const PIN_OPACITY = [0, 0.5, 0.85, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] as const;

// Trail (descent streak)
const TRAIL_STOPS = [0, 0.08, 0.1, 0.16, 0.2, 0.22, 1.0] as const;
const TRAIL_Y_VH = [-0.9, -0.9, -0.8, -0.3, -0.06, 0, 0] as const;
const TRAIL_OPACITY = [0, 0, 0.6, 0.95, 0.7, 0, 0] as const;
const TRAIL_SCALE_Y = [0.4, 0.4, 0.5, 1.0, 0.5, 0.1, 0.1] as const;

// Ground shadow
const GROUND_STOPS = [0, 0.18, 0.21, 0.27, 1.0] as const;
const GROUND_W_PX = [40, 40, 380, 240, 280] as const;
const GROUND_H_PX = [6, 6, 38, 22, 26] as const;
const GROUND_OPACITY = [0, 0, 0.9, 0.7, 0.7] as const;

// Shockwave rings (each has the same shape, rendered with staggered delays)
const RING_STOPS = [0, 0.19, 0.21, 0.35, 1.0] as const;
const RING_W_PX = [60, 60, 60, 520, 520] as const;
const RING_H_PX = [14, 14, 14, 110, 110] as const;
const RING_OPACITY = [0, 0, 0.9, 0, 0] as const;

// Radar circles fade in a beat after impact, hold, fade out for loop.
const RADAR_STOPS = [0, 0.3, 0.45, 0.9, 1.0] as const;
const RADAR_OPACITY = [0, 0, 1, 1, 0] as const;

// --- Helper: piecewise linear interpolation in a worklet ----------------
// Reanimated's `interpolate` already does this, but we keep the keyframe
// arrays as readonly tuples and pass them through. Wrapped here so the
// individual style hooks read clearly.

// --- Component -----------------------------------------------------------

export function RequestingPinAnimation({ width, height }: Props) {
  const t = useSharedValue(0); // master loop, 0..1 over LOOP_MS
  const twinkle = useSharedValue(0);
  const breathe = useSharedValue(0);
  const radarSpin = useSharedValue(0);

  const pinHeight = Math.max(140, Math.round(height * PIN_HEIGHT_RATIO));
  const pinWidth = Math.round(pinHeight * (526 / 700)); // matches PNG aspect
  const landingY = Math.round(height * LANDING_Y_RATIO);

  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    twinkle.value = withRepeat(
      withTiming(1, { duration: TWINKLE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: BREATHE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    radarSpin.value = withRepeat(
      withTiming(1, { duration: RADAR_SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t, twinkle, breathe, radarSpin]);

  // ---- Pin entrance ----
  // We split the y offset into "vh portion" (multiplied by height) and
  // "px portion" (raw). Both interpolate against the same stops, then
  // get summed at runtime.
  const pinAnimStyle = useAnimatedStyle(() => {
    const yVh = interpolate(t.value, PIN_STOPS as unknown as number[], PIN_Y_OFFSETS_VH as unknown as number[], Extrapolation.CLAMP);
    const yPx = interpolate(t.value, PIN_STOPS as unknown as number[], PIN_Y_OFFSETS_PX as unknown as number[], Extrapolation.CLAMP);
    const scale = interpolate(t.value, PIN_STOPS as unknown as number[], PIN_SCALE as unknown as number[], Extrapolation.CLAMP);
    const rotate = interpolate(t.value, PIN_STOPS as unknown as number[], PIN_ROTATE_DEG as unknown as number[], Extrapolation.CLAMP);
    const opacity = interpolate(t.value, PIN_STOPS as unknown as number[], PIN_OPACITY as unknown as number[], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [
        { translateY: yVh * height + yPx },
        { scale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // ---- Motion trail ----
  const trailAnimStyle = useAnimatedStyle(() => {
    const yVh = interpolate(t.value, TRAIL_STOPS as unknown as number[], TRAIL_Y_VH as unknown as number[], Extrapolation.CLAMP);
    const opacity = interpolate(t.value, TRAIL_STOPS as unknown as number[], TRAIL_OPACITY as unknown as number[], Extrapolation.CLAMP);
    const scaleY = interpolate(t.value, TRAIL_STOPS as unknown as number[], TRAIL_SCALE_Y as unknown as number[], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY: yVh * height }, { scaleY }],
    };
  });

  // ---- Ground shadow ----
  const groundAnimStyle = useAnimatedStyle(() => {
    const w = interpolate(t.value, GROUND_STOPS as unknown as number[], GROUND_W_PX as unknown as number[], Extrapolation.CLAMP);
    const h = interpolate(t.value, GROUND_STOPS as unknown as number[], GROUND_H_PX as unknown as number[], Extrapolation.CLAMP);
    const opacity = interpolate(t.value, GROUND_STOPS as unknown as number[], GROUND_OPACITY as unknown as number[], Extrapolation.CLAMP);
    return {
      width: w,
      height: h,
      opacity,
      marginLeft: -w / 2,
      marginTop: -h / 2,
    };
  });

  // ---- Shockwave rings (3 of them with staggered phase) ----
  // Each ring trails the previous by a tiny fraction of the loop so the
  // shockwave reads as 3 expanding circles rather than a single fat one.
  const ring1Style = useAnimatedStyle(() => {
    const p = t.value;
    const w = interpolate(p, RING_STOPS as unknown as number[], RING_W_PX as unknown as number[], Extrapolation.CLAMP);
    const h = interpolate(p, RING_STOPS as unknown as number[], RING_H_PX as unknown as number[], Extrapolation.CLAMP);
    const opacity = interpolate(p, RING_STOPS as unknown as number[], RING_OPACITY as unknown as number[], Extrapolation.CLAMP);
    return { width: w, height: h, opacity, marginLeft: -w / 2, marginTop: -h / 2, borderRadius: w / 2 };
  });
  const ring2Style = useAnimatedStyle(() => {
    const p = (t.value + 1 - 0.018) % 1;
    const w = interpolate(p, RING_STOPS as unknown as number[], RING_W_PX as unknown as number[], Extrapolation.CLAMP);
    const h = interpolate(p, RING_STOPS as unknown as number[], RING_H_PX as unknown as number[], Extrapolation.CLAMP);
    const opacity = interpolate(p, RING_STOPS as unknown as number[], RING_OPACITY as unknown as number[], Extrapolation.CLAMP);
    return { width: w, height: h, opacity, marginLeft: -w / 2, marginTop: -h / 2, borderRadius: w / 2 };
  });
  const ring3Style = useAnimatedStyle(() => {
    const p = (t.value + 1 - 0.036) % 1;
    const w = interpolate(p, RING_STOPS as unknown as number[], RING_W_PX as unknown as number[], Extrapolation.CLAMP);
    const h = interpolate(p, RING_STOPS as unknown as number[], RING_H_PX as unknown as number[], Extrapolation.CLAMP);
    const opacity = interpolate(p, RING_STOPS as unknown as number[], RING_OPACITY as unknown as number[], Extrapolation.CLAMP);
    return { width: w, height: h, opacity, marginLeft: -w / 2, marginTop: -h / 2, borderRadius: w / 2 };
  });

  // ---- Radar idle pulse (after impact) ----
  const radarOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(t.value, RADAR_STOPS as unknown as number[], RADAR_OPACITY as unknown as number[], Extrapolation.CLAMP);
    return { opacity };
  });

  // ---- Light cone breathe ----
  const coneStyle = useAnimatedStyle(() => {
    const opacity = interpolate(breathe.value, [0, 0.5, 1], [0.55, 0.9, 0.55]);
    const scaleX = interpolate(breathe.value, [0, 0.5, 1], [1, 1.06, 1]);
    return { opacity, transform: [{ translateX: -360 }, { scaleX }] };
  });

  // ---- Star twinkle ----
  const starsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 0.5, 1], [0.85, 1, 0.85]),
  }));

  // ---- Sparks ----
  // Each spark gets a precomputed angle + radius so they fly outward in a
  // ring on impact. Coordinates are squished vertically to sell the
  // "ground plane" perspective.
  const sparks = useMemo(() => {
    const arr: Array<{ id: string; sx0: number; sy0: number; sx1: number; sy1: number; delay: number }> = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const a = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const r0 = 4 + Math.random() * 8;
      const r1 = 90 + Math.random() * 80;
      arr.push({
        id: `s${i}`,
        sx0: Math.cos(a) * r0,
        sy0: Math.sin(a) * r0 * 0.5,
        sx1: Math.cos(a) * r1,
        sy1: Math.sin(a) * r1 * 0.5,
        delay: Math.random() * 0.008, // 0..8ms of the loop
      });
    }
    return arr;
  }, []);

  return (
    <View style={[styles.scene, { width, height }]} pointerEvents="none">
      {/* Dark space radial-gradient backdrop */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="bgGrad" cx="50%" cy="60%" rx="80%" ry="100%">
            <Stop offset="0%" stopColor="#0e1d34" stopOpacity="1" />
            <Stop offset="35%" stopColor="#0a1628" stopOpacity="1" />
            <Stop offset="100%" stopColor="#050a14" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height * 0.6} rx={width} ry={height} fill="url(#bgGrad)" />
      </Svg>

      {/* Stars — 8 small glowing dots, twinkle on the same loop */}
      <Animated.View style={[styles.starsLayer, starsStyle]}>
        {STAR_POSITIONS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.star,
              {
                top: `${s.top}%`,
                left: `${s.left}%`,
                opacity: s.opacity,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Light cone — radial gradient column shining onto the landing point */}
      <Animated.View
        style={[
          styles.lightCone,
          {
            width: 720,
            height: height * 0.7,
            top: 0,
            left: width / 2,
          },
          coneStyle,
        ]}
      >
        <Svg width={720} height={height * 0.7}>
          <Defs>
            <RadialGradient id="coneGrad" cx="50%" cy="100%" rx="50%" ry="100%">
              <Stop offset="0%" stopColor="#6cc0ff" stopOpacity="0.28" />
              <Stop offset="30%" stopColor="#6cc0ff" stopOpacity="0.1" />
              <Stop offset="70%" stopColor="#6cc0ff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={360} cy={height * 0.7} rx={360} ry={height * 0.7} fill="url(#coneGrad)" />
        </Svg>
      </Animated.View>

      {/* Shockwave rings */}
      <View style={[styles.ringHost, { top: landingY, left: width / 2 }]} pointerEvents="none">
        <Animated.View style={[styles.ring, ring1Style]} />
        <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />
        <Animated.View style={[styles.ring, styles.ring3, ring3Style]} />
      </View>

      {/* Ground shadow / contact disc (under landing point) */}
      <Animated.View
        style={[
          styles.ground,
          { top: landingY, left: width / 2 },
          groundAnimStyle,
        ]}
      />

      {/* Radar idle pulse */}
      <Animated.View
        style={[
          styles.radarHost,
          { top: landingY, left: width / 2 },
          radarOpacityStyle,
        ]}
      >
        <View style={[styles.radarRing, { width: 360, height: 78, marginLeft: -180, marginTop: -39 }]} />
        <View style={[styles.radarRing, { width: 240, height: 52, marginLeft: -120, marginTop: -26, opacity: 0.7 }]} />
      </Animated.View>

      {/* Motion trail (descent streak) */}
      <Animated.View
        style={[
          styles.trail,
          { top: landingY, left: width / 2, height: pinHeight * 1.6 },
          trailAnimStyle,
        ]}
      />

      {/* Sparks — fly outward from landing point on impact */}
      <View style={[styles.sparkHost, { top: landingY, left: width / 2 }]} pointerEvents="none">
        {sparks.map((s) => (
          <Spark key={s.id} t={t} {...s} />
        ))}
      </View>

      {/* Pin — the hero. Wrap is anchored so its bottom (pin tip) sits at
          the landing point; transform animates around that anchor. */}
      <Animated.View
        style={[
          styles.pinWrap,
          {
            top: landingY - pinHeight,
            left: width / 2 - pinWidth / 2,
            width: pinWidth,
            height: pinHeight,
          },
          pinAnimStyle,
        ]}
      >
        <Image
          source={require("@/assets/images/pin-logo-3d.png")}
          style={styles.pinImage}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>
    </View>
  );
}

// --- Spark sub-component (one Animated.View per particle) ----------------
interface SparkProps {
  t: SharedValue<number>;
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  delay: number;
}
function Spark({ t, sx0, sy0, sx1, sy1, delay }: SparkProps) {
  const SPARK_STOPS = [0, 0.19, 0.21, 0.34, 1.0];
  const X_VALS = [0, 0, sx0, sx1, sx1];
  const Y_VALS = [0, 0, sy0, sy1, sy1];
  const OPAC = [0, 0, 1, 0, 0];
  const SCALE = [0.3, 0.3, 1.2, 0.6, 0.3];

  const style = useAnimatedStyle(() => {
    const p = (t.value + delay) % 1;
    return {
      opacity: interpolate(p, SPARK_STOPS, OPAC, Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, SPARK_STOPS, X_VALS, Extrapolation.CLAMP) },
        { translateY: interpolate(p, SPARK_STOPS, Y_VALS, Extrapolation.CLAMP) },
        { scale: interpolate(p, SPARK_STOPS, SCALE, Extrapolation.CLAMP) },
      ],
    };
  });
  return <Animated.View style={[styles.spark, style]} />;
}

// --- Static star positions (top%, left%, base opacity) -------------------
const STAR_POSITIONS = [
  { top: 30, left: 20, opacity: 0.55 },
  { top: 20, left: 70, opacity: 0.4 },
  { top: 70, left: 80, opacity: 0.35 },
  { top: 80, left: 35, opacity: 0.5 },
  { top: 65, left: 12, opacity: 0.3 },
  { top: 45, left: 55, opacity: 0.4 },
  { top: 40, left: 90, opacity: 0.3 },
  { top: 18, left: 5, opacity: 0.4 },
];

const styles = StyleSheet.create({
  scene: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
    backgroundColor: "#0a1628",
  },
  starsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(180, 210, 255, 1)",
    shadowColor: "#aaddff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
  },
  lightCone: {
    position: "absolute",
    // translateX(-50%) baked into coneStyle via translateX(-360)
  },
  ringHost: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(108, 192, 255, 0.7)",
  },
  ring2: {
    borderColor: "rgba(108, 192, 255, 0.55)",
  },
  ring3: {
    borderColor: "rgba(170, 220, 255, 0.4)",
  },
  ground: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  radarHost: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(108, 192, 255, 0.25)",
  },
  trail: {
    position: "absolute",
    width: 90,
    marginLeft: -45,
    backgroundColor: "rgba(108, 192, 255, 0.6)",
    borderRadius: 45,
    opacity: 0,
  },
  sparkHost: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  spark: {
    position: "absolute",
    width: 5,
    height: 5,
    marginLeft: -2.5,
    marginTop: -2.5,
    borderRadius: 2.5,
    backgroundColor: "#ffffff",
    shadowColor: "#aaddff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  pinWrap: {
    position: "absolute",
  },
  pinImage: {
    width: "100%",
    height: "100%",
  },
});

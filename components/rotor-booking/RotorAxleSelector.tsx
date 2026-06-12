/**
 * RotorAxleSelector
 *
 * Hero component for the rotor-booking page. Renders the same top-down car
 * frame the tire flow uses but with two large axle hit-zones (front pair
 * and rear pair) instead of four individual wheel tap-targets. Tapping an
 * axle pair lights up both rotor disc icons on that axle.
 *
 * Brake jobs are always done in pairs per axle, so the customer never
 * picks a single rotor — only "front pair", "rear pair", or "all four"
 * (selecting both axles).
 */

import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { BrandColors } from "@/constants/theme";
import type { RotorAxle } from "@/constants/rotorFlow";

// ============================================================================
// ROTOR DISC ICON — multi-color brake-disc artwork from ~/Downloads/Brake Icon.svg.
// Drop-in: same {isSelected, size} signature; outer Animated.View /
// hit-zone / scale animation logic is unaffected.
// Two states:
//   - Idle    — multi-color art with the original navy + light blue
//               accents swapped for OtoPair brand blue.
//   - Selected — the round disc area (silhouette + body) tints to
//                BrandColors.secondary; spokes flip to white so the
//                cross pattern stays legible against the blue disc.
//                Center cream dot stays cream for contrast.
// ============================================================================

const ROTOR_BLUE = BrandColors.secondary; // #5299FE

function RotorIcon({ isSelected, size }: { isSelected: boolean; size: number }) {
  const silhouette = isSelected ? ROTOR_BLUE : "#000000";
  const ring = ROTOR_BLUE;
  const disc = isSelected ? ROTOR_BLUE : "#293241";
  const center = "#e0fbfc";
  const spokes = isSelected ? "#FFFFFF" : ROTOR_BLUE;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        fill={silhouette}
        d="M52.902 13.412v-1.148a1.5 1.5 0 0 0-1.5-1.5c-22.354 0-40.541 18.187-40.541 40.541a1.5 1.5 0 0 0 1.5 1.5h1.148C14.3 73.027 30.99 89.236 51.402 89.236c49.417-1.917 50.695-72.016 1.5-75.824z"
      />
      <Path
        fill={ring}
        d="M49.902 13.794c.02.512-.014 6.317 0 7.006-15.65.76-28.244 13.355-29.005 29.005-.684-.002-6.458.002-7.007 0 .772-19.509 16.503-35.24 36.012-36.011z"
      />
      <Path
        fill={disc}
        d="M51.402 86.236c-18.759 0-34.111-14.862-34.898-33.431h5.857a1.5 1.5 0 0 0 1.5-1.5c0-15.186 12.354-27.541 27.541-27.541a1.5 1.5 0 0 0 1.5-1.5v-5.858c45.216 3.645 43.936 68.08-1.5 69.83z"
      />
      <Path
        fill={silhouette}
        d="M51.402 29.333c-19.483.032-29.323 23.7-15.529 37.503 8.19 8.532 22.869 8.533 31.059 0 13.795-13.806 3.953-37.472-15.53-37.503z"
      />
      <Path
        fill={center}
        d="M51.402 57.03c-7.567-.228-7.565-11.223 0-11.45 7.568.228 7.567 11.223 0 11.45z"
      />
      <Path
        fill={spokes}
        d="M56.421 44.165a8.628 8.628 0 0 0-3.519-1.458V32.391c4 .312 7.753 1.87 10.808 4.486l-7.289 7.288zm-6.519-11.774v10.317a8.616 8.616 0 0 0-3.518 1.458l-7.289-7.289a18.79 18.79 0 0 1 10.807-4.486zm-12.928 6.607 7.288 7.289a8.626 8.626 0 0 0-1.457 3.519H32.489a18.79 18.79 0 0 1 4.485-10.808zm5.832 13.807a8.626 8.626 0 0 0 1.457 3.519l-7.288 7.289a18.789 18.789 0 0 1-4.485-10.808h10.316zm.164 9.054 3.414-3.414a8.635 8.635 0 0 0 3.518 1.458V70.22a18.797 18.797 0 0 1-10.807-4.486l3.875-3.875zm9.932 8.36V59.903a8.628 8.628 0 0 0 3.519-1.458l3.414 3.414 3.874 3.874a18.784 18.784 0 0 1-10.807 4.486zm12.929-6.607c-.084-.095-6.958-6.951-7.288-7.289A8.626 8.626 0 0 0 60 52.804h10.316a18.783 18.783 0 0 1-4.485 10.808zM60 49.805a8.632 8.632 0 0 0-1.457-3.519l7.288-7.289a18.789 18.789 0 0 1 4.485 10.807H60z"
      />
    </Svg>
  );
}

// ============================================================================
// LAYOUT — two horizontal axle hit-zones spanning the car
// ============================================================================

const AXLE_ROWS: Record<"front" | "rear", { topPct: number }> = {
  front: { topPct: 22 },
  rear: { topPct: 78 },
};

// Per-side rotor offsets (flank the car at the wheel positions).
const ROTOR_OFFSETS = { leftPct: -30, rightPct: 130 };

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
  /** Currently selected axle pair, or null. Single-select. */
  selected: RotorAxle | null;
  onSelect: (axle: RotorAxle | null) => void;
}

export function RotorAxleSelector({ selected, onSelect }: Props) {
  const frontActive = selected === "front" || selected === "both";
  const rearActive = selected === "rear" || selected === "both";

  // Tap toggles the axle pair: an already-selected pair deselects (removing
  // just that pair when "both" is selected), an unselected pair is added.
  const handleFront = () => {
    if (selected === "front") return onSelect(null);
    if (selected === "both") return onSelect("rear");
    if (selected === "rear") return onSelect("both");
    return onSelect("front");
  };
  const handleRear = () => {
    if (selected === "rear") return onSelect(null);
    if (selected === "both") return onSelect("front");
    if (selected === "front") return onSelect("both");
    return onSelect("rear");
  };

  return (
    <View style={styles.container}>
      <View style={styles.carFrame}>
        <Image
          source={require("@/assets/images/tire-picker-car-removebg-preview.png")}
          style={styles.carImage}
          resizeMode="contain"
        />

        {/* Axle hit-zones — full-width bars across the car, each contains a
            pair of rotor icons (one per side). Pressing the bar lights up
            both rotors on that axle. */}
        <AxleRow axle="front" isActive={frontActive} onPress={handleFront} />
        <AxleRow axle="rear" isActive={rearActive} onPress={handleRear} />
      </View>
    </View>
  );
}

// ============================================================================
// AXLE ROW — single pressable that toggles the whole axle pair
// ============================================================================

function AxleRow({
  axle,
  isActive,
  onPress,
}: {
  axle: "front" | "rear";
  isActive: boolean;
  onPress: () => void;
}) {
  const { topPct } = AXLE_ROWS[axle];
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(isActive ? 1.1 : 1, { damping: 22, stiffness: 240 });
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[styles.axleRow, { top: `${topPct}%` }]}
      pointerEvents="box-none"
    >
      <Pressable hitSlop={12} onPress={onPress} style={styles.axleHit}>
        {/* Left rotor */}
        <View style={[styles.rotorSlot, { left: `${ROTOR_OFFSETS.leftPct}%` }]}>
          <Animated.View style={animStyle}>
            <RotorIcon isSelected={isActive} size={ROTOR_SIZE} />
          </Animated.View>
        </View>
        {/* Right rotor */}
        <View style={[styles.rotorSlot, { left: `${ROTOR_OFFSETS.rightPct}%` }]}>
          <Animated.View style={animStyle}>
            <RotorIcon isSelected={isActive} size={ROTOR_SIZE} />
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const ROTOR_SIZE = 64;
const AXLE_HIT_HEIGHT = 84;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  carFrame: {
    width: 160,
    height: 240,
    position: "relative",
  },
  carImage: {
    width: 160,
    height: 240,
    position: "absolute",
    top: 0,
    left: 0,
  },
  axleRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: AXLE_HIT_HEIGHT,
    marginTop: -AXLE_HIT_HEIGHT / 2,
  },
  axleHit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rotorSlot: {
    position: "absolute",
    width: ROTOR_SIZE,
    height: ROTOR_SIZE,
    marginLeft: -ROTOR_SIZE / 2,
    top: (AXLE_HIT_HEIGHT - ROTOR_SIZE) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

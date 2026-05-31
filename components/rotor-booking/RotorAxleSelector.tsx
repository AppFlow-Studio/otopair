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
import Svg, { Circle, Path } from "react-native-svg";

import type { RotorAxle } from "@/constants/rotorFlow";

// ============================================================================
// ROTOR DISC ICON — vented brake rotor (cross-drilled / circular profile)
// ============================================================================

const ROTOR_IDLE_OUTER = "#1A1A1A";
const ROTOR_IDLE_INNER = "#37424C";
const ROTOR_SELECTED_OUTER = "#2E5EAD";
const ROTOR_SELECTED_INNER = "#5299FE";

function RotorIcon({ isSelected, size }: { isSelected: boolean; size: number }) {
  const outer = isSelected ? ROTOR_SELECTED_OUTER : ROTOR_IDLE_OUTER;
  const inner = isSelected ? ROTOR_SELECTED_INNER : ROTOR_IDLE_INNER;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Disc face */}
      <Circle cx={32} cy={32} r={28} fill={outer} />
      {/* Friction surface ring */}
      <Circle cx={32} cy={32} r={22} fill={inner} />
      {/* Hat (center hub) */}
      <Circle cx={32} cy={32} r={10} fill={outer} />
      {/* Cross-drilled holes — six around the friction face */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 32 + 16 * Math.cos(rad);
        const cy = 32 + 16 * Math.sin(rad);
        return <Circle key={deg} cx={cx} cy={cy} r={1.6} fill={outer} />;
      })}
      {/* Lug bolt circle */}
      <Circle cx={32} cy={32} r={3} fill={inner} />
      {/* Caliper hint — a soft bracket on the right side of the disc */}
      <Path
        d="M52 24 h4 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-4 z"
        fill={outer}
        opacity={0.6}
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
  onSelect: (axle: RotorAxle) => void;
}

export function RotorAxleSelector({ selected, onSelect }: Props) {
  const frontActive = selected === "front" || selected === "both";
  const rearActive = selected === "rear" || selected === "both";

  const handleFront = () => onSelect(selected === "front" ? "both" : "front");
  const handleRear = () => onSelect(selected === "rear" ? "both" : "rear");

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

/**
 * VehicleTireSelector3D
 *
 * 2D top-down SVG car with 4 tappable tire circles at the corners. The
 * file name is a historical artifact — we briefly attempted a real 3D
 * renderer (three.js / filament) and reverted. Keeping the name stable so
 * imports elsewhere don't need to change.
 *
 * PROPS: `selected` (TirePosition[]) + `onTogglePosition` callback.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import type { TirePosition } from "@/stores/useTireBookingStore";

// ============================================================================
// LAYOUT / GEOMETRY
// ============================================================================

// The SVG is drawn in a normalized 200×360 viewBox (portrait, top-down car).
// Tire centers are in the SAME coordinate space and then converted to
// percentages so the tires scale with whatever the container ends up being.
const VIEWBOX_W = 200;
const VIEWBOX_H = 360;

const TIRE_CENTERS: Record<TirePosition, { cx: number; cy: number }> = {
  FL: { cx: 28, cy: 78 },
  FR: { cx: 172, cy: 78 },
  RL: { cx: 28, cy: 282 },
  RR: { cx: 172, cy: 282 },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
  selected: TirePosition[];
  onTogglePosition: (p: TirePosition) => void;
}

export function VehicleTireSelector3D({ selected, onTogglePosition }: Props) {
  return (
    <View style={styles.container}>
      {/* Car illustration (SVG background) */}
      <View style={StyleSheet.absoluteFill}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <LinearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3B4756" />
              <Stop offset="1" stopColor="#2C3640" />
            </LinearGradient>
            <LinearGradient id="glassGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1B2836" />
              <Stop offset="1" stopColor="#0D1620" />
            </LinearGradient>
          </Defs>

          {/* Car body — rounded rect fills the center */}
          <Rect
            x={38}
            y={20}
            width={124}
            height={320}
            rx={40}
            ry={40}
            fill="url(#bodyGradient)"
          />

          {/* Hood highlight */}
          <Rect x={56} y={32} width={88} height={40} rx={12} fill="#46525F" opacity={0.45} />

          {/* Windshield */}
          <Rect x={52} y={96} width={96} height={70} rx={10} fill="url(#glassGradient)" />

          {/* Roof */}
          <Rect x={60} y={176} width={80} height={28} rx={8} fill="#1F2A36" />

          {/* Rear window */}
          <Rect x={52} y={214} width={96} height={60} rx={10} fill="url(#glassGradient)" />

          {/* Trunk hint */}
          <Rect x={56} y={286} width={88} height={32} rx={10} fill="#46525F" opacity={0.45} />
        </Svg>
      </View>

      {/* Tappable tires as positioned overlays so touch is rock-solid. */}
      {(Object.keys(TIRE_CENTERS) as TirePosition[]).map((pos) => (
        <Tire
          key={pos}
          position={pos}
          isSelected={selected.includes(pos)}
          onPress={() => onTogglePosition(pos)}
        />
      ))}
    </View>
  );
}

// ============================================================================
// TIRE — individual pressable at a percentage-positioned corner
// ============================================================================

function Tire({
  position,
  isSelected,
  onPress,
}: {
  position: TirePosition;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { cx, cy } = TIRE_CENTERS[position];
  const leftPct = (cx / VIEWBOX_W) * 100;
  const topPct = (cy / VIEWBOX_H) * 100;

  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(isSelected ? 1.15 : 1, { damping: 9, stiffness: 220 });
  }, [isSelected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[
        styles.tireWrap,
        { left: `${leftPct}%`, top: `${topPct}%` },
      ]}
      pointerEvents="box-none"
    >
      <Pressable hitSlop={10} onPress={onPress} style={styles.tireHitArea}>
        <Animated.View
          style={[
            styles.tireCircle,
            isSelected ? styles.tireCircleSelected : styles.tireCircleIdle,
            animStyle,
          ]}
        >
          <View style={[styles.tireHub, isSelected && styles.tireHubSelected]} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const TIRE_SIZE = 56;
const TIRE_HIT_SIZE = 76;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    borderRadius: 20,
    overflow: "hidden",
  },
  tireWrap: {
    position: "absolute",
    width: TIRE_HIT_SIZE,
    height: TIRE_HIT_SIZE,
    marginLeft: -TIRE_HIT_SIZE / 2,
    marginTop: -TIRE_HIT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tireHitArea: {
    width: TIRE_HIT_SIZE,
    height: TIRE_HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  tireCircle: {
    width: TIRE_SIZE,
    height: TIRE_SIZE,
    borderRadius: TIRE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  tireCircleIdle: {
    backgroundColor: "#1A1A1A",
    borderColor: "#3C3C43",
  },
  tireCircleSelected: {
    backgroundColor: "#5299FE",
    borderColor: "#FFFFFF",
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  tireHub: {
    width: TIRE_SIZE * 0.4,
    height: TIRE_SIZE * 0.4,
    borderRadius: (TIRE_SIZE * 0.4) / 2,
    backgroundColor: "#BFC3C9",
  },
  tireHubSelected: {
    backgroundColor: "#FFFFFF",
  },
});

/**
 * TireGridBackground
 *
 * PURPOSE: Seamlessly-looping isometric tire-grid backdrop for the
 *          `(tire-booking)/requesting` route. Ported from the Apr 23 Claude
 *          Design handoff v2 (`lottie/project/tire.jsx` + `tire-grid.jsx`).
 *
 *          v2 design differences from v1:
 *          - Near-black rubber body (#15161A) w/ radial gradient highlights
 *            instead of warm graphite.
 *          - Silver-alloy rim (#D9DEE6) with 5-star spokes drawn as filled
 *            paths (previously thin line spokes on graphite).
 *          - Three circumferential tread channels visible on the top surface
 *            (concentric ellipse strokes at ~88%, 76%, 65% radius).
 *          - Taller sidewall (~34% of rx vs ~18% before) reading as a more
 *            substantial tire silhouette.
 *          - Tighter grid spacing: TILE_W = size × 1.15, TILE_H = size × 0.78
 *            (was 2.6 × 1.55). Higher density on screen.
 *          - Solo tires only — no stacked-pair variant.
 *
 *          Animation is unchanged: 400 ms opacity fade-in + infinite linear
 *          drift of (−TILE_W, +TILE_H·2) over 10 s, keyed seamless.
 *
 * USED IN: app/(tire-booking)/requesting.tsx
 *
 * OWNER: Ahmad Hamoudeh (design by Claude Design)
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Line,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

// ============================================================================
// PALETTE (from handoff v2 — keep in sync with tire.jsx)
// ============================================================================

const OTO = {
  bg: "#CFE4F7",
  tire: "#15161A",
  tireHi: "#2A2C32",
  tireShadow: "#08090B",
  treadLine: "#2E3036",
  rim: "#D9DEE6",
  rimHi: "#F2F5FA",
  rimShadow: "#7F8A99",
  rimDeep: "#4A5462",
};

// ============================================================================
// TIRE GEOMETRY — design-space canvas 240×160, so the symbol is wider than
// tall (isometric squish for laid-flat perspective).
// ============================================================================

const VB_W = 240;
const VB_H = 160;
const PAD = 8;

function buildGeometry() {
  const rx = (VB_W - PAD * 2) / 2;
  const ry = rx * 0.48;
  const sidewallDepth = rx * 0.34;
  const cx = VB_W / 2;
  const cy = PAD + ry;
  const innerRx = rx * 0.44;
  const innerRy = ry * 0.44;
  const rimRx = rx * 0.58;
  const rimRy = ry * 0.58;
  const hubR = innerRx * 0.3;
  const hubInnerR = innerRx * 0.14;
  return { rx, ry, sidewallDepth, cx, cy, innerRx, innerRy, rimRx, rimRy, hubR, hubInnerR };
}

const G = buildGeometry();

// Short radial strokes along the front half of the sidewall band.
const SIDEWALL_TREADS = (() => {
  const out: Array<{ x: number; yTop: number; yBot: number }> = [];
  const n = 20;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI;
    const x = G.cx + Math.cos(Math.PI + t) * G.rx;
    const yTop = G.cy + Math.sin(Math.PI + t) * G.ry;
    const yBot = yTop + G.sidewallDepth;
    out.push({ x, yTop: yTop + 2, yBot: yBot - 2 });
  }
  return out;
})();

// Radial ticks around the outer ellipse of the tread surface.
const TOP_TICKS = (() => {
  const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({
      x1: G.cx + Math.cos(a) * G.rx * 0.97,
      y1: G.cy + Math.sin(a) * G.ry * 0.97,
      x2: G.cx + Math.cos(a) * G.rx * 0.88,
      y2: G.cy + Math.sin(a) * G.ry * 0.88,
    });
  }
  return out;
})();

// 5-star alloy spokes — filled quad paths radiating from the hub bridge.
const SPOKE_PATHS = (() => {
  const paths: string[] = [];
  const n = 5;
  const innerHalf = 0.22;
  const outerHalf = 0.34;
  const innerRad = G.hubR * 1.4;
  const outerRadX = G.innerRx * 0.9;
  const outerRadY = G.innerRy * 0.9;
  const aspect = G.innerRy / G.innerRx;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = angle - innerHalf;
    const a2 = angle + innerHalf;
    const a3 = angle + outerHalf;
    const a4 = angle - outerHalf;
    const p1x = G.cx + Math.cos(a1) * innerRad;
    const p1y = G.cy + Math.sin(a1) * innerRad * aspect;
    const p2x = G.cx + Math.cos(a2) * innerRad;
    const p2y = G.cy + Math.sin(a2) * innerRad * aspect;
    const p3x = G.cx + Math.cos(a3) * outerRadX;
    const p3y = G.cy + Math.sin(a3) * outerRadY;
    const p4x = G.cx + Math.cos(a4) * outerRadX;
    const p4y = G.cy + Math.sin(a4) * outerRadY;
    paths.push(`M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y} Z`);
  }
  return paths;
})();

// ============================================================================
// TIRE — one laid-flat tire rendered inline (no shared <symbol> because
// react-native-svg's def scope is per-Svg; each instance duplicates the defs).
// Memoized child arrays keep per-render cost low.
// ============================================================================

function TireSvg({ size = 120 }: { size?: number }) {
  const w = size;
  const h = (size / VB_W) * VB_H;
  // Unique-ish gradient ids — using the tire size is enough because every
  // Svg has its own def scope, but keeping ids stable across renders avoids
  // churn on the native side.
  const ids = useMemo(
    () => ({
      body: `oto-tire-body-${size}`,
      side: `oto-tire-side-${size}`,
      spoke: `oto-tire-spoke-${size}`,
      hub: `oto-tire-hub-${size}`,
    }),
    [size],
  );

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <RadialGradient id={ids.body} cx="50%" cy="45%" r="60%">
          <Stop offset="65%" stopColor={OTO.tire} />
          <Stop offset="95%" stopColor={OTO.tireHi} />
          <Stop offset="100%" stopColor={OTO.tireShadow} />
        </RadialGradient>
        <LinearGradient id={ids.side} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={OTO.tireShadow} />
          <Stop offset="100%" stopColor={OTO.tire} />
        </LinearGradient>
        <LinearGradient id={ids.spoke} x1="20%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor={OTO.rimHi} />
          <Stop offset="55%" stopColor={OTO.rim} />
          <Stop offset="100%" stopColor={OTO.rimShadow} />
        </LinearGradient>
        <RadialGradient id={ids.hub} cx="40%" cy="35%" r="60%">
          <Stop offset="0%" stopColor={OTO.rimHi} />
          <Stop offset="70%" stopColor={OTO.rim} />
          <Stop offset="100%" stopColor={OTO.rimShadow} />
        </RadialGradient>
      </Defs>

      {/* Sidewall band — the depth of the tire, front-facing bottom half. */}
      <Path
        d={`M ${G.cx - G.rx} ${G.cy} L ${G.cx - G.rx} ${G.cy + G.sidewallDepth} A ${G.rx} ${G.ry} 0 0 0 ${G.cx + G.rx} ${G.cy + G.sidewallDepth} L ${G.cx + G.rx} ${G.cy} A ${G.rx} ${G.ry} 0 0 1 ${G.cx - G.rx} ${G.cy} Z`}
        fill={`url(#${ids.side})`}
      />

      {/* Chunky tread blocks on sidewall */}
      {SIDEWALL_TREADS.map((b, i) => (
        <Line
          key={`sw${i}`}
          x1={b.x}
          y1={b.yTop}
          x2={b.x}
          y2={b.yBot}
          stroke={OTO.tireShadow}
          strokeWidth={2.2}
          opacity={0.9}
        />
      ))}

      {/* Bottom edge lip */}
      <Path
        d={`M ${G.cx - G.rx} ${G.cy + G.sidewallDepth} A ${G.rx} ${G.ry} 0 0 0 ${G.cx + G.rx} ${G.cy + G.sidewallDepth}`}
        fill="none"
        stroke={OTO.tireShadow}
        strokeWidth={1.5}
        opacity={0.8}
      />

      {/* Top tread surface */}
      <Ellipse cx={G.cx} cy={G.cy} rx={G.rx} ry={G.ry} fill={`url(#${ids.body})`} />

      {/* Circumferential tread channels */}
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.rx * 0.88}
        ry={G.ry * 0.88}
        fill="none"
        stroke={OTO.treadLine}
        strokeWidth={1.8}
        opacity={0.85}
      />
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.rx * 0.76}
        ry={G.ry * 0.76}
        fill="none"
        stroke={OTO.treadLine}
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.rx * 0.65}
        ry={G.ry * 0.65}
        fill="none"
        stroke={OTO.treadLine}
        strokeWidth={1.2}
        opacity={0.6}
      />

      {/* Top-light ring */}
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.rx * 0.995}
        ry={G.ry * 0.995}
        fill="none"
        stroke={OTO.tireHi}
        strokeWidth={1}
        opacity={0.55}
      />

      {/* Radial tread ticks */}
      {TOP_TICKS.map((t, i) => (
        <Line
          key={`tk${i}`}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={OTO.tireShadow}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.55}
        />
      ))}

      {/* Inner step (tread-to-rim shadow ring) */}
      <Ellipse cx={G.cx} cy={G.cy} rx={G.rimRx * 1.08} ry={G.rimRy * 1.08} fill={OTO.tireShadow} />

      {/* Alloy rim face + outer highlight */}
      <Ellipse cx={G.cx} cy={G.cy} rx={G.rimRx} ry={G.rimRy} fill={OTO.rimDeep} />
      <Ellipse cx={G.cx} cy={G.cy} rx={G.rimRx * 0.95} ry={G.rimRy * 0.95} fill={OTO.rimShadow} />
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.rimRx}
        ry={G.rimRy}
        fill="none"
        stroke={OTO.rimHi}
        strokeWidth={0.8}
        opacity={0.7}
      />

      {/* Rim cavity */}
      <Ellipse cx={G.cx} cy={G.cy} rx={G.innerRx} ry={G.innerRy} fill={OTO.rimDeep} />

      {/* 5-star alloy spokes */}
      {SPOKE_PATHS.map((d, i) => (
        <Path key={`sp${i}`} d={d} fill={`url(#${ids.spoke})`} />
      ))}

      {/* Spoke bridge ring around hub */}
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.hubR * 1.4}
        ry={G.hubR * 1.4 * (G.innerRy / G.innerRx)}
        fill={OTO.rim}
      />
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.hubR * 1.4}
        ry={G.hubR * 1.4 * (G.innerRy / G.innerRx)}
        fill="none"
        stroke={OTO.rimShadow}
        strokeWidth={0.6}
        opacity={0.5}
      />

      {/* Hub cap */}
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.hubR}
        ry={G.hubR * (G.innerRy / G.innerRx)}
        fill={`url(#${ids.hub})`}
      />
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.hubR}
        ry={G.hubR * (G.innerRy / G.innerRx)}
        fill="none"
        stroke={OTO.rimShadow}
        strokeWidth={0.6}
        opacity={0.6}
      />

      {/* Hub center boss */}
      <Ellipse
        cx={G.cx}
        cy={G.cy}
        rx={G.hubInnerR}
        ry={G.hubInnerR * (G.innerRy / G.innerRx)}
        fill={OTO.rimShadow}
      />
    </Svg>
  );
}

// ============================================================================
// GRID
// ============================================================================

interface GridProps {
  width: number;
  height: number;
  /** Base tire diameter (width) in px. Controls density. Default matches the handoff's small-tile size. */
  tileSize?: number;
  /** Loop duration in seconds. Default 10. */
  duration?: number;
}

interface Cell {
  x: number;
  y: number;
  key: string;
}

export function TireGridBackground({
  width,
  height,
  tileSize = 120,
  duration = 10,
}: GridProps) {
  // Spacing per handoff v2 — horizontal step is only 1.15× tire width because
  // tires are laid flat (wider than tall in design space).
  const TILE_W = tileSize * 1.15;
  const TILE_H = tileSize * 0.78;
  const ROW_OFFSET = TILE_W / 2;

  const overscanX = TILE_W + tileSize;
  const overscanY = TILE_H * 2 + tileSize;
  const gridW = width + overscanX * 2;
  const gridH = height + overscanY * 2;

  const cols = Math.ceil(gridW / TILE_W) + 2;
  const rows = Math.ceil(gridH / TILE_H) + 2;

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = [];
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const stagger = r % 2 === 0 ? 0 : ROW_OFFSET;
        const x = c * TILE_W + stagger;
        const y = r * TILE_H;
        out.push({ x, y, key: `${r}_${c}` });
      }
    }
    return out;
  }, [rows, cols, TILE_W, TILE_H, ROW_OFFSET]);

  // Seamless drift: exactly one tile W horizontally, two rows vertically
  // so the brick-stagger repeat period lines up pixel-perfect.
  const driftX = -TILE_W;
  const driftY = TILE_H * 2;

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
    progress.value = withRepeat(
      withTiming(1, { duration: duration * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duration, opacity, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: progress.value * driftX },
      { translateY: progress.value * driftY },
    ],
  }));

  return (
    <View style={[styles.viewport, { width, height, backgroundColor: OTO.bg }]}>
      <Animated.View
        style={[
          styles.gridLayer,
          { width: gridW, height: gridH, left: -overscanX, top: -overscanY },
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        {cells.map((cell) => (
          <View
            key={cell.key}
            style={{ position: "absolute", left: cell.x, top: cell.y }}
          >
            <TireSvg size={tileSize} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  gridLayer: {
    position: "absolute",
  },
});

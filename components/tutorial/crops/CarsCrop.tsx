/**
 * CarsCrop — the health ring, and one service that is due.
 *
 * The sweep IS the explanation. A static 72% is a number; a ring filling to 72
 * while the +17% ticks up beside it shows that the score is a live thing a
 * service moves. That is the one idea this step has to land, so it is the one
 * thing that animates.
 *
 * 72 AND AMBER, deliberately. Showing a perfect score would quietly undercut
 * the reason the app exists — the first Otopair car a driver ever sees should
 * have something to do. Flagged to the PM as a conscious call rather than an
 * accident of the mock data. See the Figma "Open Questions" panel.
 *
 * The ring is drawn with the same stroke-dash technique as the real one in
 * `components/cars/SquircleRing.tsx`, so the arc geometry matches what the
 * Cars tab renders rather than being a lookalike.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { BrandColors, FontFamily } from "@/constants/theme";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../PhoneMock";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const INK = BrandColors.primary;
const ACCENT = BrandColors.secondary;
const MUTED = "#5A6675";
const AMBER = "#F5C423";
const RED = "#EF4444";
const GREEN = "#1B9E63";

const SIZE = 104;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** The score the ring settles on, and the gain the service buys back. */
const TARGET = 0.72;
const DELTA = 17;

export function CarsCrop({ play, reduceMotion }: { play: boolean; reduceMotion: boolean }) {
  const sweep = useSharedValue(reduceMotion ? TARGET : 0);
  const [shown, setShown] = useState(reduceMotion ? Math.round(TARGET * 100) : 0);
  const [delta, setDelta] = useState(reduceMotion ? DELTA : 0);

  useEffect(() => {
    if (reduceMotion) {
      sweep.value = TARGET;
      setShown(Math.round(TARGET * 100));
      setDelta(DELTA);
      return;
    }
    if (!play) {
      sweep.value = 0;
      setShown(0);
      setDelta(0);
      return;
    }
    sweep.value = withDelay(
      120,
      withTiming(TARGET, { duration: 700, easing: Easing.bezier(0, 0, 0.2, 1) }),
    );
  }, [play, reduceMotion, sweep]);

  // The two numbers ride the same shared value as the arc, so they cannot
  // drift out of step with it — a count-up on its own timer would.
  useAnimatedReaction(
    () => sweep.value,
    (v) => {
      runOnJS(setShown)(Math.round(v * 100));
      runOnJS(setDelta)(Math.round((v / TARGET) * DELTA));
    },
    [],
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - sweep.value),
  }));

  return (
    <View style={styles.root}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#E0E8EF" strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={AMBER}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            animatedProps={arcProps}
            // Start at twelve o'clock rather than three, matching the ring on
            // the Cars tab.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={styles.pct}>{shown}%</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <Text style={styles.chipText}>NOW</Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            Oil Change
          </Text>
          <Text style={styles.delta}>+{delta}%</Text>
        </View>
        <Text style={styles.detail}>Mileage interval reached · 6 months left</Text>
        <View style={styles.book}>
          <Text style={styles.bookText}>Book Service</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#F2F6F9" },
  ringWrap: { position: "absolute", left: (SCREEN_WIDTH - SIZE) / 2, top: 34, width: SIZE, height: SIZE },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pct: { fontFamily: FontFamily.bold, fontSize: 26, color: INK },
  card: {
    position: "absolute",
    left: 12,
    top: 176,
    width: 176,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 13,
    gap: 8,
    shadowColor: "#141C24",
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: "rgba(239,68,68,0.09)",
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  chipText: { fontFamily: FontFamily.bold, fontSize: 9, letterSpacing: 0.7, color: RED },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, fontFamily: FontFamily.bold, fontSize: 14, color: INK },
  delta: { fontFamily: FontFamily.bold, fontSize: 13, color: GREEN },
  detail: { fontFamily: FontFamily.medium, fontSize: 11.5, lineHeight: 16, color: MUTED },
  book: {
    height: 32,
    borderRadius: 9,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  bookText: { fontFamily: FontFamily.semiBold, fontSize: 12.5, color: "#FFFFFF" },
});

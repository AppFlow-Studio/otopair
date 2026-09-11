/**
 * BookingsCrop — a live job, mid-flight.
 *
 * The card is the one from the walk-in tracker, so a driver who has followed a
 * shop's link already recognises this shape. Two stages done, one live, two
 * ahead: a completed job would be a receipt, and an unstarted one would have
 * nothing to say.
 *
 * BEAT: the stages fill in sequence and stop on the live one, which then
 * pulses. The sequence is what makes it read as progress rather than a
 * checklist someone already ticked.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { BrandColors, FontFamily } from "@/constants/theme";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../PhoneMock";

const INK = BrandColors.primary;
const ACCENT = BrandColors.secondary;
const MUTED = "#5A6675";
const DIM = "#D0D7E1";

type StageState = "done" | "live" | "next";
const STAGES: { label: string; state: StageState }[] = [
  { label: "Checked in", state: "done" },
  { label: "In the bay", state: "done" },
  { label: "Quality check", state: "live" },
  { label: "Ready for pickup", state: "next" },
];

/** Gap between stage reveals. Slow enough to read as a sequence, fast enough
 *  that the whole run is over before the driver looks away. */
const STAGGER = 90;

function Stage({
  label,
  state,
  index,
  play,
  reduceMotion,
}: {
  label: string;
  state: StageState;
  index: number;
  play: boolean;
  reduceMotion: boolean;
}) {
  const fill = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      fill.value = 1;
      return;
    }
    if (!play) {
      fill.value = 0;
      return;
    }
    fill.value = withDelay(
      120 + index * STAGGER,
      withTiming(1, { duration: 220, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
    if (state === "live") {
      // Same 1s in/out breath the tracker's own status chips use, so a driver
      // who has seen the real screen recognises the rhythm.
      pulse.value = withDelay(
        120 + index * STAGGER + 220,
        withRepeat(
          withSequence(withTiming(0.45, { duration: 1000 }), withTiming(1, { duration: 1000 })),
          -1,
        ),
      );
    }
  }, [play, reduceMotion, index, state, fill, pulse]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: state === "next" ? fill.value * 0.55 : fill.value,
    transform: [{ translateX: (1 - fill.value) * -6 }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: state === "live" ? pulse.value : 1,
  }));

  return (
    <Animated.View style={[styles.stageRow, rowStyle]}>
      <Animated.View
        style={[
          styles.dot,
          state === "done" && styles.dotDone,
          state === "live" && styles.dotLive,
          state === "next" && styles.dotNext,
          dotStyle,
        ]}
      />
      <Text
        style={[
          styles.stageLabel,
          state === "live" && styles.stageLabelLive,
          state === "next" && styles.stageLabelNext,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export function BookingsCrop({ play, reduceMotion }: { play: boolean; reduceMotion: boolean }) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.shop} numberOfLines={1}>
          CHELALA SERVICE CENTER
        </Text>
        <Text style={styles.vehicle} numberOfLines={1}>
          Your 2020 Audi Q5
        </Text>

        <View style={styles.timeline}>
          {STAGES.map((s, i) => (
            <Stage
              key={s.label}
              label={s.label}
              state={s.state}
              index={i}
              play={play}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>

        <View style={styles.eta}>
          <Text style={styles.etaLabel}>ESTIMATED READY</Text>
          <Text style={styles.etaValue}>Today by ~4:30 PM</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#F2F6F9" },
  card: {
    position: "absolute",
    left: 12,
    top: 78,
    width: 176,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12,
    shadowColor: "#141C24",
    shadowOpacity: 0.13,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  shop: { fontFamily: FontFamily.semiBold, fontSize: 9.5, letterSpacing: 0.6, color: MUTED },
  vehicle: { fontFamily: FontFamily.bold, fontSize: 14.5, color: INK },
  timeline: { gap: 11 },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  dotDone: { backgroundColor: ACCENT },
  dotLive: { backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: ACCENT },
  dotNext: { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: DIM },
  stageLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: 11.5, color: MUTED },
  stageLabelLive: { fontFamily: FontFamily.bold, color: INK },
  stageLabelNext: { color: DIM },
  eta: {
    borderRadius: 11,
    backgroundColor: "rgba(82,153,254,0.09)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 2,
  },
  etaLabel: { fontFamily: FontFamily.semiBold, fontSize: 8.5, letterSpacing: 0.6, color: "#2A6BC7" },
  etaValue: { fontFamily: FontFamily.bold, fontSize: 14, color: INK },
});

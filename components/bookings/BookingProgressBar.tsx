/**
 * BookingProgressBar
 *
 * Uber-Eats-style segmented progress bar shown at the top of every
 * booking card. Each segment ≤ `currentIndex` gets filled with the
 * brand color; the segment immediately AFTER the last filled one
 * runs a left→right "loading sweep" animation to signal it's the
 * next stage in flight. -1 renders a fully-empty bar (used for
 * cancelled bookings — no sweep).
 *
 * USED IN:
 *   - components/bookings/BookingCard.tsx (service bookings)
 *   - components/bookings/PendingQuoteCard.tsx (tire-quote bookings)
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";

interface Props {
  /** Stage labels — array length determines the number of segments. */
  stages: readonly string[];
  /** Set false where the surrounding card already names the state (e.g. a
   *  status pill beside the title), so the bar contributes progress rather
   *  than a second, differently-worded status line. */
  showStageLabel?: boolean;
  /** Render for a dark surface. The default unfilled track (#E5E7EB) is a
   *  light grey built for white cards and glares on navy. */
  onDark?: boolean;
  /** 0-based index of the highest filled segment. -1 = none filled. */
  currentIndex: number;
  /** Optional headline (e.g., "Now arriving 2:55 - 3:00 PM"). */
  title?: string;
  /** Optional small subtitle (e.g., "Latest arrival by 3:25 PM"). */
  subtitle?: string;
}

export function BookingProgressBar({
  stages,
  currentIndex,
  showStageLabel = true,
  onDark = false,
  title,
  subtitle,
}: Props) {
  const safeIndex = Math.min(currentIndex, stages.length - 1);
  const nextIndex =
    safeIndex >= 0 && safeIndex < stages.length - 1 ? safeIndex + 1 : -1;

  return (
    <View style={styles.container}>
      {title ? (
        <Text size="md" weight="bold" color="#1F2937" center style={styles.title}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text size="xs" weight="regular" color="#6B7280" center style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.track}>
        {stages.map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              onDark && styles.segmentOnDark,
              i <= safeIndex && styles.segmentFilled,
            ]}
          >
            {i === nextIndex ? <SegmentSweep /> : null}
          </View>
        ))}
      </View>
      {/* Current-stage label sits under the bar so the card retains
          glance-readability without listing all segments by name. */}
      {showStageLabel && safeIndex >= 0 ? (
        <Text size="sm" weight="semiBold" color="#1F2937" center style={styles.currentStage}>
          {stages[safeIndex]}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Repeating left-edge fill that grows from 0% → 100% width and snaps
 * back, mimicking Uber Eats' "next stage loading" hint. Lives inside
 * the gray pending segment so the sweep paints in brand color over
 * the gray base.
 */
function SegmentSweep() {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 2400,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    // Fade out the last bit of the sweep so the snap-back to 0% reads
    // as a clean dissolve rather than an abrupt jump.
    opacity: progress.value < 0.92 ? 1 : 1 - (progress.value - 0.92) / 0.08,
  }));

  return <Animated.View style={[styles.sweep, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 6,
  },
  title: {
    marginBottom: 2,
  },
  subtitle: {
    marginBottom: 4,
  },
  track: {
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  segmentOnDark: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  segmentFilled: {
    backgroundColor: "#5299FE",
  },
  sweep: {
    height: "100%",
    backgroundColor: "#5299FE",
    opacity: 0.55,
  },
  currentStage: {
    marginTop: 4,
  },
});

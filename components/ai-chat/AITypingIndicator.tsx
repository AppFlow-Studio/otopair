/**
 * AITypingIndicator
 *
 * PURPOSE: Spinning starburst + rotating status text shown while Oto is
 *   processing. The text cycles through a curated list every ~1.8s with
 *   a soft fade between strings, giving the chat a richer "AI is doing
 *   something" feel than a silent spinner alone.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when isProcessing is true)
 *
 * PROPS: None
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { Text } from '@/components/shared-ui';
import { BrandColors, FontFamily, Spacing } from '@/constants/theme';

const SIZE = 28;
const NUM_SPOKES = 14;
const INNER_RADIUS = SIZE * 0.16;
const OUTER_RADIUS = SIZE * 0.46;
const STROKE_WIDTH = 1.6;

// Rotation period between status strings. 1800ms reads as deliberate
// (each phrase has time to land) without feeling sluggish.
const STATUS_INTERVAL_MS = 1800;
const STATUS_FADE_MS = 250;

// Fallback lines when the user's message doesn't map to a specific topic.
const GENERAL_STATUSES = [
  "Thinking through the best next step",
  "Cross-checking your maintenance records",
  "Lining up what you might need",
  "Working through the details",
] as const;

// Topic-matched status lines. The first keyword hit picks the set, so a
// brake question narrates brake work and a booking narrates shop work —
// instead of every ask cycling the same generic phrases. Ordered most-
// specific first so "check engine" beats a bare "service".
const TOPIC_STATUSES: { keywords: string[]; statuses: string[] }[] = [
  {
    keywords: ["check engine", "engine light", "warning light", "dashboard light", "diagnostic", "trouble code", " code", "cel"],
    statuses: [
      "Looking up the warning-light details",
      "Cross-checking diagnostic codes",
      "Working through what the light means",
    ],
  },
  {
    keywords: ["brake", "rotor", "pad", "squeal", "grind", "caliper"],
    statuses: [
      "Reviewing your brake service history",
      "Checking pad and rotor wear",
      "Working through the brake symptoms",
    ],
  },
  {
    keywords: ["oil change", "oil ", "oil,", "oil.", "oil filter"],
    statuses: [
      "Checking your oil-change intervals",
      "Reviewing when your oil was last done",
      "Lining up the right oil service",
    ],
  },
  {
    keywords: ["tire", "tyre", "tpms", "tread", "rotation", "wheel", "alignment", "flat"],
    statuses: [
      "Pulling your tire service history",
      "Checking tread and pressure notes",
      "Looking at recent tire work",
    ],
  },
  {
    keywords: ["battery", "alternator", "won't start", "wont start", "jump start", "electrical", "dead battery"],
    statuses: [
      "Checking your battery and charging history",
      "Reviewing recent electrical work",
      "Working through the starting issue",
    ],
  },
  {
    keywords: ["coolant", "overheat", "radiator", "antifreeze", "temperature gauge"],
    statuses: [
      "Checking your cooling-system history",
      "Reviewing recent coolant service",
      "Working through the overheating clue",
    ],
  },
  {
    keywords: ["transmission", "gear", "shift", "clutch", "driveline"],
    statuses: [
      "Reviewing your transmission history",
      "Checking recent driveline work",
      "Working through the shifting issue",
    ],
  },
  {
    keywords: ["mileage", "miles", "odometer"],
    statuses: [
      "Checking your mileage record",
      "Updating your odometer history",
      "Reviewing your mileage log",
    ],
  },
  {
    keywords: ["book", "schedule", "appointment", "mechanic", "shop", "availability", "slot", "reschedule"],
    statuses: [
      "Finding highly-rated mechanics nearby",
      "Checking shop availability",
      "Lining up appointment times",
    ],
  },
  {
    keywords: ["cost", "price", "how much", "quote", "estimate", "expensive", "cheap"],
    statuses: [
      "Estimating parts and labor",
      "Checking shop pricing",
      "Working out a fair estimate",
    ],
  },
  {
    keywords: ["service", "maintenance", "due", "overdue", "interval", "inspection"],
    statuses: [
      "Reviewing your maintenance schedule",
      "Checking what's due soon",
      "Cross-checking your service records",
    ],
  },
  {
    keywords: ["noise", "sound", "vibration", "shake", "smell", "leak", "feels", "feel", "rattle", "clunk", "off"],
    statuses: [
      "Working through the symptoms you described",
      "Cross-checking against your service history",
      "Narrowing down the likely cause",
    ],
  },
];

function getStatusesForMessage(message?: string): readonly string[] {
  if (!message) return GENERAL_STATUSES;
  const lower = ` ${message.toLowerCase()} `;
  for (const topic of TOPIC_STATUSES) {
    if (topic.keywords.some((k) => lower.includes(k))) {
      return topic.statuses;
    }
  }
  return GENERAL_STATUSES;
}

interface AITypingIndicatorProps {
  /** The user's latest message. Drives topic-matched status lines so the
   *  loading narration reflects what was actually asked. */
  userMessage?: string;
}

export function AITypingIndicator({ userMessage }: AITypingIndicatorProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const textOpacity = useSharedValue(1);
  const [statusIndex, setStatusIndex] = useState(0);

  // Resolve the topic set once per message. Start each cycle at the first
  // (most on-topic) line so the user immediately sees a relevant status.
  const statuses = useMemo(() => getStatusesForMessage(userMessage), [userMessage]);
  useEffect(() => {
    setStatusIndex(0);
  }, [statuses]);

  useEffect(() => {
    // Continuous rotation — completes a full turn every ~2.4s.
    rotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
    // Gentle pulse — 1.0 → 1.12 → 1.0, ~1.6s per cycle.
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    // Rotating status text: fade out → swap text → fade in. Repeats
    // every STATUS_INTERVAL_MS while the indicator is mounted.
    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: STATUS_FADE_MS, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: STATUS_FADE_MS, easing: Easing.in(Easing.ease) }),
      );
      // Swap the displayed string mid-fade so the user never sees both.
      setTimeout(() => {
        setStatusIndex((prev) => (prev + 1) % statuses.length);
      }, STATUS_FADE_MS);
    }, STATUS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [statuses.length]);

  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.burst, burstStyle]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {Array.from({ length: NUM_SPOKES }).map((_, i) => {
            const angle = (i / NUM_SPOKES) * Math.PI * 2;
            const lengthFactor = 0.88 + Math.sin(i * 1.3) * 0.12;
            const cx = SIZE / 2;
            const cy = SIZE / 2;
            const x1 = cx + Math.cos(angle) * INNER_RADIUS;
            const y1 = cy + Math.sin(angle) * INNER_RADIUS;
            const x2 = cx + Math.cos(angle) * OUTER_RADIUS * lengthFactor;
            const y2 = cy + Math.sin(angle) * OUTER_RADIUS * lengthFactor;
            return (
              <Line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={BrandColors.secondary}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={styles.statusText} weight="medium" numberOfLines={1}>
          {statuses[statusIndex]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  burst: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: FontFamily.medium,
  },
});

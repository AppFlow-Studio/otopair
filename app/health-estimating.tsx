import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMutation } from "convex/react";

import { Text } from "@/components/shared-ui";
import { scale, verticalScale, moderateScale } from "@/utils/responsive";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { fetchVehicleImageUrl } from "@/utils/vehicleImage";
import { api } from "@/convex/_generated/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_PATH_LENGTH = 24;

// ============================================================================
// FACTS
// ============================================================================

const ALL_FACTS = [
  "Regular oil changes can extend engine life by 50%",
  "Underinflated tires reduce fuel efficiency by 3% per PSI",
  "The average car has about 30,000 parts",
  "Brake pads need inspection every 25,000 miles",
  "Well-maintained cars retain 50% more resale value",
  "Car batteries typically last 3–5 years",
  "Rotate tires every 5,000–7,500 miles for even wear",
  "The check engine light covers 1,000+ possible issues",
  "Dirty air filters cut fuel economy by up to 10%",
  "80% of car breakdowns are preventable with maintenance",
  "Coolant should be flushed every 30,000 miles",
  "Worn spark plugs can reduce fuel efficiency by 30%",
];

const TOTAL_DURATION = 14000;

// ============================================================================
// PULSING DOTS
// ============================================================================

function PulsingDots() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const dur = 600;
    const gap = 200;
    dot1.value = withRepeat(withSequence(withTiming(1, { duration: dur }), withTiming(0.3, { duration: dur })), -1);
    dot2.value = withDelay(gap, withRepeat(withSequence(withTiming(1, { duration: dur }), withTiming(0.3, { duration: dur })), -1));
    dot3.value = withDelay(gap * 2, withRepeat(withSequence(withTiming(1, { duration: dur }), withTiming(0.3, { duration: dur })), -1));
    return () => { cancelAnimation(dot1); cancelAnimation(dot2); cancelAnimation(dot3); };
  }, []);

  const d1 = useAnimatedStyle(() => ({ opacity: dot1.value, transform: [{ scale: 0.8 + dot1.value * 0.2 }] }));
  const d2 = useAnimatedStyle(() => ({ opacity: dot2.value, transform: [{ scale: 0.8 + dot2.value * 0.2 }] }));
  const d3 = useAnimatedStyle(() => ({ opacity: dot3.value, transform: [{ scale: 0.8 + dot3.value * 0.2 }] }));

  return (
    <View style={dotStyles.row}>
      <Animated.View style={[dotStyles.dot, d1]} />
      <Animated.View style={[dotStyles.dot, d2]} />
      <Animated.View style={[dotStyles.dot, d3]} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: scale(6), marginTop: scale(12) },
  dot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: "#5299FE" },
});

// ============================================================================
// READY CHECK
// ============================================================================

function ScoreReadyCheck() {
  const progress = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withDelay(
      100,
      withSpring(1, { damping: 12, stiffness: 180 })
    );
    progress.value = withDelay(
      300,
      withTiming(1, { duration: 400 })
    );
  }, [checkScale, progress]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_PATH_LENGTH * (1 - progress.value),
  }));

  return (
    <View style={checkStyles.slot}>
      <Animated.View style={[checkStyles.checkmarkCircle, animatedIconStyle]}>
        <Svg width={scale(38)} height={scale(38)} viewBox="0 0 24 24">
          <AnimatedPath
            d="M6 12L10 16L18 8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_PATH_LENGTH}
            animatedProps={animatedPathProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const checkStyles = StyleSheet.create({
  slot: {
    alignItems: "center",
    justifyContent: "center",
    height: scale(76),
    width: "100%",
  },
  checkmarkCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: "#5299FE",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

// ============================================================================
// CHAT BUBBLE
// ============================================================================

interface BubbleSlot {
  fact: string;
  row: number;     // 0-3
  col: number;     // 0 = left, 1 = right
  delay: number;
}

function ChatBubble({
  slot,
  onPop,
  index,
}: {
  slot: BubbleSlot;
  onPop: (index: number) => void;
  index: number;
}) {
  const [popped, setPopped] = useState(false);
  const isLeft = slot.col === 0;

  // Entry
  const entryScale = useSharedValue(0.6);
  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(12);

  // Float
  const floatY = useSharedValue(0);

  // Pop
  const popScale = useSharedValue(1);
  const popOpacity = useSharedValue(1);

  useEffect(() => {
    // Gentle entry — minimal bounce
    entryScale.value = withDelay(slot.delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.ease) }));
    entryOpacity.value = withDelay(slot.delay, withTiming(1, { duration: 350 }));
    entryTranslateY.value = withDelay(slot.delay, withTiming(0, { duration: 450, easing: Easing.out(Easing.ease) }));

    // Slow gentle float
    const dur = 2800 + Math.random() * 1200;
    floatY.value = withDelay(slot.delay + 500, withRepeat(
      withSequence(
        withTiming(-6, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, true
    ));

    return () => { cancelAnimation(floatY); };
  }, []);

  const handlePop = useCallback(() => {
    if (popped) return;
    setPopped(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    popScale.value = withSequence(
      withTiming(1.08, { duration: 100 }),
      withTiming(0, { duration: 220, easing: Easing.in(Easing.ease) })
    );
    popOpacity.value = withDelay(80, withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onPop)(index);
    }));
  }, [popped]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value + entryTranslateY.value },
      { scale: entryScale.value * popScale.value },
    ],
    opacity: entryOpacity.value * popOpacity.value,
  }));

  return (
    <Animated.View style={[{ alignSelf: isLeft ? "flex-start" : "flex-end" }, animStyle]}>
      <Pressable onPress={handlePop}>
        <View style={[chatStyles.bubble, isLeft ? chatStyles.bubbleLeft : chatStyles.bubbleRight, !isLeft && chatStyles.bubbleBlue]}>
          <Text weight="medium" style={[chatStyles.text, !isLeft && chatStyles.textWhite]}>
            {slot.fact}
          </Text>
        </View>
        {/* Chat tail */}
        <View
          style={[
            chatStyles.tail,
            isLeft ? chatStyles.tailLeft : chatStyles.tailRight,
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const chatStyles = StyleSheet.create({
  bubble: {
    backgroundColor: "#FFFFFF",
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    maxWidth: SCREEN_WIDTH * 0.62,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  bubbleLeft: {
    borderRadius: scale(18),
    borderBottomLeftRadius: scale(4),
    marginLeft: scale(4),
  },
  bubbleRight: {
    borderRadius: scale(18),
    borderBottomRightRadius: scale(4),
    marginRight: scale(4),
  },
  bubbleBlue: {
    backgroundColor: "#5299FE",
    shadowColor: "rgba(82,153,254,0.25)",
  },
  text: {
    fontSize: moderateScale(13.5),
    color: "#334155",
    lineHeight: moderateScale(13.5) * 1.45,
  },
  textWhite: {
    color: "#FFFFFF",
  },
  tail: {
    position: "absolute",
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
  },
  tailLeft: {
    left: scale(8),
    borderLeftWidth: 0,
    borderRightWidth: scale(8),
    borderTopWidth: scale(8),
    borderBottomWidth: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    borderBottomColor: "transparent",
    transform: [{ translateY: scale(6) }],
  },
  tailRight: {
    right: scale(8),
    borderLeftWidth: scale(8),
    borderRightWidth: 0,
    borderTopWidth: scale(8),
    borderBottomWidth: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#5299FE",
    borderBottomColor: "transparent",
    transform: [{ translateY: scale(6) }],
  },
});

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function HealthEstimatingScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{
    vehicleOwnerId?: string;
    flow?: string;
    fromPreOnboarding?: string;
  }>();

  const [poppedSet, setPoppedSet] = useState<Set<number>>(new Set());
  const [loadingDone, setLoadingDone] = useState(false);
  const navigatedRef = useRef(false);
  const bubblesScrollRef = useRef<ScrollView>(null);
  const bubblesViewportHeightRef = useRef(0);
  const bubblesContentHeightRef = useRef(0);
  const [visibleBubbleCount, setVisibleBubbleCount] = useState(0);
  const bubbleBottomClearance = scale(132) + insets.bottom;

  // Resolve the actual vehicle image so this screen shows the car the
  // user just added instead of the covered-car placeholder. Mirrors the
  // cache-first / fetch-fallback pattern used on the cars tab.
  const { vehicles: ownedVehicles } = useVehicleOwnershipFromConvex();
  const saveVehicleImageUrl = useMutation(api.vehicles.saveVehicleImageUrl);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  const activeRow = useMemo(() => {
    if (!params.vehicleOwnerId) return null;
    return (ownedVehicles as any[]).find(
      (r) => r?.ownership?._id === params.vehicleOwnerId,
    ) ?? null;
  }, [ownedVehicles, params.vehicleOwnerId]);

  useEffect(() => {
    if (!activeRow) return;
    const cachedUrl = activeRow.vehicle?.image_url as string | undefined;
    if (cachedUrl) {
      setResolvedImageUrl(cachedUrl);
      return;
    }
    const vin = activeRow.vin as string | undefined;
    const meta = activeRow.vehicle?.metadata as
      | { make?: string; model?: string; color?: string }
      | undefined;
    const make = meta?.make ?? "";
    const model = meta?.model ?? "";
    const color = meta?.color ?? activeRow.ownership?.color ?? "";
    const year = activeRow.vehicle?.year as number | undefined;
    if (!make || !model) return;
    let cancelled = false;
    fetchVehicleImageUrl(make, model, year, vin, color).then((url) => {
      if (cancelled || !url) return;
      setResolvedImageUrl(url);
      if (vin) saveVehicleImageUrl({ vin, image_url: url });
    });
    return () => { cancelled = true; };
  }, [activeRow, saveVehicleImageUrl]);

  // Distribute bubbles in rows, alternating left/right
  const bubbleSlots = useMemo(() => {
    const shuffled = [...ALL_FACTS].sort(() => Math.random() - 0.5);
    const count = height < 740 ? 5 : 6;
    return shuffled.slice(0, count).map((fact, i): BubbleSlot => ({
      fact,
      row: i,
      col: i % 2,
      delay: 1200 + i * 2000,
    }));
  }, [height]);

  useEffect(() => {
    setVisibleBubbleCount(0);
    bubblesContentHeightRef.current = 0;
    bubblesScrollRef.current?.scrollTo({ y: 0, animated: false });
    const timers = bubbleSlots.map((slot, index) =>
      setTimeout(() => {
        setVisibleBubbleCount((prev) => Math.max(prev, index + 1));
      }, slot.delay)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [bubbleSlots]);

  // Loading timer
  useEffect(() => {
    const timer = setTimeout(() => setLoadingDone(true), TOTAL_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Loading status text — stops when done
  const STATUS_TEXTS = [
    "Analyzing your vehicle data",
    "Evaluating maintenance patterns",
    "Computing health indicators",
    "Building your profile",
    "Finalizing score",
  ];
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (loadingDone) return;
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_TEXTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loadingDone]);

  // Dots + status text fade out when done
  const dotsOpacity = useSharedValue(1);
  useEffect(() => {
    if (loadingDone) {
      dotsOpacity.value = withTiming(0, { duration: 400 });
    }
  }, [loadingDone]);
  const dotsAnimStyle = useAnimatedStyle(() => ({ opacity: dotsOpacity.value }));

  // Button animation
  const btnOpacity = useSharedValue(0);
  const btnTranslateY = useSharedValue(16);
  useEffect(() => {
    if (loadingDone) {
      btnOpacity.value = withDelay(500, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
      btnTranslateY.value = withDelay(500, withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }));
    }
  }, [loadingDone]);
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value, transform: [{ translateY: btnTranslateY.value }] }));

  // Title animations
  const loadingTitleOpacity = useSharedValue(0);
  const doneTitleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);
  const subtitleOpacity = useSharedValue(0);
  useEffect(() => {
    loadingTitleOpacity.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
    titleTranslateY.value = withDelay(150, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }));
    subtitleOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
  }, []);
  useEffect(() => {
    if (loadingDone) {
      loadingTitleOpacity.value = withTiming(0, { duration: 350 });
      doneTitleOpacity.value = withDelay(350, withTiming(1, { duration: 450, easing: Easing.out(Easing.ease) }));
    }
  }, [loadingDone]);
  const loadingTitleStyle = useAnimatedStyle(() => ({ opacity: loadingTitleOpacity.value, transform: [{ translateY: titleTranslateY.value }] }));
  const doneTitleStyle = useAnimatedStyle(() => ({ opacity: doneTitleOpacity.value }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  const handlePop = useCallback((index: number) => {
    setPoppedSet((prev) => new Set(prev).add(index));
  }, []);

  const scrollToLatestBubble = useCallback((animated = true) => {
    if (bubblesViewportHeightRef.current <= 0) {
      return;
    }

    const visibleContentHeight = Math.max(0, bubblesContentHeightRef.current - bubbleBottomClearance);
    const visibleLimit = Math.max(0, bubblesViewportHeightRef.current - bubbleBottomClearance);

    if (visibleContentHeight <= visibleLimit + scale(4)) {
      return;
    }

    bubblesScrollRef.current?.scrollTo({
      y: visibleContentHeight - visibleLimit,
      animated,
    });
  }, [bubbleBottomClearance]);

  useEffect(() => {
    if (visibleBubbleCount === 0) return;
    const timer = setTimeout(() => {
      scrollToLatestBubble(true);
    }, 120);

    return () => clearTimeout(timer);
  }, [scrollToLatestBubble, visibleBubbleCount]);

  useEffect(() => {
    if (!loadingDone) return;
    const timer = setTimeout(() => {
      scrollToLatestBubble(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [loadingDone, scrollToLatestBubble]);

  const handleViewScore = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(main-tabs)/cars");
  }, [params.flow, params.vehicleOwnerId]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#F8FBFF", "#EBF4FF", "#D6EAF8"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + verticalScale(52) }]}>
        <View style={styles.titleWrap}>
          <Animated.View style={[styles.titleAbsolute, loadingTitleStyle]}>
            <Text weight="bold" style={styles.title}>
              {"Estimating your\nhealth score"}
            </Text>
          </Animated.View>
          <Animated.View style={[styles.titleAbsolute, doneTitleStyle]}>
            <Text weight="bold" style={styles.title}>
              Your Score is Ready
            </Text>
          </Animated.View>
        </View>

        <View style={styles.statusSlot}>
          {loadingDone ? (
            <ScoreReadyCheck />
          ) : (
            <Animated.View style={[styles.statusRow, subtitleStyle]}>
              <Animated.View style={dotsAnimStyle}>
                <PulsingDots />
              </Animated.View>
              <Text weight="medium" style={styles.statusText}>
                {STATUS_TEXTS[statusIndex]}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Vehicle hero — uses the resolved VDB render of the user's
          actual car when available, with the covered-car placeholder
          as a fallback while the image is still being fetched. */}
      <Image
        source={
          resolvedImageUrl
            ? { uri: resolvedImageUrl }
            : require("@/assets/images/covered-car.png")
        }
        style={styles.coveredCar}
        resizeMode="contain"
      />

      {/* Chat bubbles — laid out in a vertical list with alternating alignment */}
      <ScrollView
        ref={bubblesScrollRef}
        style={styles.bubblesScroll}
        contentContainerStyle={[
          styles.bubblesArea,
          { paddingBottom: bubbleBottomClearance },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(event) => {
          bubblesViewportHeightRef.current = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, contentHeight) => {
          bubblesContentHeightRef.current = contentHeight;
          if (visibleBubbleCount > 0) {
            scrollToLatestBubble(true);
          }
        }}
      >
        {bubbleSlots.slice(0, visibleBubbleCount).map((slot, idx) =>
          poppedSet.has(idx) ? (
            <View key={idx} style={styles.bubbleSpacer} />
          ) : (
            <View key={idx} style={styles.bubbleRow}>
              <ChatBubble slot={{ ...slot, delay: 0 }} index={idx} onPop={handlePop} />
            </View>
          )
        )}
      </ScrollView>

      {/* CTA Button */}
      {loadingDone && (
        <Animated.View style={[styles.ctaWrap, { paddingBottom: insets.bottom + scale(16) }, btnStyle]}>
          <Pressable
            onPress={handleViewScore}
            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <LinearGradient
              colors={["#7BB8FF", "#5299FE", "#3B7FEB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text weight="bold" style={styles.ctaText}>
                View My Initial Score
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FBFF",
  },
  header: {
    alignItems: "center",
    zIndex: 10,
  },
  titleWrap: {
    alignItems: "center",
    height: moderateScale(28) * 1.2 * 2 + scale(8),
    justifyContent: "center",
  },
  titleAbsolute: {
    position: "absolute",
    alignItems: "center",
  },
  title: {
    fontSize: moderateScale(28),
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: moderateScale(28) * 1.2,
  },
  statusRow: {
    alignItems: "center",
  },
  statusSlot: {
    height: scale(76),
    justifyContent: "flex-start",
    alignItems: "center",
  },
  statusText: {
    fontSize: moderateScale(14),
    color: "#94A3B8",
    marginTop: scale(10),
  },
  bubblesArea: {
    paddingHorizontal: scale(20),
    paddingTop: scale(24),
    gap: scale(16),
  },
  bubblesScroll: {
    flex: 1,
  },
  bubbleRow: {
    width: "100%",
  },
  bubbleSpacer: {
    height: scale(50),
  },
  coveredCar: {
    width: "100%",
    height: scale(110),
    marginTop: scale(4),
  },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(24),
    paddingTop: scale(12),
    zIndex: 20,
  },
  ctaButton: {
    paddingVertical: scale(17),
    borderRadius: moderateScale(24),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(82, 153, 254, 0.35)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  ctaText: {
    fontSize: moderateScale(17),
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
});

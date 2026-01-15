import React, { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import {
  BrandColors,
  FooterButton,
  Spacing,
  Text,
} from "@/components/shared-ui";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_PATH_LENGTH = 100;

export default function TwoFactorSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // shared values for the new animation style
  const progress = useSharedValue(0);
  const scale = useSharedValue(0);
  const shadowScale = useSharedValue(0);

  useEffect(() => {
    const backAction = () => {
      router.replace("/settings");
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    // 1. First, the container "pops" in
    scale.value = withDelay(
      100,
      withSpring(1, { damping: 12, stiffness: 100 })
    );

    // 2. Then the checkmark "draws" itself
    progress.value = withDelay(
      400,
      withSpring(1, { damping: 15, stiffness: 120 })
    );

    // 3. The shadow scales in sync with the pop
    shadowScale.value = withDelay(200, withSpring(1, { damping: 15 }));
  }, []);

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedShadowStyle = useAnimatedStyle(() => {
    // The lowest point of the checkmark is reached at approx 35% of the draw animation
    const opacity = interpolate(
      progress.value,
      [0, 0.35, 0.6],
      [0, 0, 0.15],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scaleX: shadowScale.value }],
    };
  });

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_PATH_LENGTH * (1 - progress.value),
  }));

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.checkContainer}>
          <Animated.View style={[styles.checkWrap, animatedCheckStyle]}>
            <Svg width={160} height={160} viewBox="0 0 100 100">
              <AnimatedPath
                d="M25 52 L45 72 L80 34"
                fill="none"
                stroke={BrandColors.secondary}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_PATH_LENGTH}
                animatedProps={animatedProps}
              />
            </Svg>
          </Animated.View>

          {/* Ground shadow underneath */}
          <Animated.View style={[styles.groundShadow, animatedShadowStyle]} />
        </View>

        <Text weight="bold" size="3xl" color="#111827" style={styles.title}>
          All done!
        </Text>
        <Text size="md" color="#6B7280" style={styles.subtitle}>
          Your two-factor authentication is enabled.
        </Text>
      </View>
      <View style={styles.footer}>
        <FooterButton
          label="Done"
          onPress={() => router.replace("/settings")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#E8ECF0",
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 220,
    width: 220,
  },
  checkWrap: {
    zIndex: 2,
    marginTop: -20, // Move checkmark up slightly within container
  },
  groundShadow: {
    position: "absolute",
    bottom: 55, // Moved closer to the checkmark's lowest point
    width: 100,
    height: 10,
    borderRadius: 100,
    backgroundColor: "#000",
    zIndex: 1,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    marginBottom: Spacing["5xl"] * 1.7,
  },
});

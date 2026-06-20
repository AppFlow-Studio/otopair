/**
 * SuccessScreen
 *
 * PURPOSE: Displays a success message and animation after setting up 2FA,
 *          Biometrics, or contact info updates.
 *
 * USED IN: app/(main-tabs)/settings/two-factor-verify.tsx, app/(main-tabs)/settings/biometric-setup.tsx
 *
 * PARAMS:
 *   - type: success message variant
 *
 * EXAMPLE:
 *   router.replace({ pathname: '/settings/success', params: { type: 'face' } })
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useEffect, useMemo } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import Svg, { Path, Circle } from "react-native-svg";

import {
  BrandColors,
  FooterButton,
  Spacing,
  Text,
} from "@/components/shared-ui";
import { Layout } from "@/constants/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PATH_LENGTH = 100;
type SuccessType =
  | "2fa"
  | "face"
  | "touch"
  | "fingerprint"
  | "biometric"
  | "contact_phone"
  | "contact_email"
  | "contact_both";

export default function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type = "2fa" } = useLocalSearchParams<{ type?: SuccessType }>();

  const title = useMemo(() => {
    switch (type) {
      case "face": return "Face ID Enabled";
      case "touch": return "Touch ID Enabled";
      case "contact_phone": return "Phone number updated";
      case "contact_email": return "Email updated";
      case "contact_both": return "Contact info updated";
      case "2fa": return "All done!";
      default: return "Biometrics Enabled";
    }
  }, [type]);

  const subtitle = useMemo(() => {
    switch (type) {
      case "face": return "You can now use Face ID to sign in securely.";
      case "touch": return "You can now use Touch ID to sign in securely.";
      case "contact_phone": return "Your phone number has been changed successfully.";
      case "contact_email": return "Your email address has been changed successfully.";
      case "contact_both": return "Your phone number and email address have been changed successfully.";
      case "2fa": return "Your two-factor authentication is enabled";
      default: return "You can now use biometrics to sign in securely.";
    }
  }, [type]);

  // shared values for animations
  const progress = useSharedValue(0);
  const scale = useSharedValue(0);
  const shadowScale = useSharedValue(0);

  useEffect(() => {
    const backAction = () => {
      router.replace("/home");
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

    // 2. Then the icon "draws" itself
    progress.value = withDelay(
      400,
      withSpring(1, { damping: 15, stiffness: 120 })
    );

    // 3. The shadow scales in sync with the pop
    shadowScale.value = withDelay(200, withSpring(1, { damping: 15 }));
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedShadowStyle = useAnimatedStyle(() => {
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

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH * (1 - progress.value),
  }));

  const renderIcon = () => {
    // We always use the checkmark animation as requested
    return (
      <Svg width={160} height={160} viewBox="0 0 100 100">
        <AnimatedPath
          d="M25 52 L45 72 L80 34"
          fill="none"
          stroke={BrandColors.secondary}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PATH_LENGTH}
          animatedProps={animatedPathProps}
        />
      </Svg>
    );
  };

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Layout.footerHeight,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.checkContainer}>
          <Animated.View style={[styles.checkWrap, animatedIconStyle]}>
            {renderIcon()}
          </Animated.View>

          {/* Ground shadow underneath */}
          <Animated.View style={[styles.groundShadow, animatedShadowStyle]} />
        </View>

        <Text weight="bold" size="3xl" color="#111827" style={styles.title}>
          {title}
        </Text>
        <Text size="md" color="#6B7280" style={styles.subtitle} center>
          {subtitle}
        </Text>
      </View>
      <View>
        <FooterButton
          label="Done"
          onPress={() => router.replace("/home")}
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
    textAlign: "center",
    alignSelf: "stretch",
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    marginBottom: Spacing["5xl"] * 1.7,
  },
});

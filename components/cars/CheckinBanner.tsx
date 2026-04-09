/**
 * CheckinBanner — 3-stage quarterly check-in banner for the home/cars screen.
 *
 * Stage 1 (Day 0–13):  Soft — "Quick check-in to keep your [car] on track"
 * Stage 2 (Day 14–29): Stale — "Info last updated X months ago"
 * Stage 3 (Day 30+):   Estimated — health score gains "~" qualifier
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ArrowRight, Clock, AlertTriangle } from "lucide-react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";
import { scale, moderateScale } from "@/utils/responsive";

interface CheckinBannerProps {
  vehicleOwnerId: Id<"vehicle_owners">;
  vehicleName?: string;
  onDismiss?: () => void;
}

export function CheckinBanner({
  vehicleOwnerId,
  vehicleName,
  onDismiss,
}: CheckinBannerProps) {
  const router = useRouter();
  const status = useQuery(api.checkin.getCheckinStatus, { vehicleOwnerId });

  if (!status || status.state === "not_due") return null;

  const handlePress = () => {
    router.push({
      pathname: "/quarterly-checkin",
      params: { vehicleOwnerId, vehicleName },
    });
  };

  const carName = vehicleName ?? "your car";

  const bannerConfig = {
    soft: {
      icon: <Clock size={20} color={BrandColors.secondary} />,
      title: `Quick check-in for ${carName}`,
      subtitle: "A few questions to keep recommendations on track",
      bgColor: "#EFF6FF",
      borderColor: "#BFDBFE",
    },
    stale: {
      icon: <Clock size={20} color="#F59E0B" />,
      title: "Time for a quick update",
      subtitle: `Info last updated ${Math.round((status.daysSinceDue ?? 0) / 30) + 3} months ago`,
      bgColor: "#FFFBEB",
      borderColor: "#FDE68A",
    },
    estimated: {
      icon: <AlertTriangle size={20} color="#EF4444" />,
      title: "Health score may be outdated",
      subtitle: "Complete a quick check-in to restore accuracy",
      bgColor: "#FEF2F2",
      borderColor: "#FECACA",
    },
  };

  const config = bannerConfig[status.state as keyof typeof bannerConfig];
  if (!config) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
      <Pressable
        style={[
          styles.container,
          { backgroundColor: config.bgColor, borderColor: config.borderColor },
        ]}
        onPress={handlePress}
      >
        <View style={styles.iconContainer}>{config.icon}</View>
        <View style={styles.textContainer}>
          <Text variant="bodyBold" style={styles.title}>
            {config.title}
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            {config.subtitle}
          </Text>
        </View>
        <ArrowRight size={18} color="#9CA3AF" />
      </Pressable>
      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Text variant="caption" style={styles.dismissText}>
            Not now
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  iconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: BrandColors.primary,
    fontSize: moderateScale(14),
  },
  subtitle: {
    color: "#6B7280",
    fontSize: moderateScale(12),
  },
  dismissButton: {
    alignSelf: "center",
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    color: "#9CA3AF",
    fontSize: moderateScale(12),
  },
});

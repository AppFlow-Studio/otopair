/**
 * HeroCardMostBooked — Screen 1 hero card showing the most-booked
 * service across the platform this week. Tap pre-selects that
 * service and pushes straight to Choose Mechanic (or hands off to
 * the tire/rotor flow when the slug calls for it).
 */

import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Flame } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import {
  SLUG_DIAGNOSTIC_SCAN,
  SLUG_ROTOR_REPLACEMENT,
  SLUG_TIRE_REPLACEMENT,
} from "@/constants/serviceTaxonomy";
import { useMostBookedService } from "@/hooks/useMostBookedService";
import { useBookingStore } from "@/stores/useBookingStore";

export function HeroCardMostBooked() {
  const router = useRouter();
  const { result, isLoading } = useMostBookedService();
  const toggleServiceSelection = useBookingStore((s) => s.toggleServiceSelection);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);

  const onPress = useCallback(() => {
    if (!result) return;
    if (result.slug === SLUG_TIRE_REPLACEMENT) {
      router.push("/(tire-booking)");
      return;
    }
    if (result.slug === SLUG_ROTOR_REPLACEMENT) {
      router.push("/(rotor-booking)");
      return;
    }
    if (!selectedServiceIds.includes(result.serviceId)) {
      toggleServiceSelection(result.serviceId);
    }
    // For diagnostic-scan, the area picker normally opens before
    // adding to cart; we route to the category screen so the user
    // sees that prompt instead of skipping it.
    if (result.slug === SLUG_DIAGNOSTIC_SCAN) {
      router.push({
        pathname: "/(booking-flow)/category/[tab]",
        params: { tab: result.taxonomy.tab },
      });
      return;
    }
    router.push("/(booking-flow)/choose-mechanic");
  }, [result, router, selectedServiceIds, toggleServiceSelection]);

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      disabled={!result}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={
        result ? `Most booked: ${result.taxonomy.label}` : "Loading most booked"
      }
    >
      <View style={styles.iconWrap}>
        <Flame size={20} color="#4B5563" strokeWidth={2} />
      </View>
      <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
        MOST BOOKED
      </Text>
      <Text
        size="lg"
        weight="bold"
        color="#0F172A"
        style={styles.title}
        numberOfLines={2}
      >
        {result?.taxonomy.label ?? (isLoading ? "Loading…" : "Nothing yet")}
      </Text>
      {result ? (
        <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
          Popular this week
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    minHeight: 160,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  eyebrow: {
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6,
  },
  subtitle: {
    marginTop: 2,
  },
});

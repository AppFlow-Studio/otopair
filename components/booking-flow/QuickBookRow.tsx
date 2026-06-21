/**
 * QuickBookRow — Screen 1 horizontal scroll of one-tap service
 * chips. Populated by the user's top-N booked services with a
 * curated fallback for first-time users.
 *
 * Tap pre-selects the service and pushes straight to Choose
 * Mechanic. Tire / Rotor route to the dedicated handoff flows
 * instead. Diagnostic scan opens the category screen so the area
 * picker can fire.
 */

import React, { useCallback } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

import { Text } from "@/components/shared-ui";
import { CardShadow } from "@/constants/theme";
import {
  SLUG_DIAGNOSTIC_SCAN,
  SLUG_ROTOR_REPLACEMENT,
  SLUG_TIRE_REPLACEMENT,
} from "@/constants/serviceTaxonomy";
import { useUserTopBookedServices, type QuickBookChip } from "@/hooks/useUserTopBookedServices";
import { useBookingStore } from "@/stores/useBookingStore";

export function QuickBookRow() {
  const router = useRouter();
  const { chips, isLoading } = useUserTopBookedServices();
  const toggleServiceSelection = useBookingStore((s) => s.toggleServiceSelection);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);

  const handleTap = useCallback(
    (chip: QuickBookChip) => {
      if (chip.slug === SLUG_TIRE_REPLACEMENT) {
        router.push("/(tire-booking)");
        return;
      }
      if (chip.slug === SLUG_ROTOR_REPLACEMENT) {
        router.push("/(rotor-booking)");
        return;
      }
      if (chip.serviceId && !selectedServiceIds.includes(chip.serviceId)) {
        toggleServiceSelection(chip.serviceId);
      }
      if (chip.slug === SLUG_DIAGNOSTIC_SCAN) {
        router.push({
          pathname: "/(booking-flow)/category/[tab]",
          params: { tab: chip.taxonomy.tab },
        });
        return;
      }
      router.push("/(booking-flow)/choose-mechanic");
    },
    [router, selectedServiceIds, toggleServiceSelection],
  );

  if (isLoading || chips.length === 0) return null;

  return (
    <View>
      <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
        QUICK BOOK
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {chips.map((chip) => (
          <Pressable
            key={chip.slug}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => handleTap(chip)}
            accessibilityRole="button"
            accessibilityLabel={`Book ${chip.taxonomy.label}`}
          >
            {Platform.OS === "ios" ? (
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
            ) : null}
            <Text size="sm" weight="semiBold" color="#1F2937">
              {chip.taxonomy.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  row: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  chipPressed: {
    opacity: 0.8,
  },
});

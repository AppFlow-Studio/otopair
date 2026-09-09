/**
 * PinnedShopChip — surfaced on Screen 1 (`select-services`) and
 * Screen 2 (`category/[tab]`) when the user came in from the
 * shop-detail Book CTA (i.e. `useBookingStore.preSelectedShopId` is
 * set).
 *
 * Two jobs:
 *  1. Tell the user that the booking is locked to a specific shop —
 *     so the service list filtering and the "skip Choose Mechanic"
 *     routing aren't a mystery.
 *  2. Let them un-pin without backing out to Home. Tap the X and
 *     the booking-store's `clearPreSelections` fires; the screen
 *     re-renders without the filter and the Continue button goes
 *     back to the regular Choose Mechanic surface.
 *
 * Renders nothing when no shop is pinned, so the host screen can
 * just mount it unconditionally near the top.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Store, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";

export function PinnedShopChip() {
  const preSelectedShopId = useBookingStore((s) => s.preSelectedShopId);
  const clearPreSelections = useBookingStore((s) => s.clearPreSelections);
  const getShopById = useShopStore((s) => s.getShopById);

  if (!preSelectedShopId) return null;
  const shop = getShopById(preSelectedShopId);
  // If the shop isn't hydrated yet (cold start / cache miss) we
  // still want to indicate that SOMETHING is pinned — fall back to
  // a generic label so the user can always unpin.
  const shopName = shop?.name ?? "Selected shop";

  return (
    <View style={styles.row}>
      <View style={styles.iconBubble}>
        <Store size={14} color="#1F2937" strokeWidth={2} />
      </View>
      <Text
        size="sm"
        weight="semiBold"
        color="#0F172A"
        numberOfLines={1}
        style={styles.label}
      >
        Booking at {shopName}
      </Text>
      <Pressable
        onPress={clearPreSelections}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Stop booking at ${shopName}`}
        style={({ pressed }) => [
          styles.clearBtn,
          pressed && styles.clearBtnPressed,
        ]}
      >
        <X size={14} color="#6B7280" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  iconBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82, 153, 254, 0.12)",
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.06)",
  },
  clearBtnPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.12)",
  },
});

export default PinnedShopChip;

/**
 * MapShopCard — floating white card anchored over the map on Screen 3.
 *
 * Shows the default shop the booking will route through: name +
 * chevron, ⭐ rating + distance, estimated price range, and the
 * next available slot for that shop. Tap → shop detail page.
 *
 * Spec: ~/Downloads/<figma frames> Screen 3.
 */

import React from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { ChevronRight, Star } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

interface MapShopCardProps {
  shopId: string;
  shopName: string;
  /** Shop logo (shops.logo_storage_id resolved by shops.list). Renders a
   *  small avatar before the name when set; layout is unchanged when null. */
  imageUrl?: string | null;
  rating: number | null;
  distanceMi: number;
  priceRange: string | null; // e.g. "~$92 – $108" or "$120" (fixed); null while loading
  /** True when the price is a guaranteed fixed rate (no range) — swaps
   *  the "Estimated price" eyebrow for "Fixed price". */
  isFixed?: boolean;
  nextSlotLabel: string | null; // e.g. "Next: Mon 9:00 AM"; null while loading
}

export function MapShopCard({
  shopId,
  shopName,
  imageUrl,
  rating,
  distanceMi,
  priceRange,
  isFixed = false,
  nextSlotLabel,
}: MapShopCardProps) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({ pathname: "/booking/shop/[id]", params: { id: shopId } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${shopName} details`}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={28}
          tint="light"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.topRow}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.logo} resizeMode="cover" />
        ) : null}
        <Text size="md" weight="bold" color="#0F172A" numberOfLines={1} style={styles.name}>
          {shopName}
        </Text>
        <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} />
      </View>

      <View style={styles.metaRow}>
        {rating != null ? (
          <>
            <Star size={13} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
            <Text size="xs" weight="medium" color="#4B5563">
              {rating.toFixed(1)}
            </Text>
            <Text size="xs" weight="regular" color="#6B7280">
              ·
            </Text>
          </>
        ) : null}
        <Text size="xs" weight="medium" color="#4B5563">
          {formatMiles(distanceMi)} mi away
        </Text>
      </View>

      <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
        {isFixed ? "FIXED PRICE" : "ESTIMATED PRICE"}
      </Text>
      <View style={styles.priceRow}>
        <Text size="xl" weight="bold" color="#0F172A" style={styles.price}>
          {priceRange ?? "—"}
        </Text>
        {nextSlotLabel ? (
          <Text size="xs" weight="medium" color="#6B7280" style={styles.nextSlot}>
            {nextSlotLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatMiles(miles: number): string {
  if (miles < 0.1) return "less than 0.1";
  if (miles < 10) return miles.toFixed(1);
  return Math.round(miles).toString();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7,
    minWidth: 240,
    maxWidth: 320,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  name: {
    flexShrink: 1,
    flexGrow: 1,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  eyebrow: {
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  price: {
    fontSize: 20,
    lineHeight: 24,
  },
  nextSlot: {
    marginBottom: 2,
  },
});

/**
 * MapBrowseShopCard — minimal floating shop card shown on Choose
 * Mechanic when the user drags the bottom sheet down to the low
 * (12%) snap. Mirrors the ChatGPT "shops on a map" UI: image on
 * the left, shop name + rating + category + open status on the
 * right. Tap → shop detail page.
 *
 * At the standard / expanded snap points the screen renders the
 * richer `MapShopCard` instead (estimated price + next slot).
 * This card intentionally drops that detail so the map is the
 * focus — the user is browsing, not pricing.
 */

import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { Star } from "lucide-react-native";
import Animated from "react-native-reanimated";

import { Text } from "@/components/shared-ui";

interface MapBrowseShopCardProps {
  shopId: string;
  shopName: string;
  imageUrl: string | null;
  rating: number | null;
  /** Static-ish category copy ("Auto repair shop") — Otopair has
   *  one business type, so the field exists for visual parity with
   *  the ChatGPT design rather than to differentiate. */
  category: string;
  /** Drives the green/grey "Open"/"Closed" tag. Sourced from the
   *  shop's `hasAvailableSlots` flag — close enough to live hours
   *  for v1; swap for real hours if/when we ingest them. */
  isOpen: boolean;
  /** Optional tap override. Default → shop detail page. On Choose
   *  Mechanic at the closed-sheet snap, this is wired to re-open
   *  the bottom sheet instead. */
  onPress?: () => void;
}

export function MapBrowseShopCard({
  shopId,
  shopName,
  imageUrl,
  rating,
  category,
  isOpen,
  onPress,
}: MapBrowseShopCardProps) {
  const router = useRouter();

  const handlePress =
    onPress ??
    (() =>
      router.push({ pathname: "/booking/shop/[id]", params: { id: shopId } }));

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${shopName} details`}
    >
      <View style={styles.image}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
        )}
      </View>

      <View style={styles.body}>
        {/* Wrapped in an Animated.View with `sharedTransitionTag`
            so Reanimated can morph this text into the matching
            title on the shop detail page (see components/shop/
            ShopHeroCard.tsx). Tag is scoped by shopId so multiple
            pins on the same map don't collide. */}
        <Animated.View
          sharedTransitionTag={`shop-${shopId}-name`}
          style={styles.nameSharedWrap}
        >
          <Text
            size="md"
            weight="bold"
            color="#0F172A"
            numberOfLines={1}
            style={styles.name}
          >
            {shopName}
          </Text>
        </Animated.View>

        <View style={styles.metaRow}>
          {rating != null ? (
            <>
              <Star size={13} color="#0F172A" fill="#0F172A" strokeWidth={2} />
              <Text size="sm" weight="medium" color="#0F172A">
                {rating.toFixed(1)}
              </Text>
              <Text size="sm" weight="regular" color="#6B7280">
                {" · "}
              </Text>
            </>
          ) : null}
          <Text
            size="sm"
            weight="medium"
            color="#4B5563"
            numberOfLines={1}
            style={styles.category}
          >
            {category}
          </Text>
        </View>

        <Text
          size="sm"
          weight="semiBold"
          color={isOpen ? "#16A34A" : "#9CA3AF"}
        >
          {isOpen ? "Open" : "Closed"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  cardPressed: {
    opacity: 0.92,
  },
  nameSharedWrap: {
    // Wrapper for the shared-element transition target. No
    // visual — just a positioned Animated.View so Reanimated
    // has a stable node to interpolate to the shop detail's
    // hero title.
    alignSelf: "flex-start",
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  imageFallback: {
    backgroundColor: "#E5E7EB",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
    paddingVertical: 2,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  category: {
    flexShrink: 1,
  },
});

export default MapBrowseShopCard;

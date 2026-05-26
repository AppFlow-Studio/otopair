/**
 * ShopPortfolioSection
 *
 * PURPOSE: Displays portfolio images/gallery for a shop from Convex (cdn_assets + shop_portfolio).
 *
 * USED IN: app/(booking)/shop/[id].tsx, app/(booking)/mechanic/[id].tsx (Portfolio tab)
 *
 * OWNER: Temurbek Sayfutdinov
 */

import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { useShopPortfolioFromConvex } from "@/hooks/useShopPortfolioFromConvex";

interface ShopPortfolioSectionProps {
  /** The shop ID to show portfolio for (Convex _id as string) */
  shopId: string;
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1493238792000-8113da705763?w=800&h=600&fit=crop",
];

export function ShopPortfolioSection({ shopId }: ShopPortfolioSectionProps) {
  const { portfolio, isLoading } = useShopPortfolioFromConvex(shopId);
  const images = portfolio.length > 0 ? portfolio.map((p) => p.url) : DEFAULT_IMAGES;

  const handleImagePress = (imageUrl: string, _index: number) => {
    // TODO: Open full-screen image viewer
    void imageUrl;
  };

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color="#9CA3AF" center>
          Loading portfolio…
        </Text>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color="#9CA3AF" center>
          No portfolio images available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text size="lg" weight="bold" color={BrandColors.primary}>
          Portfolio ({images.length})
        </Text>
      </View>
      <View style={styles.grid}>
        {images.map((imageUrl, index) => (
          <TouchableOpacity
            key={index}
            style={styles.imageContainer}
            onPress={() => handleImagePress(imageUrl, index)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  imageContainer: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});

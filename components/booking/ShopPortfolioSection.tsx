/**
 * ShopPortfolioSection
 *
 * PURPOSE: Displays portfolio images/gallery for a shop from Convex —
 * owner-uploaded photos (Convex storage) plus legacy cdn_assets seed rows,
 * with captions and a full-screen swipeable viewer.
 *
 * USED IN: app/(booking)/shop/[id].tsx, app/(booking)/mechanic/[id].tsx (Portfolio tab)
 *
 * OWNER: Temurbek Sayfutdinov
 */

import { X } from "lucide-react-native";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, BrandColors, Spacing, Text } from "@/components/shared-ui";
import { SemanticColors } from "@/constants/theme";
import {
  useShopPortfolioFromConvex,
  type PortfolioItem,
} from "@/hooks/useShopPortfolioFromConvex";

interface ShopPortfolioSectionProps {
  /** The shop ID to show portfolio for (Convex _id as string) */
  shopId: string;
}

export function ShopPortfolioSection({ shopId }: ShopPortfolioSectionProps) {
  const { portfolio, isLoading } = useShopPortfolioFromConvex(shopId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color={SemanticColors.textDisabled} center>
          Loading portfolio…
        </Text>
      </View>
    );
  }

  if (portfolio.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color={SemanticColors.textDisabled} center>
          No portfolio images available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text size="lg" weight="bold" color={BrandColors.primary}>
          Portfolio ({portfolio.length})
        </Text>
      </View>
      <View style={styles.grid}>
        {portfolio.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={styles.imageContainer}
            onPress={() => setViewerIndex(index)}
            activeOpacity={0.8}
            accessibilityRole="imagebutton"
            accessibilityLabel={item.caption ?? `Portfolio image ${index + 1}`}
          >
            <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
            {item.caption ? (
              <View style={styles.captionScrim}>
                <Text size="xs" weight="medium" color={BrandColors.white} numberOfLines={1}>
                  {item.caption}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
      {viewerIndex !== null && (
        <PortfolioViewer
          items={portfolio}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

// ============================================================================
// FULL-SCREEN VIEWER
// ============================================================================

interface PortfolioViewerProps {
  items: PortfolioItem[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Mounted fresh on every open (rather than toggling Modal.visible) so
 * FlatList's initialScrollIndex — which only applies at mount — always
 * starts on the tapped photo.
 */
function PortfolioViewer({ items, initialIndex, onClose }: PortfolioViewerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(initialIndex);
  const current = items[page];

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <View style={[styles.viewerPage, { width }]}>
              <Image
                source={{ uri: item.url }}
                style={styles.viewerImage}
                resizeMode="contain"
                accessible
                accessibilityLabel={item.caption ?? `Portfolio image ${index + 1}`}
              />
            </View>
          )}
        />
        <View style={[styles.viewerTopBar, { top: insets.top + Spacing.md }]}>
          <Text size="sm" weight="medium" color={BrandColors.white}>
            {page + 1} / {items.length}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.viewerClose,
              pressed && styles.viewerClosePressed,
            ]}
          >
            <X size={20} color={BrandColors.white} strokeWidth={2.5} />
          </Pressable>
        </View>
        {current?.caption ? (
          <View style={[styles.viewerCaption, { bottom: insets.bottom + Spacing.xl }]}>
            <Text size="sm" weight="medium" color={BrandColors.white} center numberOfLines={2}>
              {current.caption}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
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
  captionScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    // BrandColors.primary at ~70% alpha (no overlay token exists in theme).
    backgroundColor: `${BrandColors.primary}B3`,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: BrandColors.black,
  },
  viewerPage: {
    flex: 1,
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Plain scrim disc, not the shared `GlassCircleButton`. That button
  // refracts whatever sits behind it, and the viewer backdrop is solid
  // black — so it had nothing to catch and rendered as a muddy grey
  // blob ringed by a hard white arc. Its `elevation: 4` also cast a
  // square Android shadow (the container has no borderRadius, so the
  // outline is the bounding box) behind a round button, and its
  // `shadowColor: "#FFF"` glow is iOS-only. A dark disc disappears
  // into the letterboxing and only shows up where a bright photo
  // would otherwise swallow the glyph.
  viewerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  viewerClosePressed: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  viewerCaption: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
  },
});

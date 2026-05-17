/**
 * ShopHeroCard
 *
 * PURPOSE: Floating card that overlaps the bottom of the shop
 *          details map hero. Shows shop identity (name, rating,
 *          distance, address) and a row of quick actions
 *          (Call / Directions / Save / Book).
 *
 * USED IN: app/(main-tabs)/home/shop/[id]/index.tsx
 */

import React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Bookmark, Calendar, Navigation, Phone, Star } from "lucide-react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";

interface ShopHeroCardProps {
  shop: Shop;
  onSchedulePress?: () => void;
  onSavePress?: () => void;
  isSaved?: boolean;
}

export function ShopHeroCard({
  shop,
  onSchedulePress,
  onSavePress,
  isSaved = false,
}: ShopHeroCardProps) {
  const rating = typeof shop.rating === "number" ? shop.rating : null;
  const reviewCount = shop.reviewCount ?? 0;
  const distanceMi =
    typeof shop.distanceKm === "number"
      ? (shop.distanceKm * 0.621371).toFixed(1)
      : null;

  const handleCall = () => {
    if (shop.phone) {
      Linking.openURL(`tel:${shop.phone.replace(/[^\d+]/g, "")}`).catch(() => {});
    }
  };

  const handleDirections = () => {
    if (
      typeof shop.latitude === "number" &&
      typeof shop.longitude === "number"
    ) {
      const url = `http://maps.apple.com/?daddr=${shop.latitude},${shop.longitude}&dirflg=d`;
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <View style={styles.card}>
      <Text size="2xl" weight="bold" color={BrandColors.primary} numberOfLines={2}>
        {shop.name}
      </Text>

      <View style={styles.metaRow}>
        {rating !== null ? (
          <View style={styles.metaItem}>
            <Star size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />
            <Text size="sm" weight="semiBold" color={BrandColors.primary}>
              {rating.toFixed(1)}
            </Text>
            <Text size="xs" weight="regular" color="#6B7280">
              ({reviewCount})
            </Text>
          </View>
        ) : null}
        {distanceMi ? (
          <>
            <View style={styles.dot} />
            <Text size="sm" weight="medium" color="#475569">
              {distanceMi} mi
            </Text>
          </>
        ) : null}
      </View>

      {shop.address ? (
        <Text
          size="sm"
          weight="regular"
          color="#6B7280"
          numberOfLines={1}
          style={styles.address}
        >
          {shop.address}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <ActionChip
          icon={<Phone size={18} color={BrandColors.primary} />}
          label="Call"
          onPress={handleCall}
          disabled={!shop.phone}
        />
        <ActionChip
          icon={<Navigation size={18} color={BrandColors.primary} />}
          label="Directions"
          onPress={handleDirections}
        />
        <ActionChip
          icon={
            <Bookmark
              size={18}
              color={isSaved ? BrandColors.secondary : BrandColors.primary}
              fill={isSaved ? BrandColors.secondary : "transparent"}
            />
          }
          label={isSaved ? "Saved" : "Save"}
          onPress={onSavePress}
        />
        <ActionChip
          icon={<Calendar size={18} color="#FFFFFF" />}
          label="Book"
          onPress={onSchedulePress}
          primary
        />
      </View>
    </View>
  );
}

interface ActionChipProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  primary?: boolean;
  disabled?: boolean;
}

function ActionChip({ icon, label, onPress, primary, disabled }: ActionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.chip,
        primary && styles.chipPrimary,
        disabled && styles.chipDisabled,
        pressed && !disabled && styles.chipPressed,
      ]}
    >
      {icon}
      <Text
        size="xs"
        weight="semiBold"
        color={primary ? "#FFFFFF" : BrandColors.primary}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.lg,
    // Negative top margin so the card overlaps the hero map.
    marginTop: -Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  address: {
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: Spacing.xs,
  },
  chipPrimary: {
    backgroundColor: BrandColors.secondary,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipDisabled: {
    opacity: 0.4,
  },
});

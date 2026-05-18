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

import React, { useMemo, useState } from "react";
import { Linking, PixelRatio, Pressable, StyleSheet, View } from "react-native";

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

const ACTION_LABEL_MAX_SIZE = 12;
const ACTION_LABEL_MIN_SIZE = 10;
const ACTION_LABEL_LONGEST = "Directions";
const ACTION_LABEL_WIDTH_RATIO = 0.62;
const ACTION_BUTTON_COUNT = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getActionLabelSize(rowWidth: number, gap: number, horizontalPadding: number, fontScale: number): number {
  if (rowWidth <= 0) return ACTION_LABEL_MAX_SIZE;

  const chipWidth = (rowWidth - gap * (ACTION_BUTTON_COUNT - 1)) / ACTION_BUTTON_COUNT;
  const availableLabelWidth = chipWidth - horizontalPadding;
  const fittedSize =
    availableLabelWidth / (ACTION_LABEL_LONGEST.length * ACTION_LABEL_WIDTH_RATIO * fontScale);

  return clamp(fittedSize, ACTION_LABEL_MIN_SIZE, ACTION_LABEL_MAX_SIZE);
}

export function ShopHeroCard({
  shop,
  onSchedulePress,
  onSavePress,
  isSaved = false,
}: ShopHeroCardProps) {
  const [actionsWidth, setActionsWidth] = useState(0);
  const rating = typeof shop.rating === "number" ? shop.rating : null;
  const reviewCount = shop.reviewCount ?? 0;
  const distanceMi =
    typeof shop.distanceKm === "number"
      ? (shop.distanceKm * 0.621371).toFixed(1)
      : null;
  const actionLabelSize = useMemo(
    () =>
      getActionLabelSize(
        actionsWidth,
        Spacing.sm,
        Spacing.xs * 2,
        PixelRatio.getFontScale(),
      ),
    [actionsWidth],
  );

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

      <ActionRow
        onLayoutWidth={setActionsWidth}
        labelSize={actionLabelSize}
      >
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
      </ActionRow>
    </View>
  );
}

function ActionRow({
  children,
  labelSize,
  onLayoutWidth,
}: {
  children: React.ReactNode;
  labelSize: number;
  onLayoutWidth: (width: number) => void;
}) {
  return (
    <View
      style={styles.actions}
      onLayout={(event) => onLayoutWidth(event.nativeEvent.layout.width)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement<ActionChipProps>(child)
          ? React.cloneElement(child, { labelSize })
          : child,
      )}
    </View>
  );
}

interface ActionChipProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  primary?: boolean;
  disabled?: boolean;
  labelSize?: number;
}

function ActionChip({ icon, label, onPress, primary, disabled, labelSize = ACTION_LABEL_MAX_SIZE }: ActionChipProps) {
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
        size={labelSize}
        weight="semiBold"
        color={primary ? "#FFFFFF" : BrandColors.primary}
        numberOfLines={1}
        lineHeight={1.15}
        center
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

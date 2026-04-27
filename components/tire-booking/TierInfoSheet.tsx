/**
 * TierInfoSheet
 *
 * PURPOSE: Bottom sheet that explains a single tire tier — what it means,
 *          typical warranty range, and example brands. Opened from the (i)
 *          icon on each tier card on the Shop Tires screen.
 *
 * USED IN: app/(tire-booking)/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TIRE_TIERS, type TireTierId } from "@/constants/tireFlow";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface TierInfoSheetRef {
  open: (tierId: TireTierId) => void;
  close: () => void;
}

export const TierInfoSheet = forwardRef<TierInfoSheetRef>((_, ref) => {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [tierId, setTierId] = useState<TireTierId | null>(null);

  useImperativeHandle(ref, () => ({
    open: (id) => {
      setTierId(id);
      sheetRef.current?.open();
    },
    close: () => sheetRef.current?.close(),
  }));

  const tier = tierId ? TIRE_TIERS.find((t) => t.id === tierId) ?? null : null;

  return (
    <FloatingSheet ref={sheetRef} snapHeights={[Math.min(SCREEN_HEIGHT * 0.5, 380)]}>
      {tier ? (
        <View style={styles.content}>
          <Text size="xl" weight="bold" color="#1A1A1A" style={styles.title}>
            {tier.label}
          </Text>
          <Text size="sm" weight="regular" color="#4B5563" style={styles.tagline}>
            {tier.tagline}
          </Text>

          <View style={styles.row}>
            <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.rowLabel}>
              TYPICAL WARRANTY
            </Text>
            <Text size="md" weight="semiBold" color="#1A1A1A">
              {tier.warrantyRange}
            </Text>
          </View>

          <View style={styles.row}>
            <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.rowLabel}>
              EXAMPLE BRANDS
            </Text>
            <View style={styles.brandWrap}>
              {tier.brandSample.map((brand) => (
                <View key={brand} style={styles.brandPill}>
                  <Text size="sm" weight="medium" color="#1A1A1A">
                    {brand}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </FloatingSheet>
  );
});

TierInfoSheet.displayName = "TierInfoSheet";

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    marginBottom: 6,
  },
  tagline: {
    marginBottom: 20,
    lineHeight: 20,
  },
  row: {
    marginBottom: 18,
  },
  rowLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  brandWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
});

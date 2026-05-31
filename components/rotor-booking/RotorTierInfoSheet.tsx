/**
 * RotorTierInfoSheet
 *
 * PURPOSE: Bottom sheet that explains a single rotor tier — what it means
 *          and example brands. Opened from the (i) icon on each tier card.
 *          Mirrors TierInfoSheet from the tire flow.
 *
 * USED IN: app/(rotor-booking)/index.tsx
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { ROTOR_TIERS, type RotorTierId } from "@/constants/rotorFlow";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface RotorTierInfoSheetRef {
  open: (tierId: RotorTierId) => void;
  close: () => void;
}

export const RotorTierInfoSheet = forwardRef<RotorTierInfoSheetRef>((_, ref) => {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [tierId, setTierId] = useState<RotorTierId | null>(null);

  useImperativeHandle(ref, () => ({
    open: (id) => {
      setTierId(id);
      sheetRef.current?.open();
    },
    close: () => sheetRef.current?.close(),
  }));

  const tier = tierId ? ROTOR_TIERS.find((t) => t.id === tierId) ?? null : null;

  return (
    <FloatingSheet ref={sheetRef} snapHeights={[Math.min(SCREEN_HEIGHT * 0.42, 300)]} showBackdrop>
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
              WARRANTY
            </Text>
            <Text size="sm" weight="medium" color="#1A1A1A">
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

RotorTierInfoSheet.displayName = "RotorTierInfoSheet";

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

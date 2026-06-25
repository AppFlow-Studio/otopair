/**
 * ServiceInfoSheet — opens on ⓘ tap from a service row. Renders the
 * v5 taxonomy entry for the slug: label, subtitle, est-time, and
 * applicability ("Shows for: …") so the user understands what the
 * service is and why it's offered for their vehicle.
 *
 * Uses the shared FloatingSheet primitive with a single snap height
 * sized to the content. Backdrop dim (no blur) so the underlying
 * category screen stays readable.
 */

import React, { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Clock, Info } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateVerticalScale } from "react-native-size-matters";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import {
  getCappedSheetHeight,
  getOverlayClearance,
} from "@/components/booking-flow/responsiveSheetLayout";

interface ServiceInfoSheetProps {
  slug: string;
  onClose: () => void;
}

export function ServiceInfoSheet({ slug, onClose }: ServiceInfoSheetProps) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const entry = TAXONOMY[slug];
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    sheetRef.current?.open();
  }, []);

  // Compact single-snap sheet sized to the content. The exact height
  // doesn't matter — FloatingSheet snaps to whatever we pass and the
  // user dismisses by dragging down or tapping the backdrop.
  const snapHeight = getCappedSheetHeight({
    viewportHeight,
    desiredHeight: 420,
    minimumHeight: 260,
    maximumRatio: 0.45,
    absoluteMaximum: 420,
  });
  const contentBottomPadding = getOverlayClearance({
    safeAreaBottom: insets.bottom,
    overlayHeight: 0,
    extraSpacing: moderateVerticalScale(20, 0.3),
  });

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[snapHeight]}
      showBackdrop
      backdropMode="dim"
      onClose={onClose}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: contentBottomPadding },
        ]}
      >
        {entry ? (
          <>
            <Text size="2xl" weight="bold" color="#0F172A" style={styles.title}>
              {entry.label}
            </Text>
            <Text size="md" weight="regular" color="#374151" style={styles.subtitle}>
              {entry.subtitle}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={16} color="#6B7280" strokeWidth={2} />
                <Text size="sm" weight="medium" color="#6B7280">
                  {entry.estTimeLabel}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Info size={16} color="#6B7280" strokeWidth={2} />
                <Text size="sm" weight="medium" color="#6B7280">
                  Shows for: {entry.showsForLabel}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <Text size="md" weight="regular" color="#6B7280">
            No info available.
          </Text>
        )}
      </ScrollView>
    </FloatingSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 22,
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
  },
});

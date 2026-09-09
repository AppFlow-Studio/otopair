/**
 * PostOptimizeBookingSheet
 *
 * PURPOSE: Bottom sheet that slides up on the cars page right after the
 *          user finishes the "Optimize my vehicle profile" flow and is
 *          routed back to their specific car. Surfaces nearby shops with
 *          slots that match the vehicle's urgent maintenance items so the
 *          user can book in one tap.
 *
 * USED IN: app/(main-tabs)/home/cars/index.tsx (post-optimize gears dismiss)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { HealthSheetBookingCards } from "@/components/cars/HealthSheetBookingCards";
import { BrandColors } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface PostOptimizeBookingSheetProps {
  visible: boolean;
  onClose: () => void;
  maintenanceItems: { id: string; serviceName: string; status: string }[];
  /** e.g. "2024 Volkswagen Tiguan" — appears in the sheet title. */
  vehicleLabel?: string;
}

export function PostOptimizeBookingSheet({
  visible,
  onClose,
  maintenanceItems,
  vehicleLabel,
}: PostOptimizeBookingSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<FloatingSheetRef>(null);
  // Track the title's rendered line count so the sheet snap can grow
  // when a long vehicle label wraps to two lines (otherwise the cards
  // get pushed into the Book Later button on long titles).
  const [titleLines, setTitleLines] = useState(1);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  // Base snap fits the compact card carousel and footer. Each wrapped
  // title line adds space, while the cap keeps the sheet inside the
  // usable screen height on compact devices.
  const TITLE_LINE_HEIGHT = 28;
  const maxSheetHeight = SCREEN_HEIGHT - insets.top - Math.max(insets.bottom, 12) - 24;
  const sheetHeight = Math.min(
    maxSheetHeight,
    520 + Math.max(0, titleLines - 1) * TITLE_LINE_HEIGHT,
  );

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[sheetHeight]}
      showBackdrop
      onClose={onClose}
    >
      <View style={styles.content}>
        <Text
          size={28}
          weight="extraBold"
          color={BrandColors.primary}
          style={styles.title}
          onTextLayout={(e) => {
            const lines = e.nativeEvent.lines.length;
            if (lines > 0 && lines !== titleLines) setTitleLines(lines);
          }}
        >
          {vehicleLabel
            ? `Book a service for your ${vehicleLabel}`
            : "Book a service for your car"}
        </Text>
        <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
          We&apos;ve matched these shops to what your car needs next.
        </Text>

        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <HealthSheetBookingCards
            maintenanceItems={maintenanceItems}
            onClose={onClose}
          />
        </ScrollView>

        <View style={[styles.bookLaterRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.bookLaterWrap, pressed && styles.bookLaterPressed]}
          >
            <LinearGradient
              colors={["#7BB8FF", "#5299FE", "#3B7FEB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookLaterGradient}
            >
              <Text weight="bold" size="md" color="#FFFFFF">
                Book Later
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </FloatingSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
    marginBottom: 16,
  },
  cardScroll: {
    flex: 1,
    minHeight: 0,
  },
  cardScrollContent: {
    paddingBottom: 14,
  },
  bookLaterRow: {
    paddingTop: 8,
  },
  bookLaterWrap: {
    borderRadius: 16,
    overflow: "hidden",
  },
  bookLaterGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bookLaterPressed: {
    opacity: 0.9,
  },
});

export default PostOptimizeBookingSheet;

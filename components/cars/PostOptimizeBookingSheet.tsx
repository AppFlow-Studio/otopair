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
import { Dimensions, Pressable, StyleSheet, View } from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { HealthSheetBookingCards } from "@/components/cars/HealthSheetBookingCards";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface PostOptimizeBookingSheetProps {
  visible: boolean;
  onClose: () => void;
  maintenanceItems: Array<{ id: string; serviceName: string; status: string }>;
  /** e.g. "2024 Volkswagen Tiguan" — appears in the sheet title. */
  vehicleLabel?: string;
}

export function PostOptimizeBookingSheet({
  visible,
  onClose,
  maintenanceItems,
  vehicleLabel,
}: PostOptimizeBookingSheetProps) {
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

  // Base snap fits one-line title. Each extra wrapped title line adds
  // ~28pt (lg/bold line height). Cap at 85% of screen so we never push
  // off the top edge on small devices.
  const TITLE_LINE_HEIGHT = 28;
  const sheetHeight = Math.min(
    SCREEN_HEIGHT * 0.85,
    480 + Math.max(0, titleLines - 1) * TITLE_LINE_HEIGHT,
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
          size="lg"
          weight="bold"
          color="#0F172A"
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

        <View style={styles.cards}>
          <HealthSheetBookingCards
            maintenanceItems={maintenanceItems}
            onClose={onClose}
          />
        </View>

        <View style={styles.bookLaterRow}>
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
    paddingBottom: 8,
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
    marginBottom: 16,
  },
  cards: {
    // Let the cards size to their natural transformed height — no
    // flex:1 + overflow:hidden, which made the bottom clip look like a
    // section divider above the Not now button.
  },
  bookLaterRow: {
    // The cards' outer wrapper still occupies the un-scaled natural
    // height (transform doesn't shrink layout) — pull the CTA up so it
    // sits close to where the visual cards actually end.
    marginTop: -60,
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

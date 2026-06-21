/**
 * MechanicCarousel — Screen 3 horizontal scroll row.
 *
 * First card is always **Any** (silhouette icon + "Earliest"). The
 * rest are the shop's mechanics with their earliest available slot.
 * Selected card gets a blue ring border. Tap on Any clears selection;
 * tap on a name picks that mechanic.
 */

import React, { useCallback, useRef } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Check, User } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

export interface MechanicCarouselItem {
  /** null for the "Any" sentinel; mechanic _id for real mechanics. */
  mechanicId: string | null;
  /** Display name. "Any" for the sentinel. */
  name: string;
  /** Photo URL when available. */
  photoUrl: string | null;
  /** Earliest slot label ("Mon 9:00 AM") or "Earliest" for Any. */
  slotLabel: string;
  /** Show the verified check on real mechanics. */
  verified?: boolean;
}

interface MechanicCarouselProps {
  items: MechanicCarouselItem[];
  selectedMechanicId: string | null;
  onSelect: (mechanicId: string | null) => void;
  onInteractionChange: (isInteracting: boolean) => void;
}

const CARD_W = 96;

export function MechanicCarousel({
  items,
  selectedMechanicId,
  onSelect,
  onInteractionChange,
}: MechanicCarouselProps) {
  const isDraggingRef = useRef(false);

  const handleInteractionStart = useCallback(() => {
    onInteractionChange(true);
  }, [onInteractionChange]);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) {
      onInteractionChange(false);
    }
  }, [onInteractionChange]);

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    onInteractionChange(true);
  }, [onInteractionChange]);

  const handleInteractionEnd = useCallback(() => {
    isDraggingRef.current = false;
    onInteractionChange(false);
  }, [onInteractionChange]);

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      onTouchStart={handleInteractionStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleInteractionEnd}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleInteractionEnd}
      onMomentumScrollEnd={handleInteractionEnd}
    >
      {items.map((item) => {
        const isSelected = item.mechanicId === selectedMechanicId;
        const isAny = item.mechanicId === null;
        return (
          <Pressable
            key={item.mechanicId ?? "any"}
            style={styles.card}
            onPress={() => onSelect(item.mechanicId)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${item.name}, ${item.slotLabel}`}
          >
            <View
              style={[
                styles.avatarRing,
                isSelected && styles.avatarRingSelected,
              ]}
            >
              <View style={styles.avatar}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
                ) : isAny ? (
                  <User size={26} color="#6B7280" strokeWidth={2} />
                ) : (
                  <Text size="md" weight="bold" color="#4B5563">
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {item.verified ? (
                <View style={styles.verifiedBadge}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <Text
              size="sm"
              weight={isSelected ? "bold" : "semiBold"}
              color="#0F172A"
              style={styles.name}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              size="xs"
              weight="medium"
              color="#6B7280"
              style={styles.slot}
              numberOfLines={1}
            >
              {item.slotLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 14,
    paddingVertical: 4,
  },
  card: {
    width: CARD_W,
    alignItems: "center",
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    marginBottom: 6,
  },
  avatarRingSelected: {
    borderColor: "#5299FE",
    backgroundColor: "rgba(82, 153, 254, 0.12)",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E5EBF1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  verifiedBadge: {
    position: "absolute",
    right: 0,
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  name: {
    maxWidth: CARD_W,
    textAlign: "center",
  },
  slot: {
    maxWidth: CARD_W,
    textAlign: "center",
    marginTop: 1,
  },
});

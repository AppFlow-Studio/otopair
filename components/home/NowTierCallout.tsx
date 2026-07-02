/**
 * NowTierCallout — Action Engine "Now" surface for Home
 * (Yassin v1.1 §3.2: "Assertive card at top of Home, can push notify").
 *
 * Renders only when at least one Now-tier maintenance item exists
 * across the user's vehicles. Lifted into Home above
 * VehicleMaintenanceCard so the user sees the most urgent action
 * before browsing the carousel.
 *
 * Multi-item state: horizontal pager with one card per Now item +
 * pagination dots. Each card's "Book Service" CTA routes the user to
 * THAT item's vehicle/service — fixes the prior "+N more" UX where
 * the secondary affordance dropped you on the active vehicle, not the
 * one the +N referred to.
 *
 * Tier-change events are NOT emitted here — the Cars-page
 * useUrgencyRankedItems hook is the authoritative emitter for the
 * `urgency_tier_events` log so we don't double-count.
 */

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { moderateScale, scale } from "@/utils/responsive";

export interface NowCalloutItem {
  itemId: string;
  serviceName: string;
  description?: string;
  suggestedServiceId?: string;
  urgencyScore: number;
  vehicleVin: string;
  vehicleName: string;
  /** Cached VDB exterior shot for the vehicle (`vehicles.image_url`).
   *  Rendered top-right of each card when present. */
  vehicleImageUrl?: string;
}

interface NowTierCalloutProps {
  items: readonly NowCalloutItem[];
  /** Routes to the booking flow with the item's service pre-attached. */
  onBookNow: (item: NowCalloutItem) => void;
  /** Routes to the cars tab for the item's vehicle and opens the
   *  maintenance detail modal for that exact item. Fired when the user
   *  taps anywhere on the card body except the Book Service CTA. */
  onCardPress: (item: NowCalloutItem) => void;
}

// Each pager page is the full screen width — the outer container uses
// negative marginHorizontal to escape Home's paddingHorizontal: 16 so
// the ScrollView spans edge to edge. Cards inside each page apply their
// own marginHorizontal for breathing room. This matches the Resume
// Booking Service / Vehicle Setup carousel above: cards slide cleanly
// off the screen edge, the next card peeks from the opposite edge.
const PAGE_WIDTH = Dimensions.get("window").width;

function NowCard({
  item,
  onBookNow,
  onCardPress,
}: {
  item: NowCalloutItem;
  onBookNow: (item: NowCalloutItem) => void;
  onCardPress: (item: NowCalloutItem) => void;
}) {
  return (
    <View style={[styles.page, { width: PAGE_WIDTH }]}>
      {/* Whole card is pressable → opens the maintenance detail view
          for this item on the cars tab. The inner Book Service
          Pressable handles its own touches separately. */}
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => onCardPress(item)}
      >
        {item.vehicleImageUrl ? (
          <Image
            source={{ uri: item.vehicleImageUrl }}
            style={styles.carImage}
            contentFit="contain"
            transition={150}
          />
        ) : null}

        <View style={styles.dotRow}>
          <View style={styles.dot} />
          <Text weight="bold" style={styles.eyebrow}>
            NOW
          </Text>
        </View>

        <Text weight="bold" style={styles.title}>
          {item.serviceName}
        </Text>
        <Text style={styles.subtitle}>{item.vehicleName}</Text>
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={() => onBookNow(item)}
          >
            <Text weight="semiBold" style={styles.ctaText}>
              Book Service
            </Text>
            <Ionicons name="arrow-forward" size={scale(16)} color="#FFFFFF" />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

export function NowTierCallout({ items, onBookNow, onCardPress }: NowTierCalloutProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Clamp + realign the scroll position whenever the items array shifts.
  // When a booking gets made the urgency list often shrinks (the just-
  // booked item drops out) and the ScrollView's stale contentOffset
  // lands the viewport between two pages — the bug Ahmad caught where
  // a card "shrinks and hides behind the next one with the map peeking
  // through." Re-clamp the activeIndex to the new valid range and
  // imperatively scroll to it.
  useEffect(() => {
    if (items.length === 0) return;
    const clamped = Math.min(activeIndex, items.length - 1);
    if (clamped !== activeIndex) setActiveIndex(clamped);
    // Re-snap without animation so the realignment is invisible.
    scrollRef.current?.scrollTo({
      x: clamped * PAGE_WIDTH,
      y: 0,
      animated: false,
    });
  }, [items.length]);

  if (items.length === 0) return null;

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  return (
    <Animated.View entering={FadeInUp.duration(450)} style={styles.outer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        decelerationRate="fast"
        // Explicit snap reinforces pagingEnabled when the parent layout
        // recomputes mid-scroll (e.g. after a booking mutation re-renders
        // siblings). Without this, the viewport can settle on a half-page.
        snapToInterval={PAGE_WIDTH}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {items.map((item) => (
          <NowCard
            key={item.itemId}
            item={item}
            onBookNow={onBookNow}
            onCardPress={onCardPress}
          />
        ))}
      </ScrollView>

      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((_, i) => (
            <View
              key={i}
              style={[styles.pageDot, i === activeIndex && styles.pageDotActive]}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    // Negative marginHorizontal escapes the parent's paddingHorizontal:
    // 16 so the ScrollView spans the full screen width. Pages then
    // snap edge-to-edge (matches Resume Booking / Vehicle Setup
    // pager). Each card re-introduces a 16px inset for visual margin.
    marginTop: scale(20),
    marginBottom: scale(4),
    marginHorizontal: -16,
    // Drop the visible card down without nudging the
    // VehicleMaintenanceCard and everything below it — translate
    // doesn't affect layout flow, only paint position.
    transform: [{ translateY: scale(24) }],
  },
  page: {
    // Full-screen-wide slot that pagingEnabled snaps to. The card
    // inside applies its own marginHorizontal so the visible white
    // card stays inset from the screen edges.
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(24),
    paddingVertical: scale(18),
    paddingHorizontal: scale(20),
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    marginBottom: scale(8),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: "#EF4444",
  },
  eyebrow: {
    fontSize: moderateScale(11),
    color: "#EF4444",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: moderateScale(18),
    color: "#0F172A",
    // Reserve room for the absolute-positioned car image (top-right).
    // Wraps the title before it would collide with the artwork.
    paddingRight: scale(96),
  },
  subtitle: {
    fontSize: moderateScale(13),
    color: "#5F5E5A",
    marginTop: scale(2),
    paddingRight: scale(96),
  },
  description: {
    fontSize: moderateScale(13),
    color: "#475569",
    marginTop: scale(8),
    lineHeight: scale(18),
  },
  carImage: {
    position: "absolute",
    top: scale(14),
    right: scale(14),
    width: scale(96),
    height: scale(60),
  },
  actions: {
    // Full-width Book Service button — matches the "Book Package" CTA
    // in the Service Bundles card. Single child, no row gap needed.
    marginTop: scale(14),
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
    backgroundColor: "#5299FE",
    paddingVertical: scale(14),
    borderRadius: moderateScale(999),
  },
  ctaText: {
    fontSize: moderateScale(14),
    color: "#FFFFFF",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(6),
    marginTop: scale(10),
  },
  pageDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: moderateScale(3),
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  pageDotActive: {
    backgroundColor: "#5299FE",
    width: scale(18),
  },
});

export default NowTierCallout;

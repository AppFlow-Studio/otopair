/**
 * NowTierCallout — Action Engine "Now" surface for Home
 * (Yassin v1.1 §3.2: "Assertive card at top of Home, can push notify").
 *
 * Renders only when at least one Now-tier maintenance item exists
 * across the user's vehicles. Lifted into Home above
 * VehicleMaintenanceCard so the user sees the most urgent action
 * before browsing the carousel.
 *
 * Grouped-by-vehicle pager. Each pager page is one CAR (not one item):
 *   - Cars with a single NOW item render `NowCard` — the original
 *     single-service layout (car photo, service name, description,
 *     Book Service CTA).
 *   - Cars with 2+ items render `NowMultiCard` — car name + a list
 *     of checkable service rows, all checked by default, with a
 *     "Book (N)" CTA that seeds every checked service into the flow.
 *
 * Tier-change events are NOT emitted here — the Cars-page
 * useUrgencyRankedItems hook is the authoritative emitter for the
 * `urgency_tier_events` log so we don't double-count.
 */

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

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

/** One pager page = one vehicle. Items are that vehicle's NOW-tier
 *  maintenance items, sorted by urgencyScore desc. */
export interface NowCalloutGroup {
  vehicleVin: string;
  vehicleName: string;
  vehicleImageUrl?: string;
  items: NowCalloutItem[];
  /** Max urgencyScore across items — used at the caller so the most
   *  urgent vehicle's card lands first in the pager. */
  topUrgency: number;
  /** True while the post-service health write is still queued (the two-hour
   *  deferral in inspectionHealthDeferred). The items shown are pre-service,
   *  so the card states that rather than offering to book the work again. */
  healthPending?: boolean;
}

interface NowTierCalloutProps {
  groups: readonly NowCalloutGroup[];
  /** Routes to the booking flow with the checked services pre-attached. */
  onBookNow: (group: NowCalloutGroup, selectedItems: NowCalloutItem[]) => void;
  /** Single-card path: tap card body → cars tab with the single item's
   *  detail modal open. Multi-card path: tap header only → cars tab for
   *  the vehicle (no per-item detail). */
  onCardPress: (group: NowCalloutGroup, item?: NowCalloutItem) => void;
}

const PAGE_WIDTH = Dimensions.get("window").width;

function NowCard({
  group,
  onBookNow,
  onCardPress,
  onHeight,
}: {
  group: NowCalloutGroup;
  onBookNow: (group: NowCalloutGroup, selectedItems: NowCalloutItem[]) => void;
  onCardPress: (group: NowCalloutGroup, item?: NowCalloutItem) => void;
  onHeight?: (h: number) => void;
}) {
  const item = group.items[0];
  return (
    <View
      style={[styles.page, { width: PAGE_WIDTH, alignSelf: "flex-start" }]}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => onCardPress(group, item)}
      >
        {group.vehicleImageUrl ? (
          <Image
            source={{ uri: group.vehicleImageUrl }}
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
        <Text style={styles.subtitle}>{group.vehicleName}</Text>
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}

        <View style={styles.actions}>
          {group.healthPending ? (
            <View style={styles.pendingNote}>
              <Ionicons name="time-outline" size={scale(16)} color="#5299FE" />
              <Text weight="semiBold" style={styles.pendingText}>
                Updating after your service
              </Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              onPress={() => onBookNow(group, [item])}
            >
              <Text weight="semiBold" style={styles.ctaText}>
                Book Service
              </Text>
              <Ionicons name="arrow-forward" size={scale(16)} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
}

function NowMultiCard({
  group,
  onBookNow,
  onCardPress,
  onHeight,
}: {
  group: NowCalloutGroup;
  onBookNow: (group: NowCalloutGroup, selectedItems: NowCalloutItem[]) => void;
  onCardPress: (group: NowCalloutGroup, item?: NowCalloutItem) => void;
  onHeight?: (h: number) => void;
}) {
  // All rows checked by default (locked decision — user opts OUT of items
  // they don't want rather than opting in). Re-seed if the group's items
  // change identity (rare — usually only after a booking mutation).
  const initial = useMemo(
    () => new Set(group.items.map((i) => i.itemId)),
    [group.items],
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(initial);
  useEffect(() => setCheckedIds(initial), [initial]);

  const toggle = (itemId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const checkedCount = checkedIds.size;
  const canBook = checkedCount > 0;

  return (
    <View
      style={[styles.page, { width: PAGE_WIDTH, alignSelf: "flex-start" }]}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.card}>
        {group.vehicleImageUrl ? (
          <Image
            source={{ uri: group.vehicleImageUrl }}
            style={styles.carImage}
            contentFit="contain"
            transition={150}
          />
        ) : null}

        <Pressable
          onPress={() => onCardPress(group)}
          style={({ pressed }) => [styles.multiHeader, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.dotRow}>
            <View style={styles.dot} />
            <Text weight="bold" style={styles.eyebrow}>
              NOW
            </Text>
          </View>

          <Text weight="bold" style={styles.title}>
            {group.vehicleName}
          </Text>
          <Text style={styles.subtitle}>
            {group.items.length} services due now
          </Text>
        </Pressable>

        <View style={styles.multiList}>
          {group.items.map((item) => {
            const isChecked = checkedIds.has(item.itemId);
            return (
              <Pressable
                key={item.itemId}
                onPress={() => toggle(item.itemId)}
                style={({ pressed }) => [
                  styles.multiRow,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View
                  style={[
                    styles.check,
                    isChecked ? styles.checkOn : styles.checkOff,
                  ]}
                >
                  {isChecked ? (
                    <Ionicons name="checkmark" size={scale(14)} color="#FFFFFF" />
                  ) : null}
                </View>
                <View style={styles.multiRowText}>
                  <Text weight="semiBold" style={styles.multiRowTitle}>
                    {item.serviceName}
                  </Text>
                  {item.description ? (
                    <Text style={styles.multiRowDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          {group.healthPending ? (
            <View style={styles.pendingNote}>
              <Ionicons name="time-outline" size={scale(16)} color="#5299FE" />
              <Text weight="semiBold" style={styles.pendingText}>
                Updating after your service
              </Text>
            </View>
          ) : (
            <Pressable
              disabled={!canBook}
              style={({ pressed }) => [
                styles.cta,
                !canBook && styles.ctaDisabled,
                pressed && canBook && { opacity: 0.85 },
              ]}
              onPress={() => {
                if (!canBook) return;
                const selected = group.items.filter((i) =>
                  checkedIds.has(i.itemId),
                );
                onBookNow(group, selected);
              }}
            >
              <Text weight="semiBold" style={styles.ctaText}>
                {canBook ? `Book (${checkedCount})` : "Book"}
              </Text>
              <Ionicons name="arrow-forward" size={scale(16)} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// Small gap between the bottom of the active card and the dots row.
// Kept tight — Ahmad wants the indicator hugging the card so it feels
// like part of the group, not a floating footer.
const DOTS_GAP = 8;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export function NowTierCallout({ groups, onBookNow, onCardPress }: NowTierCalloutProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // Per-page card height (populated via each page slot's onLayout).
  // Drives the pager container height so it snugly wraps the active
  // card, no matter which variant is showing (single card is short;
  // multi card grows with the row count).
  const [heights, setHeights] = useState<Record<number, number>>({});
  // Same data, mirrored to a shared value so the animated height style
  // (which runs on the UI thread) can read it without hopping to JS.
  const heightsSV = useSharedValue<Record<number, number>>({});
  const scrollX = useSharedValue(0);

  // Clamp + realign the scroll position whenever the groups array shifts.
  // When a booking gets made the urgency list often shrinks (the just-
  // booked item drops out) and the ScrollView's stale contentOffset
  // lands the viewport between two pages — the bug Ahmad caught where
  // a card "shrinks and hides behind the next one with the map peeking
  // through." Re-clamp the activeIndex to the new valid range and
  // imperatively scroll to it.
  useEffect(() => {
    if (groups.length === 0) return;
    const clamped = Math.min(activeIndex, groups.length - 1);
    if (clamped !== activeIndex) setActiveIndex(clamped);
    scrollRef.current?.scrollTo({
      x: clamped * PAGE_WIDTH,
      y: 0,
      animated: false,
    });
  }, [groups.length]);

  const reportHeight = (index: number, h: number) => {
    setHeights((prev) => {
      if (prev[index] === h) return prev;
      const next = { ...prev, [index]: h };
      // Mirror to the shared value so useAnimatedStyle picks up the
      // new measurement without a JS→UI round trip.
      heightsSV.value = next;
      return next;
    });
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Pager container height = active card height, interpolated during
  // a swipe so the container smoothly grows / shrinks between two
  // cards of different heights. Falls back to `auto` (no explicit
  // height) until we have at least one measurement.
  const containerHeightStyle = useAnimatedStyle(() => {
    const arr = heightsSV.value;
    const idxFloat = PAGE_WIDTH > 0 ? scrollX.value / PAGE_WIDTH : 0;
    const lower = Math.max(0, Math.floor(idxFloat));
    const upper = lower + 1;
    const lowerH = arr[lower];
    const upperH = arr[upper] ?? lowerH;
    if (lowerH == null) return {};
    const t = Math.max(0, Math.min(1, idxFloat - lower));
    return { height: lowerH + ((upperH ?? lowerH) - lowerH) * t };
  });

  if (groups.length === 0) return null;

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  return (
    <Animated.View entering={FadeInUp.duration(450)} style={styles.outer}>
      <Animated.View style={[styles.pagerHost, containerHeightStyle]}>
        <AnimatedScrollView
          ref={scrollRef as React.Ref<ScrollView>}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={1}
          onMomentumScrollEnd={onMomentumScrollEnd}
          decelerationRate="fast"
          snapToInterval={PAGE_WIDTH}
          snapToAlignment="start"
          disableIntervalMomentum
          style={styles.pagerScroll}
        >
          {groups.map((group, i) =>
            group.items.length === 1 ? (
              <NowCard
                key={group.vehicleVin}
                group={group}
                onBookNow={onBookNow}
                onCardPress={onCardPress}
                onHeight={(h) => reportHeight(i, h)}
              />
            ) : (
              <NowMultiCard
                key={group.vehicleVin}
                group={group}
                onBookNow={onBookNow}
                onCardPress={onCardPress}
                onHeight={(h) => reportHeight(i, h)}
              />
            ),
          )}
        </AnimatedScrollView>
      </Animated.View>

      {groups.length > 1 ? (
        <View style={styles.dots}>
          {groups.map((_, i) => (
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
    marginTop: scale(20),
    marginBottom: scale(4),
    marginHorizontal: -16,
    transform: [{ translateY: scale(24) }],
  },
  page: {
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
  ctaDisabled: {
    opacity: 0.4,
  },
  pendingNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderRadius: scale(999),
    backgroundColor: "#EAF2FF",
  },
  pendingText: {
    fontSize: scale(14),
    color: "#2E6BF0",
  },
  ctaText: {
    fontSize: moderateScale(14),
    color: "#FFFFFF",
  },
  pagerHost: {
    // Wraps the ScrollView with an animated height so the container
    // snugly matches the active card (short single-card cards get a
    // short container; multi-service cards get a taller one). Height
    // interpolates during swipes for a smooth transition.
    overflow: "hidden",
  },
  pagerScroll: {
    flex: 1,
  },
  dots: {
    // Sits in flow layout right below the pager host — since the host
    // grows/shrinks with the active card, the dots always land ~8pt
    // below whichever card is showing.
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(6),
    marginTop: DOTS_GAP,
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
  // Multi-card only ───────────────────────────────────────────────
  multiHeader: {
    // Space reserved to the right so the car image (absolute top-right
    // of the card) doesn't collide with the title.
    paddingRight: scale(96),
  },
  multiList: {
    marginTop: scale(14),
    gap: scale(4),
  },
  multiRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(12),
    paddingVertical: scale(8),
  },
  check: {
    width: scale(22),
    height: scale(22),
    borderRadius: moderateScale(11),
    alignItems: "center",
    justifyContent: "center",
    marginTop: scale(1),
  },
  checkOn: {
    backgroundColor: "#5299FE",
    borderWidth: 0,
  },
  checkOff: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  multiRowText: {
    flex: 1,
    minWidth: 0,
  },
  multiRowTitle: {
    fontSize: moderateScale(15),
    color: "#0F172A",
  },
  multiRowDesc: {
    fontSize: moderateScale(12),
    color: "#64748B",
    marginTop: scale(2),
    lineHeight: scale(16),
  },
});

export default NowTierCallout;

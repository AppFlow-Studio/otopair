/**
 * HeroCardMostBooked — Screen 1 hero card.
 *
 * NOTE: Kept the file name for import stability, but the semantics
 * pivoted per Ahmad — this now shows the user's MOST RECENT
 * BOOKING (shop + service) rather than the platform-wide most-
 * booked service. Tap opens that shop's detail page (same
 * destination as HeroCardClosestShop so the two hero cards feel
 * like siblings).
 *
 * Empty state (no bookings yet) keeps the flame flavor with
 * "Nothing yet" — a first-timer will just see the closest-shop
 * card carrying the interaction weight next to it.
 */

import React, { useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { History } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow } from "@/constants/theme";
import { useMostRecentBooking } from "@/hooks/useMostRecentBooking";
import { useBookingStore } from "@/stores/useBookingStore";

/** Collapse the services list into one line: single service by
 *  label, multiple as "First + N more". Cap the display label at
 *  a sensible length so the card doesn't blow out on unusually
 *  long labels. */
function formatServicesLabel(services: string[]): string {
  if (services.length === 0) return "Service";
  if (services.length === 1) return services[0];
  return `${services[0]} + ${services.length - 1} more`;
}

export function HeroCardMostBooked() {
  const router = useRouter();
  const { booking, isLoading } = useMostRecentBooking();

  // Store handles for the one-tap re-book flow: fill the cart
  // with the same services and pin the shop, then jump the user
  // straight to the date/time picker (the "checkout" step).
  const availableServices = useBookingStore((s) => s.availableServices);
  const clearSelectedServices = useBookingStore((s) => s.clearSelectedServices);
  const toggleServiceSelection = useBookingStore(
    (s) => s.toggleServiceSelection,
  );
  const setPreSelectedShop = useBookingStore((s) => s.setPreSelectedShop);

  const onPress = useCallback(() => {
    if (!booking?.shopId) return;

    // Tire / rotor quote bookings live in their own flow (they
    // don't use the standard cart). Route those to the shop
    // detail page — from there the Book Service CTA hands off
    // to the right dedicated flow.
    if (booking.quoteType) {
      router.push({
        pathname: "/booking/shop/[id]",
        params: { id: booking.shopId },
      });
      return;
    }

    // Reverse-lookup service IDs from the booking's stored label
    // list against the current catalog. Match by `name` or
    // `displayLabel` — both fields hold user-visible strings that
    // Convex might have written into the booking snapshot. Skip
    // any label that no longer resolves (rare — catalog reseed,
    // deleted service).
    const matchedIds: string[] = [];
    for (const label of booking.services) {
      const svc = availableServices.find(
        (s) => s.name === label || s.displayLabel === label,
      );
      if (svc) matchedIds.push(svc.id);
    }

    clearSelectedServices();
    for (const id of matchedIds) toggleServiceSelection(id);
    setPreSelectedShop(booking.shopId);

    // Jump straight to the date/time picker. Empty `mechanicId`
    // param = "Any mechanic"; the user can change it in the
    // picker if they want the same person as last time.
    router.push({
      pathname: "/(booking-flow)/pick-datetime",
      params: {
        shopId: booking.shopId,
        mechanicId: booking.mechanicId ?? "",
      },
    });
  }, [
    booking,
    router,
    availableServices,
    clearSelectedServices,
    toggleServiceSelection,
    setPreSelectedShop,
  ]);

  const hasBooking = !!booking;
  const servicesLabel = booking ? formatServicesLabel(booking.services) : null;

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      disabled={!hasBooking}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={
        booking
          ? `Most recent booking: ${servicesLabel} at ${booking.shopName}`
          : "Loading most recent booking"
      }
    >
      {Platform.OS === "ios" ? (
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.iconWrap}>
        <History size={20} color="#4B5563" strokeWidth={2} />
      </View>
      <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
        MOST RECENT
      </Text>
      <Text
        size="lg"
        weight="bold"
        color="#0F172A"
        style={styles.title}
        numberOfLines={2}
      >
        {booking?.shopName ?? (isLoading ? "Loading…" : "Nothing yet")}
      </Text>
      {booking ? (
        <Text
          size="sm"
          weight="regular"
          color="#6B7280"
          style={styles.subtitle}
          numberOfLines={1}
        >
          {servicesLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    minHeight: 160,
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  eyebrow: {
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6,
  },
  subtitle: {
    marginTop: 2,
  },
});

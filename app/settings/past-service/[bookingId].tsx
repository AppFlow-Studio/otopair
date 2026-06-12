/**
 * Past Service Detail
 *
 * PURPOSE: Shop-style "Order detail" view for a single completed booking.
 *          Hero card (shop wordmark + order # + date), Review card,
 *          Completed card, Services card with View receipt CTA, and a
 *          "Book again" card. View receipt pushes the
 *          `settings/receipt/[bookingId]` route, which is configured as
 *          a native iOS formSheet in `app/settings/_layout.tsx`. Review
 *          opens <LeaveReviewSheet />.
 *
 * USED IN: Settings → Past Services → row tap (and the Recommended-
 *          services deep link for resolved rows).
 */

import React, { useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { MoreHorizontal, Star, Wrench } from "lucide-react-native";

import { GlassSheetBackground } from "@/components/booking-flow/GlassSheet";
import {
  LeaveReviewSheet,
  type LeaveReviewSheetRef,
} from "@/components/bookings/LeaveReviewSheet";
import {
  DisputeSheet,
  type DisputeSheetRef,
} from "@/components/past-services/DisputeSheet";
import {
  PastServiceActionsSheet,
  type PastServiceActionsSheetRef,
} from "@/components/past-services/PastServiceActionsSheet";
import { ReceiptSheet } from "@/components/receipts/ReceiptSheet";
import { Text } from "@/components/shared-ui";
import { CardShadow, SurfaceColors } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { getServiceIcon } from "@/utils/serviceIcons";

const INK = "#0F172A";
const MUTED = "#86868B";
const HAIRLINE = "#E5E7EB";
const ACCENT = "#5299FE";

function fmtUSD(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function shortOrderNumber(bookingId: string): string {
  return bookingId.slice(-8).toUpperCase();
}

export default function PastServiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { historyBookings, isLoading } = useMyBookingsWithDetails();
  const { userId } = useUserFromConvex();

  const booking = useMemo(
    () => historyBookings.find((b) => b.id === bookingId) ?? null,
    [historyBookings, bookingId],
  );

  const reviewedBookingIds = useQuery(
    api.reviews.listReviewedBookingIdsForUser,
    userId ? { userId } : "skip",
  );

  // Receipt payload — fetched here so each service row can show its
  // per-line price (Shop-style) beneath the service name. Only the
  // service-type line items are used; parts (if any) are ignored
  // here since the page only renders booking.services.
  const receiptData = useQuery(
    api.bookings.getReceipt,
    bookingId ? { bookingId: bookingId as Id<"bookings"> } : "skip",
  );
  const servicePriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (receiptData) {
      for (const line of receiptData.line_items) {
        if (line.type === "service" && line.labor_cost != null) {
          map.set(line.name, line.labor_cost);
        }
      }
    }
    return map;
  }, [receiptData]);
  const reviewedSet = useMemo(
    () => new Set(reviewedBookingIds ?? []),
    [reviewedBookingIds],
  );
  const isReviewed = bookingId ? reviewedSet.has(bookingId) : false;

  const reviewSheetRef = useRef<LeaveReviewSheetRef>(null);
  const actionsSheetRef = useRef<PastServiceActionsSheetRef>(null);
  const disputeSheetRef = useRef<DisputeSheetRef>(null);
  const [receiptBookingId, setReceiptBookingId] = useState<Id<"bookings"> | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings/transactions");
  };

  const handleReview = () => {
    if (!booking || !userId) return;
    reviewSheetRef.current?.open(booking, String(userId));
  };

  const handleReviewWithRating = (initialRating: number) => {
    if (!booking || !userId) return;
    reviewSheetRef.current?.open(booking, String(userId), initialRating);
  };

  const handleBookAgain = () => {
    if (!booking?.shopId) {
      router.push("/booking/map");
      return;
    }
    // TODO: have /booking/map honor the shopId param to pre-select.
    router.push({
      pathname: "/booking/map",
      params: { shopId: booking.shopId },
    });
  };

  // Hero "•••" → action sheet → routes to one of three handlers.
  // The DisputeSheet handles its own Convex action; the screen only
  // needs to open it. Delete is informational for now (no persisted
  // hide) — confirms intent, then drops back to the list. Hooking up
  // a real "hide from history" persisted field is a follow-up that
  // needs a schema change.
  const handleOpenActions = () => actionsSheetRef.current?.open();

  const handleReportIssue = () => disputeSheetRef.current?.open();

  const handleViewShopInfo = () => {
    if (!booking?.shopId) return;
    router.push({
      pathname: "/booking/shop/[id]",
      params: { id: booking.shopId },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove this service?",
      "It'll be hidden from your history. The receipt and any review you left stay on the shop's side.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            // TODO(persisted hide): once we land a `dismissed_at_ms`
            // field on bookings, call the mutation here. For now we
            // just back out so the user gets feedback.
            if (router.canGoBack()) router.back();
            else router.replace("/settings/transactions");
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={styles.screen}>
        <GlassSheetBackground style={StyleSheet.absoluteFill} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 32,
            },
          ]}
        >
          {booking ? (
            <>
              {/* Hero card. The AppleZoomTarget is an invisible overlay
                  covering the same area — keeping it OUTSIDE the
                  visible content avoids the `display: 'contents'`
                  collapse that hides text rendered as its direct child. */}
              <View style={styles.heroHost}>
                <View style={styles.heroCard}>
                  <Text
                    weight="bold"
                    color={INK}
                    style={styles.heroBrand}
                    numberOfLines={2}
                  >
                    {booking.shopName}
                  </Text>
                  <Text weight="semiBold" size="sm" color={INK} style={styles.heroOrder}>
                    Order #{shortOrderNumber(booking.id)}
                  </Text>
                  <Text size="sm" color={MUTED} style={styles.heroDate}>
                    {booking.date}
                  </Text>
                </View>
                <Pressable
                  style={styles.heroMoreBtn}
                  onPress={handleOpenActions}
                  hitSlop={10}
                  accessibilityLabel="Service options"
                >
                  <MoreHorizontal size={18} color={INK} strokeWidth={2.2} />
                </Pressable>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Link.AppleZoomTarget>
                    <View style={styles.zoomTarget} />
                  </Link.AppleZoomTarget>
                </View>
              </View>

              {/* Review — TEMP: always rendered regardless of review
                  state. Wrap back in `{!isReviewed && (…)}` when we're
                  ready to hide it post-review. */}
              <Pressable
                onPress={handleReview}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.reviewLeft}>
                  <Text weight="bold" size="sm" color={INK}>
                    Review your service
                  </Text>
                  <Text size="sm" color={MUTED} style={{ marginTop: 2 }}>
                    Tell us about your experience
                  </Text>
                </View>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => handleReviewWithRating(n)}
                      hitSlop={6}
                      style={styles.starHit}
                    >
                      <Star
                        size={18}
                        color="#CBD5E1"
                        strokeWidth={1.5}
                      />
                    </Pressable>
                  ))}
                </View>
              </Pressable>

              {/* Completed */}
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text weight="bold" size="sm" color={INK}>
                    Completed {booking.date}
                  </Text>
                  <Text size="sm" color={MUTED} style={{ marginTop: 2 }}>
                    {booking.mechanicName} · {booking.time}
                  </Text>
                </View>
              </View>

              {/* Services + View receipt */}
              <View style={[styles.card, styles.servicesCard]}>
                {booking.services.map((service, i) => {
                  const iconAsset = getServiceIcon(service);
                  const price = servicePriceMap.get(service);
                  return (
                    <View
                      key={`${service}-${i}`}
                      style={styles.serviceRow}
                    >
                      <View style={styles.serviceIcon}>
                        {iconAsset ? (
                          <Image
                            source={iconAsset}
                            style={styles.serviceIconImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <Wrench size={18} color={ACCENT} strokeWidth={1.8} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          weight="bold"
                          size="sm"
                          color={INK}
                          numberOfLines={2}
                        >
                          {service}
                        </Text>
                        {price != null && (
                          <Text size="sm" color={MUTED} style={{ marginTop: 2 }}>
                            {fmtUSD(price)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={() => setReceiptBookingId(booking.id as Id<"bookings">)}
                  style={({ pressed }) => [
                    styles.viewReceiptBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text weight="semiBold" size="sm" color={INK}>
                    View receipt
                  </Text>
                </Pressable>
              </View>

              {/* Flex spacer — pushes the Book again pill down to
                  the bottom of the viewport when the content above
                  is short. Collapses to its minHeight when the
                  services list pushes the page past the viewport. */}
              <View style={styles.spacer} />

              {/* Book again */}
              <Pressable
                onPress={handleBookAgain}
                style={({ pressed }) => [
                  styles.bookAgainCard,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text weight="semiBold" size="sm" color="#FFFFFF">
                  Book again with {booking.shopName}
                </Text>
              </Pressable>
            </>
          ) : isLoading ? (
            <PastServiceSkeleton />
          ) : (
            <View style={styles.emptyState}>
              <Text weight="semiBold" size="sm" color={INK} center>
                Service not found
              </Text>
              <Text size="sm" color={MUTED} center style={{ marginTop: 6 }}>
                We couldn&apos;t load this past service.
              </Text>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.errorBackBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text weight="semiBold" size="sm" color="#FFFFFF">
                  Back to Past Services
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      <LeaveReviewSheet ref={reviewSheetRef} />
      <ReceiptSheet
        bookingId={receiptBookingId}
        onClose={() => setReceiptBookingId(null)}
      />
      <PastServiceActionsSheet
        ref={actionsSheetRef}
        onReportIssue={handleReportIssue}
        onViewShopInfo={handleViewShopInfo}
        onDelete={handleDelete}
      />
      <DisputeSheet
        ref={disputeSheetRef}
        bookingId={booking?.id ?? null}
      />
    </>
  );
}

function PastServiceSkeleton() {
  return (
    <>
      <View style={[styles.heroCard, styles.skeletonBlock]}>
        <View style={[styles.skeletonBar, { width: "55%", height: 28 }]} />
        <View
          style={[styles.skeletonBar, { width: "40%", height: 14, marginTop: 14 }]}
        />
        <View
          style={[styles.skeletonBar, { width: "30%", height: 12, marginTop: 8 }]}
        />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { height: 72 }]} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Solid backstop matching the top of the glass gradient so the
    // edges don't flash white during route push/pop.
    backgroundColor: "#CFE0EB",
  },
  scrollContent: {
    paddingHorizontal: 16,
    // `flexGrow: 1` lets the content container stretch to the full
    // scroll viewport height when the natural content height is
    // shorter. Combined with the <Spacer /> View below the services
    // card, the Book again pill pins to the bottom on sparse
    // bookings (1 service) and naturally floats up when the list
    // fills the page (5+ services).
    flexGrow: 1,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  heroHost: {
    position: "relative",
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: "center",
    boxShadow: CardShadow.default,
  },
  heroMoreBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    // Sit above the AppleZoomTarget overlay so the tap registers
    // on this Pressable instead of getting swallowed by the
    // route-transition source.
    zIndex: 5,
  },
  zoomTarget: {
    flex: 1,
    backgroundColor: "transparent",
  },
  heroBrand: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  heroOrder: {
    marginTop: 16,
  },
  heroDate: {
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SurfaceColors.cardSurface,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
    boxShadow: CardShadow.default,
  },
  cardPressed: {
    opacity: 0.85,
  },
  reviewLeft: {
    flex: 1,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
  },
  starHit: {
    padding: 2,
  },
  servicesCard: {
    flexDirection: "column",
    alignItems: "stretch",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 6,
  },
  serviceRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(82,153,254,0.10)",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: CardShadow.default,
  },
  serviceIconImage: {
    width: 70,
    height: 70,
  },
  viewReceiptBtn: {
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  bookAgainCard: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    // Top gap comes from the flex <Spacer /> above; the spacer's
    // minHeight (12) is the minimum cushion between Book again and
    // the services card. Trailing space is left to the ScrollView's
    // paddingBottom (insets.bottom + 32).
    marginBottom: 0,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  errorBackBtn: {
    marginTop: 18,
    backgroundColor: ACCENT,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  skeletonBlock: {
    alignItems: "flex-start",
  },
  skeletonBar: {
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
  },
});

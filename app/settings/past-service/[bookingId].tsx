/**
 * Past Service Detail — the report
 *
 * Reads as an account of what happened to the car rather than a bill: a
 * plain-English headline, the work performed, the technician who did it, their
 * findings as the centrepiece, odometer in/out, and money collapsed to a single
 * row that opens the full receipt.
 *
 * Sits on the shared Oto ambient gradient so it belongs to the Service Record
 * list it's pushed from.
 *
 * The headline never names a service. An order can carry any number of them,
 * so it says "Your Tiguan was serviced" and the services live in their own
 * list — naming one in the headline silently hid the rest.
 *
 * Type comes from ServiceLogFonts (constants/theme.ts) — roles, not families —
 * so the whole typographic system for these three surfaces swaps in one place.
 * Uses RN Text rather than shared-ui <Text> because these screens need weights
 * and tracking that component does not expose.
 *
 * USED IN: Settings → Past Services → row tap (and the Recommended-services
 *          deep link for resolved rows).
 */

import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useQuery } from "convex/react";
import { ArrowLeft, Check, ChevronRight, MoreHorizontal, Star, X } from "lucide-react-native";

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
import { OtoGradient, ServiceLogColors as C, ServiceLogFonts as F } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";

/**
 * `Link.AppleZoomTarget` only exists on iOS builds of expo-router, and pairs
 * with `Link.AppleZoom` on the list row that pushed here — see
 * app/settings/transactions.tsx. Looked up optionally so Android and older
 * router versions fall through to a plain push.
 */
type AppleZoomRouterLink = typeof Link & {
  AppleZoomTarget?: React.ComponentType<React.PropsWithChildren>;
};

const AppleZoomTarget =
  Platform.OS === "ios" ? (Link as AppleZoomRouterLink).AppleZoomTarget : undefined;

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtMiles(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

/** "1 HR LABOR" / "1.5 HRS LABOR". Singular only at exactly 1. */
function fmtLaborHours(hours: number): string {
  return `${hours} ${hours === 1 ? "HR" : "HRS"} LABOR`;
}

/** Ratings are stored as raw averages (4.555555555555555). One decimal, and
 *  drop a trailing ".0" so a clean 5 doesn't render as "5.0". */
function fmtRating(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** One row of the mechanic's per-cycle reasoning, mirroring the `adjustments`
 *  shape returned by `bookings.getReceipt`. */
type Adjustment = {
  cycle: string;
  cycle_label: string;
  note: string;
  at: number;
  total_cents: number;
};

/**
 * "Volkswagen Tiguan 2.0T SE R-Line" → "Tiguan", for the headline. Mirrors the
 * same extraction the list screen uses for its channel labels.
 */
function extractModel(full: string): string {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return full;
  if (tokens[1].toLowerCase() === "model" && tokens[2]) {
    return `${tokens[1]} ${tokens[2]}`;
  }
  if (/^\d+$/.test(tokens[1]) && tokens[2]?.toLowerCase() === "series") {
    return `${tokens[1]} ${tokens[2]}`;
  }
  return tokens[1];
}

// ============================================================================
// SCREEN
// ============================================================================

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

  // Gated on the resolved booking, not the raw route param: Convex throws on a
  // malformed id, which takes the whole screen down before the not-found state
  // can render. Waiting for the booking to resolve means we only ever pass an
  // id that came from a real row.
  const receiptData = useQuery(
    api.bookings.getReceipt,
    booking ? { bookingId: booking.id as Id<"bookings"> } : "skip",
  );

  const reviewSheetRef = useRef<LeaveReviewSheetRef>(null);
  const actionsSheetRef = useRef<PastServiceActionsSheetRef>(null);
  const disputeSheetRef = useRef<DisputeSheetRef>(null);
  const [receiptBookingId, setReceiptBookingId] = useState<Id<"bookings"> | null>(null);
  // The mechanic photo being viewed full-screen, or null when the lightbox is
  // closed. Tapping any thumbnail opens it; tapping the backdrop closes it.
  const [viewerPhoto, setViewerPhoto] = useState<{
    url: string;
    caption: string | null;
  } | null>(null);

  /** Prefer the receipt's service lines — they carry labor hours the booking
   *  row doesn't. Fall back to plain service names.
   *
   *  Typed explicitly: `getReceipt`'s return is inferred through the Convex
   *  api surface, and once bookings.ts grew past a certain size TypeScript
   *  gave up and widened `line_items` to `any`, which silently made every
   *  callback parameter here implicitly-any. */
  const services = useMemo<{ name: string; hours: number | null }[]>(() => {
    const lineItems: { type: string; name?: string; labor_hours?: number | null }[] =
      receiptData?.line_items ?? [];
    const lines = lineItems.filter((l) => l.type === "service");
    if (lines.length > 0) {
      return lines.map((l) => ({
        name: l.name ?? "Service",
        hours: l.labor_hours ?? null,
      }));
    }
    return (booking?.services ?? []).filter(Boolean).map((name: string) => ({
      name,
      hours: null,
    }));
  }, [receiptData, booking]);

  const mechanic = receiptData?.mechanic ?? null;
  const mechanicFirstName = mechanic?.first_name?.trim() || null;
  // The mechanic's customer-facing summary, written in the post-job survey's
  // "For the customer — what did you find or do?" step. Null when they left it
  // blank, and the section below hides itself entirely.
  const findings = receiptData?.service_notes?.mechanic_findings?.trim() || null;
  // Photos the mechanic attached while the job was open. Resolved to signed
  // URLs server-side; entries whose file is gone are already filtered out
  // there, so anything that arrives here is renderable.
  const mechanicPhotos = receiptData?.service_notes?.mechanic_photos ?? [];
  // Per-cycle "why I set/changed this price" notes the mechanic entered on each
  // estimate the customer confirmed. Empty array when there were none.
  const adjustments: Adjustment[] = receiptData?.adjustments ?? [];
  const odoIn = receiptData?.vehicle?.odometer_in ?? null;
  const odoOut = receiptData?.vehicle?.odometer_out ?? null;
  const total = receiptData?.totals?.total ?? booking?.totalCost ?? null;

  /** Count-agnostic: the verb never names a service, so this stays correct
   *  whether the order carried one job or six. */
  const headline = useMemo(() => {
    const model = booking?.carModel ? extractModel(booking.carModel).trim() : "";
    return model ? `Your ${model} was serviced.` : "Your vehicle was serviced.";
  }, [booking?.carModel]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings/transactions");
  };

  const handleReviewWithRating = (initialRating: number) => {
    if (!booking || !userId) return;
    reviewSheetRef.current?.open(booking, String(userId), initialRating);
  };

  const handleOpenActions = () => actionsSheetRef.current?.open();
  const handleReportIssue = () => disputeSheetRef.current?.open();

  const handleViewShopInfo = () => {
    if (!booking?.shopId) return;
    router.push({ pathname: "/booking/shop/[id]", params: { id: booking.shopId } });
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
            // TODO(persisted hide): once we land a `dismissed_at_ms` field on
            // bookings, call the mutation here. For now we just back out.
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
        {/* The global bar is style="auto", which resolves from the colour
            scheme rather than the backdrop — pin it dark for this surface. */}
        <StatusBar style="dark" />
        <LinearGradient
          colors={[...OtoGradient.colors]}
          locations={[...OtoGradient.locations]}
          start={OtoGradient.start}
          end={OtoGradient.end}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 4,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* ── nav ────────────────────────────────────────────── */}
          <View style={styles.nav}>
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <ArrowLeft size={24} color={C.ink} strokeWidth={2} />
            </Pressable>
            {booking ? (
              <Pressable
                onPress={handleOpenActions}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Service options"
                style={({ pressed }) => (pressed ? styles.pressed : null)}
              >
                <MoreHorizontal size={22} color={C.ink} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>

          {booking ? (
            <View style={styles.zoomHost}>
              {/* ── headline ──────────────────────────────────── */}
              <View style={styles.head}>
                <RNText style={styles.headline}>{headline}</RNText>
                <RNText style={styles.subhead}>
                  {[booking.date, booking.shopName].filter(Boolean).join("  ·  ")}
                </RNText>
              </View>

              {/* ── work performed ────────────────────────────── */}
              {services.length > 0 ? (
                <>
                  <RNText style={styles.label}>WORK PERFORMED</RNText>
                  {services.map((s, i) => (
                    <View key={`${s.name}-${i}`}>
                      {i > 0 ? <View style={styles.serviceRule} /> : null}
                      <View style={styles.serviceRow}>
                        <Check size={17} color={C.positive} strokeWidth={2.6} />
                        <View style={styles.serviceText}>
                          <RNText numberOfLines={1} style={styles.serviceName}>
                            {s.name}
                          </RNText>
                          {s.hours != null ? (
                            <RNText style={styles.serviceMeta}>
                              {fmtLaborHours(s.hours)}
                            </RNText>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}

              {/* ── the technician ────────────────────────────── */}
              {booking.mechanicName ? (
                <View style={styles.card}>
                  {booking.mechanicImage ? (
                    <Image
                      source={{ uri: booking.mechanicImage }}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.avatar} />
                  )}
                  <View style={styles.cardText}>
                    <RNText numberOfLines={1} style={styles.cardTitle}>
                      {booking.mechanicName}
                    </RNText>
                    <RNText numberOfLines={1} style={styles.cardSub}>
                      {[
                        mechanic?.title,
                        mechanic?.rating != null
                          ? `${fmtRating(mechanic.rating)} ★${
                              mechanic.review_count != null
                                ? `  (${mechanic.review_count})`
                                : ""
                            }`
                          : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ") || "Technician"}
                    </RNText>
                  </View>
                </View>
              ) : null}

              {/* ── findings. Omitted entirely when the shop left the field
                     empty — an empty heading reads as a bug. ─────────── */}
              {findings || mechanicPhotos.length > 0 ? (
                <>
                  <RNText style={styles.label}>
                    {mechanicFirstName
                      ? `WHAT ${mechanicFirstName.toUpperCase()} FOUND`
                      : "WHAT WE FOUND"}
                  </RNText>
                  {findings ? (
                    <RNText style={styles.findings}>{findings}</RNText>
                  ) : null}
                  {mechanicPhotos.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      // flexGrow:0 or the strip claims the leftover column
                      // height and the thumbnails float mid-screen.
                      style={styles.photoStrip}
                      contentContainerStyle={styles.photoStripContent}
                    >
                      {mechanicPhotos.map((photo: any) => (
                        <Pressable
                          key={photo.storageId}
                          onPress={() =>
                            setViewerPhoto({
                              url: photo.url,
                              caption: photo.caption ?? null,
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={
                            photo.caption
                              ? `${photo.caption}. Tap to view full screen.`
                              : "Photo from the mechanic. Tap to view full screen."
                          }
                          style={({ pressed }) => (pressed ? styles.pressed : null)}
                        >
                          <Image
                            source={{ uri: photo.url }}
                            style={styles.photo}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </>
              ) : null}

              {/* ── the mechanic's reasoning on each estimate the customer
                     confirmed (initial quote, mid-job additions, final).
                     Each row is tagged with which moment it belongs to.
                     Hidden when no cycle carried a note. ─────────────── */}
              {adjustments.length > 0 ? (
                <>
                  <RNText style={styles.label}>ALONG THE WAY</RNText>
                  <View style={styles.adjustments}>
                    {adjustments.map((a, i) => (
                      <View
                        key={a.at}
                        style={i > 0 ? styles.adjustmentSpaced : null}
                      >
                        <RNText style={styles.adjustmentCycle}>
                          {a.cycle_label.toUpperCase()}
                        </RNText>
                        <RNText style={styles.adjustmentNote}>{a.note}</RNText>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {/* ── odometer ──────────────────────────────────────
                  Only render readings that exist. A shop often records the
                  out reading and skips the in, and an "ODOMETER IN —" next to
                  a real number reads as broken data rather than absent data.
                  With a single reading the in/out framing is meaningless, so
                  it collapses to one "ODOMETER". */}
              {odoIn != null && odoOut != null ? (
                <View style={styles.readoutRow}>
                  <View style={styles.readout}>
                    <RNText style={styles.readoutLabel}>ODOMETER IN</RNText>
                    <RNText style={styles.readoutValueMuted}>{fmtMiles(odoIn)}</RNText>
                  </View>
                  <View style={styles.readout}>
                    <RNText style={styles.readoutLabel}>ODOMETER OUT</RNText>
                    <RNText style={styles.readoutValue}>{fmtMiles(odoOut)}</RNText>
                  </View>
                </View>
              ) : odoIn != null || odoOut != null ? (
                <View style={styles.readoutRow}>
                  <View style={styles.readout}>
                    <RNText style={styles.readoutLabel}>ODOMETER</RNText>
                    <RNText style={styles.readoutValue}>
                      {fmtMiles(odoOut ?? odoIn)}
                    </RNText>
                  </View>
                </View>
              ) : null}

              {/* ── money → receipt ───────────────────────────── */}
              <Pressable
                onPress={() => setReceiptBookingId(booking.id as Id<"bookings">)}
                accessibilityRole="button"
                accessibilityLabel={`You paid ${fmtUSD(total)}. View receipt.`}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardText}>
                  <RNText style={styles.cardTitle}>You paid {fmtUSD(total)}</RNText>
                  <RNText numberOfLines={1} style={styles.cardSub}>
                    Labor, parts, fee and tax
                  </RNText>
                </View>
                <View style={styles.link}>
                  <RNText style={styles.linkLabel}>Receipt</RNText>
                  <ChevronRight size={16} color={C.accent} strokeWidth={2.4} />
                </View>
              </Pressable>

              {/* ── rate ──────────────────────────────────────── */}
              <RNText style={styles.label}>RATE THIS VISIT</RNText>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => handleReviewWithRating(n)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${n} star${n === 1 ? "" : "s"}`}
                  >
                    <Star size={30} color={C.star} strokeWidth={1.6} />
                  </Pressable>
                ))}
              </View>

              {AppleZoomTarget ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <AppleZoomTarget>
                    <View style={styles.zoomTarget} />
                  </AppleZoomTarget>
                </View>
              ) : null}
            </View>
          ) : isLoading ? (
            <View style={styles.notice}>
              <RNText style={styles.noticeLabel}>READING RECORD…</RNText>
            </View>
          ) : (
            <View style={styles.notice}>
              <RNText style={styles.noticeLabel}>SERVICE NOT FOUND</RNText>
              <RNText style={styles.noticeSub}>
                We couldn&apos;t load this past service.
              </RNText>
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              >
                <RNText style={styles.ctaLabel}>Back to Service Record</RNText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ── full-screen job-photo viewer ──────────────────────────
          Tapping a thumbnail opens the photo edge-to-edge on a near-opaque
          ink backdrop; a tap anywhere (or the system back gesture) closes it. */}
      <Modal
        visible={viewerPhoto != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerPhoto(null)}
      >
        <StatusBar style="light" />
        <Pressable
          style={styles.viewerBackdrop}
          onPress={() => setViewerPhoto(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {viewerPhoto ? (
            <Image
              source={{ uri: viewerPhoto.url }}
              style={styles.viewerImage}
              resizeMode="contain"
              accessibilityLabel={viewerPhoto.caption ?? "Photo from the mechanic"}
            />
          ) : null}
          {viewerPhoto?.caption ? (
            <RNText
              style={[styles.viewerCaption, { bottom: insets.bottom + 28 }]}
            >
              {viewerPhoto.caption}
            </RNText>
          ) : null}
          <View style={[styles.viewerClose, { top: insets.top + 8 }]}>
            <X size={24} color={C.onAccent} strokeWidth={2.2} />
          </View>
        </Pressable>
      </Modal>

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
      <DisputeSheet ref={disputeSheetRef} bookingId={booking?.id ?? null} />
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const G = 22;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Matches the gradient's final stop so overscroll shows white.
    backgroundColor: OtoGradient.colors[2],
  },
  pressed: {
    opacity: 0.6,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: G,
    paddingVertical: 6,
  },
  zoomHost: {
    position: "relative",
  },
  zoomTarget: {
    flex: 1,
    backgroundColor: "transparent",
  },

  // ── headline ──────────────────────────────────────────────
  head: {
    paddingHorizontal: G,
    paddingTop: 8,
    paddingBottom: 22,
    gap: 8,
  },
  headline: {
    fontFamily: F.display,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: C.ink,
  },
  subhead: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.low,
  },

  // ── section labels ────────────────────────────────────────
  label: {
    fontFamily: F.micro,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.low,
    paddingHorizontal: G,
    paddingBottom: 8,
  },

  // ── work performed ────────────────────────────────────────
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: G,
    paddingVertical: 8,
  },
  serviceRule: {
    height: 1,
    marginLeft: G + 27,
    marginRight: G,
    backgroundColor: C.hairline,
  },
  serviceText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  serviceName: {
    fontFamily: F.semi,
    fontSize: 15,
    letterSpacing: -0.1,
    color: C.ink,
  },
  serviceMeta: {
    fontFamily: F.microRegular,
    fontSize: 9,
    letterSpacing: 0.9,
    color: C.low,
  },

  // ── cards ─────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: G,
    marginTop: 20,
    // Cards need space AFTER them too — whatever section follows (odometer,
    // RATE THIS VISIT) has no top spacing of its own and would otherwise sit
    // flush against the card's bottom edge.
    marginBottom: 22,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: C.card,
    shadowColor: C.ink,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.avatar,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    fontFamily: F.semi,
    fontSize: 15,
    color: C.ink,
  },
  cardSub: {
    fontFamily: F.regular,
    fontSize: 12,
    color: C.low,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  linkLabel: {
    fontFamily: F.semi,
    fontSize: 13,
    color: C.accent,
  },

  // ── findings ──────────────────────────────────────────────
  findings: {
    fontFamily: F.regular,
    fontSize: 16,
    lineHeight: 25,
    color: C.ink,
    paddingHorizontal: G,
    paddingBottom: 22,
  },

  // ── mechanic's job photos ─────────────────────────────────
  photoStrip: {
    flexGrow: 0,
    paddingBottom: 22,
  },
  photoStripContent: {
    paddingHorizontal: G,
    gap: 10,
  },
  photo: {
    width: 132,
    height: 99,
    borderRadius: 12,
    backgroundColor: C.hairline,
  },

  // ── full-screen photo viewer ──────────────────────────────
  viewerBackdrop: {
    flex: 1,
    backgroundColor: C.photoVeil,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  viewerImage: {
    width: "100%",
    height: "78%",
  },
  viewerCaption: {
    position: "absolute",
    left: 24,
    right: 24,
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.onAccent,
    textAlign: "center",
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── along the way (per-cycle mechanic notes) ──────────────
  adjustments: {
    paddingHorizontal: G,
    paddingBottom: 22,
  },
  adjustmentSpaced: {
    marginTop: 16,
  },
  adjustmentCycle: {
    fontFamily: F.micro,
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.low,
    marginBottom: 5,
  },
  adjustmentNote: {
    fontFamily: F.regular,
    fontSize: 15,
    lineHeight: 23,
    color: C.ink,
  },

  // ── odometer ──────────────────────────────────────────────
  readoutRow: {
    flexDirection: "row",
    paddingHorizontal: G,
  },
  readout: {
    flex: 1,
    gap: 4,
  },
  readoutLabel: {
    fontFamily: F.micro,
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.low,
  },
  readoutValue: {
    fontFamily: F.semi,
    fontSize: 22,
    letterSpacing: -0.6,
    color: C.ink,
  },
  readoutValueMuted: {
    fontFamily: F.semi,
    fontSize: 22,
    letterSpacing: -0.6,
    color: C.mid,
  },

  // ── rate ──────────────────────────────────────────────────
  stars: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: G,
  },

  // ── cta ───────────────────────────────────────────────────
  cta: {
    marginHorizontal: G,
    marginTop: 26,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: C.accent,
    alignItems: "center",
  },
  ctaLabel: {
    fontFamily: F.semi,
    fontSize: 15,
    color: C.onAccent,
  },

  // ── notices ───────────────────────────────────────────────
  notice: {
    paddingHorizontal: G,
    paddingTop: 60,
  },
  noticeLabel: {
    fontFamily: F.micro,
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.mid,
  },
  noticeSub: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.low,
    marginTop: 8,
  },
});

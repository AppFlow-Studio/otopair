/**
 * Payment History — the ledger
 *
 * A payment-first companion to the Service Record (Past Services). Where that
 * screen is organised around the work performed, this one is organised around
 * the money that moved: one row per completed charge, card-brand mark and
 * tender on the left, amount on the right, grouped by the month it settled.
 *
 * Tapping a row opens the shared ReceiptSheet for that charge's booking (the
 * same on-brand receipt used across the app), which carries a "View job
 * details" link back to the linked past-service. Flow: history → receipt → job.
 *
 * Sits on the shared Oto ambient gradient and uses the ServiceLog type roles so
 * it belongs to the same family as the Service Record and receipt surfaces.
 * Uses RN Text rather than shared-ui <Text> for the weights/tracking those
 * screens need.
 *
 * USED IN: Settings → Payment History (My Garage section).
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight, CreditCard, Wallet } from "lucide-react-native";
import { useQuery } from "convex/react";

import { OtoGradient, ServiceLogColors as C, ServiceLogFonts as F } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { BRAND_SVG } from "@/components/payments/brandSvg";
import { normalizeStripeBrand } from "@/components/payments/BrandedCardVisual";
import { ReceiptSheet } from "@/components/receipts/ReceiptSheet";

type Payment = Doc<"payments">;

const MONTHS_LONG = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Business date for a payment — the recorded `created_at`, falling back to the
 *  row's insertion time for legacy rows that predate the field. */
function paymentMs(p: Payment): number {
  return p.created_at ?? p._creationTime ?? 0;
}

/** What the customer actually paid: the authoritative captured cents when
 *  present, else the dollars stored on `amount` (legacy / pre-capture rows). */
function paidAmount(p: Payment): number {
  if (p.captured_amount_cents != null) return p.captured_amount_cents / 100;
  return p.amount ?? 0;
}

/** "2026-04" — month bucket key. */
function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "APRIL 2026". Built by hand — Hermes' reduced Intl throws on
 *  toLocaleDateString with an options bag. */
function monthLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "30 Apr 2026". */
function longDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function isWallet(p: Payment): boolean {
  return p.payment_origin === "apple_pay" || p.payment_origin === "google_pay";
}

/** Tender line under the date — wallet name, masked card, or a bare label. */
function tenderLabel(p: Payment): string {
  if (p.payment_origin === "apple_pay") return "Apple Pay";
  if (p.payment_origin === "google_pay") return "Google Pay";
  if (p.card_last4) return `···· ${p.card_last4}`;
  if (p.card_brand) return p.card_brand.charAt(0).toUpperCase() + p.card_brand.slice(1);
  return "Card";
}

// ============================================================================
// SCREEN
// ============================================================================

export default function PaymentHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useUserFromConvex();

  const rows = useQuery(
    api.payments.getByUserId,
    userId ? { userId } : "skip",
  );
  const isLoading = userId != null && rows === undefined;

  const [receiptBookingId, setReceiptBookingId] = useState<Id<"bookings"> | null>(null);

  // Only settled charges belong in a payment history — a $20 hold that never
  // captured, or a failed intent, isn't money the customer paid.
  const paid = useMemo(
    () =>
      (rows ?? [])
        .filter((p) => p.status === "completed" && paidAmount(p) > 0)
        .sort((a, b) => paymentMs(b) - paymentMs(a)),
    [rows],
  );

  const monthGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; rows: Payment[] }>();
    for (const p of paid) {
      const ms = paymentMs(p);
      const key = monthKey(ms);
      let g = map.get(key);
      if (!g) {
        g = { key, label: monthLabel(ms), rows: [] };
        map.set(key, g);
      }
      g.rows.push(p);
    }
    return Array.from(map.values());
  }, [paid]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  const handleViewJob = () => {
    const id = receiptBookingId;
    setReceiptBookingId(null);
    if (id) {
      router.push({
        pathname: "/settings/past-service/[bookingId]",
        params: { bookingId: id },
      });
    }
  };

  return (
    <>
      <View style={styles.screen}>
        {/* The global bar is style="auto", which resolves from the colour scheme
            rather than the backdrop — pin it dark for this light gradient. */}
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
          scrollEnabled={paid.length > 0}
          contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 40 }}
        >
          {/* ── masthead ─────────────────────────────────────────── */}
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ArrowLeft size={24} color={C.ink} strokeWidth={2} />
          </Pressable>

          <View style={styles.masthead}>
            <RNText style={styles.title}>Payment History</RNText>
          </View>

          <View style={styles.topRule} />

          {/* isLoading first: the query returns undefined while in flight, so
              without this every user with charges sees the empty state flash
              before their data lands. */}
          {isLoading ? (
            <View style={styles.notice}>
              <RNText style={styles.noticeLabel}>READING LEDGER…</RNText>
            </View>
          ) : paid.length > 0 ? (
            monthGroups.map((g) => (
              <View key={g.key}>
                <View style={styles.readout}>
                  <RNText style={styles.readoutMonth}>{g.label}</RNText>
                </View>
                {g.rows.map((p, i) => (
                  <Row
                    key={p._id}
                    payment={p}
                    isFirst={i === 0}
                    onPress={() => setReceiptBookingId(p.booking_id)}
                  />
                ))}
              </View>
            ))
          ) : (
            <View style={styles.notice}>
              <RNText style={styles.noticeLabel}>NO PAYMENTS</RNText>
              <RNText style={styles.noticeSub}>
                Charges for completed services are listed here.
              </RNText>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Receipt (image #7) — the shared on-brand sheet, keyed by the charge's
          booking. Its "View job details" link routes to the linked job. */}
      <ReceiptSheet
        bookingId={receiptBookingId}
        onClose={() => setReceiptBookingId(null)}
        onViewJob={handleViewJob}
      />
    </>
  );
}

// ============================================================================
// PIECES
// ============================================================================

/** Left-edge tender mark: wallet glyph, brand SVG, or a neutral card glyph. */
function TenderMark({ payment }: { payment: Payment }) {
  if (isWallet(payment)) {
    return <Wallet size={20} color={C.mid} strokeWidth={1.9} />;
  }
  const BrandSvg = BRAND_SVG[normalizeStripeBrand(payment.card_brand)];
  if (BrandSvg) {
    return <BrandSvg width={34} height={22} />;
  }
  return <CreditCard size={20} color={C.mid} strokeWidth={1.9} />;
}

function Row({
  payment,
  isFirst,
  onPress,
}: {
  payment: Payment;
  isFirst: boolean;
  onPress: () => void;
}) {
  const ms = paymentMs(payment);
  const date = longDate(ms);
  const tender = tenderLabel(payment);
  const amount = fmtUSD(paidAmount(payment));

  return (
    <View>
      {!isFirst ? <View style={styles.rowRule} /> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${amount} on ${date}, ${tender}. View receipt.`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.plate}>
          <TenderMark payment={payment} />
        </View>
        <View style={styles.rowText}>
          <RNText numberOfLines={1} style={styles.rowDate}>
            {date}
          </RNText>
          <RNText numberOfLines={1} style={styles.rowMeta}>
            {tender}
          </RNText>
        </View>
        <RNText style={styles.rowAmount}>{amount}</RNText>
        <ChevronRight size={16} color={C.low} strokeWidth={2} style={styles.chevron} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const G = 24;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Matches the gradient's final stop so overscroll shows white.
    backgroundColor: OtoGradient.colors[2],
  },
  pressed: {
    opacity: 0.6,
  },

  // ── masthead ──────────────────────────────────────────────
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: G,
    paddingVertical: 6,
  },
  masthead: {
    paddingHorizontal: G,
    paddingTop: 6,
    paddingBottom: 18,
  },
  title: {
    fontFamily: F.semi,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: C.ink,
    marginTop: 7,
  },
  topRule: {
    height: 1,
    marginHorizontal: G,
    backgroundColor: C.hairline,
  },

  // ── month readout ─────────────────────────────────────────
  readout: {
    paddingHorizontal: G,
    paddingTop: 24,
    paddingBottom: 14,
  },
  readoutMonth: {
    fontFamily: F.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: C.ink,
  },

  // ── rows ──────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: G,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.55,
  },
  rowRule: {
    height: 1,
    marginHorizontal: G,
    backgroundColor: C.hairline,
  },
  plate: {
    width: 40,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowDate: {
    fontFamily: F.semi,
    fontSize: 15,
    letterSpacing: -0.1,
    color: C.ink,
  },
  rowMeta: {
    fontFamily: F.microRegular,
    fontSize: 11,
    letterSpacing: 0.3,
    color: C.low,
  },
  rowAmount: {
    fontFamily: F.semi,
    fontSize: 15,
    letterSpacing: -0.2,
    color: C.ink,
  },
  chevron: {
    marginLeft: 2,
  },

  // ── notices ───────────────────────────────────────────────
  notice: {
    paddingHorizontal: G,
    paddingTop: 40,
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

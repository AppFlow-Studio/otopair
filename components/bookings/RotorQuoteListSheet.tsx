/**
 * RotorQuoteListSheet
 *
 * Parallel of QuoteListSheet for the rotor flow. Full-screen modal listing
 * all live shop responses to a rotor-quote booking. Tapping Book calls
 * `bookings.acceptRotorQuote`, fills the chosen shop into the booking,
 * and flips it to `confirmed` — the card leaves the Quotes tab.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { X } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { RotorQuoteCard } from "@/components/rotor-booking/RotorQuoteCard";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { RotorQuote } from "@/constants/rotorFlow";
import { hhmmToDisplayTime } from "@/utils/timeSlotUtils";

function formatAvailability(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return `${date} · ${time}`;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dt = new Date(y, m - 1, d);
  const dateLabel = `${weekdays[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}`;
  const timeLabel = /^\d{1,2}:\d{2}$/.test(time) ? hhmmToDisplayTime(time) : time;
  return `${dateLabel} · ${timeLabel}`;
}

export interface RotorQuoteListSheetRef {
  open: (bookingId: string) => void;
  close: () => void;
}

interface Props {
  onClose?: () => void;
}

export const RotorQuoteListSheet = forwardRef<RotorQuoteListSheetRef, Props>(
  ({ onClose }, ref) => {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [bookingId, setBookingId] = useState<string | null>(null);

    const responses = useQuery(
      api.rotor_quote_responses.listForBookingWithShops,
      bookingId ? { booking_id: bookingId as Id<"bookings"> } : "skip",
    );
    const acceptQuote = useMutation(api.bookings.acceptRotorQuote);

    useImperativeHandle(ref, () => ({
      open: (id) => {
        setBookingId(id);
        setVisible(true);
      },
      close: () => {
        setVisible(false);
        onClose?.();
      },
    }));

    const handleRequestClose = () => {
      setVisible(false);
      onClose?.();
    };

    const adapted = useMemo<RotorQuote[]>(() => {
      if (!responses || responses.length === 0) return [];
      const list = responses as Array<{
        _id: string;
        shop_id: string;
        rotor_brand: string;
        rotor_model?: string;
        per_rotor_price: number;
        quantity: number;
        labor_cost: number;
        total: number;
        availability: { date: string; time: string };
        shop: {
          _id: string;
          name: string;
          rating: number;
          distance_mi: number | null;
          verified: boolean;
        } | null;
      }>;
      const lowestTotal = list.reduce(
        (min, r) => (r.total < min ? r.total : min),
        list[0].total,
      );
      let bestAssigned = false;
      return list.map((r) => {
        const rotorBrand = r.rotor_model ? `${r.rotor_brand} ${r.rotor_model}` : r.rotor_brand;
        const isBestMatch = !bestAssigned && r.total === lowestTotal;
        if (isBestMatch) bestAssigned = true;
        return {
          id: r._id,
          shopId: r.shop?._id ?? r.shop_id,
          shopName: r.shop?.name ?? "Unknown shop",
          shopRating: r.shop?.rating ?? 0,
          shopDistanceMi: r.shop?.distance_mi ?? 0,
          verifiedPartner: r.shop?.verified ?? false,
          rotorBrand,
          perRotorPrice: r.per_rotor_price,
          quantity: r.quantity,
          laborCost: r.labor_cost,
          total: r.total,
          availability: formatAvailability(r.availability.date, r.availability.time),
          isBestMatch,
        };
      });
    }, [responses]);

    const { best, others } = useMemo(() => {
      if (adapted.length === 0) return { best: null, others: [] as RotorQuote[] };
      const b = adapted.find((q) => q.isBestMatch) ?? adapted[0];
      const rest = adapted.filter((q) => q !== b);
      return { best: b, others: rest };
    }, [adapted]);

    const handleAccept = async (responseId: string) => {
      if (!bookingId) return;
      try {
        await acceptQuote({
          booking_id: bookingId as Id<"bookings">,
          response_id: responseId as Id<"rotor_quote_responses">,
        });
        setVisible(false);
        onClose?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[RotorQuoteListSheet] acceptRotorQuote failed", err);
      }
    };

    const isLoading = bookingId != null && responses === undefined;

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={handleRequestClose}
      >
        <View style={styles.fullScreen}>
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Text size="lg" weight="bold" color="#1A1A1A">
              Your rotor quotes
            </Text>
            <Pressable onPress={handleRequestClose} hitSlop={10} style={styles.closeButton}>
              <X size={22} color="#1A1A1A" strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#5299FE" />
                <Text size="sm" weight="regular" color="#6B7280" center style={styles.loadingText}>
                  Loading quotes…
                </Text>
              </View>
            ) : adapted.length === 0 ? (
              <Text size="md" weight="regular" color="#6B7280" center style={styles.empty}>
                No quotes yet — shops will be responding any moment.
              </Text>
            ) : (
              <>
                <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
                  BEST MATCH FOR YOU
                </Text>
                {best ? (
                  <RotorQuoteCard
                    quote={best}
                    variant="primary"
                    onBook={() => handleAccept(best.id)}
                  />
                ) : null}

                {others.length > 0 ? (
                  <>
                    <Text
                      size="xs"
                      weight="semiBold"
                      color="#8E8E93"
                      style={[styles.sectionLabel, styles.sectionLabelTop]}
                    >
                      OTHER OPTIONS
                    </Text>
                    {others.map((q) => (
                      <RotorQuoteCard
                        key={q.id}
                        quote={q}
                        variant="secondary"
                        onBook={() => handleAccept(q.id)}
                      />
                    ))}
                  </>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  },
);

RotorQuoteListSheet.displayName = "RotorQuoteListSheet";

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionLabelTop: {
    marginTop: 20,
  },
  loadingWrap: {
    marginTop: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    marginTop: 4,
  },
  empty: {
    marginTop: 40,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
});

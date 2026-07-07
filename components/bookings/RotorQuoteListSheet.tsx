/**
 * RotorQuoteListSheet
 *
 * Parallel of QuoteListSheet for the rotor flow. Full-screen modal listing
 * all live shop responses to a rotor-quote booking. "Choose time" stashes a
 * `QuoteAcceptContext` on `useBookingStore` and routes into
 * `(booking-flow)/pick-datetime` so the customer picks their own slot (no
 * earlier than the shop's quoted `availability`) — `bookings.acceptRotorQuote`
 * only fires once they confirm on Review & Pay.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { X } from "lucide-react-native";
import { useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { RotorQuoteCard } from "@/components/rotor-booking/RotorQuoteCard";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { RotorQuote } from "@/constants/rotorFlow";
import { hhmmToDisplayTime } from "@/utils/timeSlotUtils";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useBookingStore } from "@/stores/useBookingStore";

/** Raw shape of a `rotor_quote_responses.listForBookingWithShops` row —
 *  carries the fields the adapted `RotorQuote` display shape drops (raw
 *  `availability`, `mechanic_id`, `estimated_duration_minutes`). */
interface RawRotorQuoteResponse {
  _id: string;
  shop_id: string;
  mechanic_id?: string;
  rotor_brand: string;
  rotor_model?: string;
  per_rotor_price: number;
  quantity: number;
  labor_cost: number;
  total: number;
  pad_brand?: string;
  pad_price?: number;
  pad_quantity?: number;
  availability: { date: string; time: string };
  estimated_duration_minutes?: number;
  shop: {
    _id: string;
    name: string;
    rating: number;
    distance_mi: number | null;
    verified: boolean;
  } | null;
}

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

    const router = useRouter();
    const setQuoteAcceptContext = useBookingStore((s) => s.setQuoteAcceptContext);

    const responses = useQuery(
      api.rotor_quote_responses.listForBookingWithShops,
      bookingId ? { booking_id: bookingId as Id<"bookings"> } : "skip",
    );

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
      const list = responses as RawRotorQuoteResponse[];
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

    const handleChooseTime = (responseId: string) => {
      if (!bookingId || !responses) return;
      const response = (responses as RawRotorQuoteResponse[]).find((r) => r._id === responseId);
      if (!response) return;

      const rotorsSubtotal = response.per_rotor_price * response.quantity;
      const padQuantity = response.pad_quantity ?? response.quantity;
      const padSubtotal = response.pad_price != null ? response.pad_price * padQuantity : null;
      const rotorLabel = response.rotor_model
        ? `${response.rotor_brand} ${response.rotor_model}`
        : response.rotor_brand;
      const lineItems = [
        { label: `Rotors (${rotorLabel}, $${response.per_rotor_price} × ${response.quantity})`, amount: rotorsSubtotal },
        ...(response.pad_brand && padSubtotal != null
          ? [{ label: `Pads (${response.pad_brand})`, amount: padSubtotal }]
          : []),
        { label: "Installation & labor", amount: response.labor_cost },
      ];

      setQuoteAcceptContext({
        bookingId: bookingId as Id<"bookings">,
        quoteType: "rotor",
        responseId: response._id,
        shopId: response.shop?._id ?? response.shop_id,
        shopName: response.shop?.name ?? "Unknown shop",
        mechanicId: response.mechanic_id ?? null,
        minDate: response.availability.date,
        minTime: response.availability.time,
        estimatedDurationMinutes: response.estimated_duration_minutes,
        laborCost: response.labor_cost,
        partsCost: rotorsSubtotal + (padSubtotal ?? 0),
        lineItems,
        quoteTotal: response.total,
      });

      // Booking stays in its current status until the customer confirms a
      // slot + pays on Review & Pay — see (booking-flow)/pick-datetime.
      setVisible(false);
      onClose?.();
      router.push("/(booking-flow)/pick-datetime");
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
                    onBook={() => handleChooseTime(best.id)}
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
                        onBook={() => handleChooseTime(q.id)}
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

/**
 * ReceiptSheet — shared floating sheet around `ReceiptContent`.
 *
 * Uses the project's `FloatingSheet` (Flighty-style: drag-handle
 * grabber, custom snap physics, drag-down to dismiss) instead of
 * `@gorhom/bottom-sheet`. A single snap height means the sheet
 * opens at full height and cannot be dragged upward; the
 * gesture-based dismiss is still available by pulling down past the
 * threshold.
 *
 * Wired into two surfaces today:
 *   1. Cars tab → `VehicleServiceHistory` row tap.
 *   2. Settings → Booking History → "View Details" on a Completed row.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { ReceiptContent, type ReceiptPayload } from "./ReceiptContent";
import { ReceiptSkeleton } from "./ReceiptSkeleton";

export interface ReceiptSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  bookingId: Id<"bookings"> | null;
  onClose?: () => void;
  /** When set, surfaces a filled "Leave a review" CTA inside the
   *  receipt body. Used by the home auto-prompt; manual entry
   *  surfaces leave it undefined. */
  onLeaveReview?: () => void;
}

export const ReceiptSheet = forwardRef<ReceiptSheetRef, Props>(({ bookingId, onClose, onLeaveReview }, ref) => {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  // Two snap heights: resting ~70% (hero card visible behind,
  // bottom inset shows the floating bottom corners), expanded to
  // full height (top safe area minus 12pt breathing room).
  // Drag the grabber up to expand; drag down to collapse / dismiss.
  const restingHeight = Math.max(0, screenHeight * 0.73);
  const expandedHeight = Math.max(restingHeight, screenHeight - insets.top - 4);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.open(),
    dismiss: () => sheetRef.current?.close(),
  }));

  // Open automatically when a bookingId arrives. Caller controls the
  // close lifecycle (sets bookingId to null) via the onClose callback.
  useEffect(() => {
    if (bookingId) sheetRef.current?.open();
  }, [bookingId]);

  const data = useQuery(
    api.bookings.getReceipt,
    bookingId ? { bookingId } : "skip",
  );

  let body: React.ReactNode;
  if (!bookingId) {
    body = null;
  } else if (data === undefined) {
    body = <ReceiptSkeleton />;
  } else if (data === null) {
    body = <ReceiptError />;
  } else {
    body = <ReceiptContent payload={data as ReceiptPayload} onLeaveReview={onLeaveReview} />;
  }

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[restingHeight, expandedHeight]}
      initialSnapIndex={0}
      cornerRadius={20}
      bottomCornerRadius={0}
      sideInset={0}
      floatBottomInset={0}
      showBackdrop
      backdropMode="dim"
      onClose={onClose}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        bounces
      >
        {body}
      </ScrollView>
    </FloatingSheet>
  );
});

ReceiptSheet.displayName = "ReceiptSheet";

function ReceiptError() {
  return (
    <View style={styles.errorWrap}>
      <Text weight="bold" size="md" color="#0F172A" center>
        We couldn&apos;t load your receipt
      </Text>
      <Text size="sm" color="#9CA3AF" center style={{ marginTop: 6 }}>
        Pull down to dismiss or try again.
      </Text>
      <Pressable style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}>
        <Text weight="semiBold" size="sm" color="#FFFFFF">
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#5299FE",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
});

export default ReceiptSheet;

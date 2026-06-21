/**
 * Bookings → Pending reviews.
 *
 * One row per completed booking the user hasn't reviewed yet. Tapping a
 * row opens the existing LeaveReviewSheet. Consolidates what used to be
 * a stack of review-prompt cards on the Bookings tab into a single
 * dedicated screen reached from the circular star button.
 */

import React, { useCallback, useLayoutEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import { ChevronLeft } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CompletedBookingReviewCard } from "@/components/bookings/CompletedBookingReviewCard";
import {
  LeaveReviewSheet,
  type LeaveReviewSheetRef,
} from "@/components/bookings/LeaveReviewSheet";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { scale, moderateScale } from "@/utils/responsive";

export default function PendingReviewsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) parent.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      if (parent) parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const { pendingReviewBookings, isLoading } = useMyBookingsWithDetails();
  const { userId } = useUserFromConvex();
  const reviewSheetRef = useRef<LeaveReviewSheetRef>(null);

  const handleLeaveReview = useCallback(
    (bookingId: string) => {
      const target = pendingReviewBookings.find((b) => b.id === bookingId);
      if (!target || !userId) return;
      reviewSheetRef.current?.open(target, String(userId));
    },
    [pendingReviewBookings, userId],
  );

  return (
    <>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backChip}
            hitSlop={12}
          >
            <ChevronLeft size={moderateScale(22)} color="#141C24" />
          </Pressable>
          <Text weight="bold" style={styles.headerTitle}>
            Pending reviews
          </Text>
          <View style={styles.backChipSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color="#5299FE" />
          </View>
        ) : pendingReviewBookings.length === 0 ? (
          <View style={styles.centerFill}>
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptyBody}>
              Completed bookings waiting for a review will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: scale(20),
              paddingTop: scale(16),
              paddingBottom: insets.bottom + scale(32),
            }}
            showsVerticalScrollIndicator={false}
          >
            {pendingReviewBookings.map((booking) => (
              <CompletedBookingReviewCard
                key={`pending-${booking.id}`}
                booking={booking}
                onLeaveReview={handleLeaveReview}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <LeaveReviewSheet ref={reviewSheetRef} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingTop: scale(8),
    paddingBottom: scale(8),
  },
  backChip: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  backChipSpacer: {
    width: scale(40),
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: moderateScale(16),
    color: "#141C24",
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(40),
    gap: scale(8),
  },
  emptyTitle: {
    fontSize: moderateScale(15),
    color: "#141C24",
    fontWeight: "600" as any,
  },
  emptyBody: {
    fontSize: moderateScale(13),
    color: "#757c7d",
    textAlign: "center",
    lineHeight: moderateScale(18),
  },
});

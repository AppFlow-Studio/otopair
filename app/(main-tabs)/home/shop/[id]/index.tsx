/**
 * Shop Detail Screen
 *
 * PURPOSE: Full-screen detail page for a selected shop.
 *          Wraps the ShopDetails component which handles everything.
 *
 * FLOW: search/carousel → shop detail → booking-details → payment → confirmation
 *
 * USED IN: Navigation from HomeSearchOverlay or MechanicCarouselSheet
 *
 * ROUTE: /home/shop/[id]
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { FullScreenContainer } from "@/components/shared-ui/Container";

// 4. Flow-specific components
import { ShopDetails } from "@/components/booking/ShopDetails";
import { AddMoreServicesSheet, type AddMoreServicesSheetRef } from "@/components/booking/sheets/AddMoreServicesSheet";
import { AllAvailabilitySheet, type AllAvailabilitySheetRef } from "@/components/booking/sheets/AllAvailabilitySheet";

// 5. Constants, hooks, types, stores
import type { ScheduledAppointment } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useSearchStore } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// COMPONENT
// ============================================================================

export default function ShopDetailScreen() {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ═══════════════ REFS ═══════════════
  const addMoreServicesRef = useRef<AddMoreServicesSheetRef>(null);
  const allAvailabilityRef = useRef<AllAvailabilitySheetRef>(null);

  // ═══════════════ STORES ═══════════════
  const getShopById = useShopStore((state) => state.getShopById);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const addRecentShop = useSearchStore((state) => state.addRecentShop);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const shopId = useMemo(() => {
    const parsed = id ? parseInt(id, 10) : null;
    return isNaN(parsed ?? 0) ? null : parsed;
  }, [id]);

  const shop = useMemo(() => {
    if (!shopId) return null;
    return getShopById(shopId);
  }, [shopId, getShopById]);

  // ═══════════════ HANDLERS ═══════════════
  const handleAddMoreServices = useCallback(() => {
    addMoreServicesRef.current?.open();
  }, []);

  const handleViewAllAvailability = useCallback((mechanicId: number) => {
    allAvailabilityRef.current?.open(mechanicId);
  }, []);

  const handleAvailabilityConfirm = useCallback(
    (date: Date, time: string) => {
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      const displayDate = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
      const isoDate = date.toISOString().split("T")[0];

      const appointment: ScheduledAppointment = {
        date: isoDate,
        time,
        displayDate,
      };

      setScheduledAppointment(appointment);
    },
    [setScheduledAppointment]
  );

  const handleBookNow = useCallback(
    (mechanicId: number) => {
      // Add shop to recent history
      if (shopId) {
        addRecentShop(shopId);
      }

      // Set booking type and proceed
      setBookingTypeAndProceed("schedule_later", mechanicId);

      // Navigate to booking details
      router.push(`/home/mechanic/${mechanicId}/booking-details`);
    },
    [shopId, addRecentShop, setBookingTypeAndProceed, router]
  );

  // ═══════════════ RENDER ═══════════════
  if (!shop) {
    return (
      <FullScreenContainer style={styles.container}>
        <View style={styles.errorContainer}>
          <Text size="lg" weight="medium" color={BrandColors.primary}>
            Shop not found
          </Text>
        </View>
      </FullScreenContainer>
    );
  }

  return (
    <FullScreenContainer style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ShopDetails
          shopId={shop.id}
          onBookNow={handleBookNow}
          onAddMoreServices={handleAddMoreServices}
          onViewAllAvailability={handleViewAllAvailability}
        />
      </ScrollView>

      {/* Modals */}
      <AddMoreServicesSheet ref={addMoreServicesRef} />
      <AllAvailabilitySheet ref={allAvailabilityRef} onConfirm={handleAvailabilityConfirm} />
    </FullScreenContainer>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

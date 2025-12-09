/**
 * BookingsScreen
 *
 * PURPOSE: Main screen for discovering and booking auto repair shops
 *
 * USED IN: app/(main-tabs)/bookings/_layout.tsx
 *
 * FEATURES:
 *   - Location-based shop discovery with top bar navigation
 *   - Dual filtering: Service categories + availability/rating filters
 *   - Map view with nearby shops (to be implemented)
 *   - State managed via useBookingStore
 *
 * OWNER: Waleed Mansour
 */

import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  BookingMap,
  FilterOption,
  LocationTopBar,
  ServiceBottomSheet,
  ServiceCategory,
  Shop,
  ShopCarousel,
} from "@/components/booking";
import { ScreenContainer } from "@/components/shared-ui";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Vertical offset for bottom sheet and carousel (adjust this value as needed) */
const VERTICAL_OFFSET = 35; // pixels to shift down

/** Maximum number of shops to show in carousel */
const MAX_CAROUSEL_SHOPS = 5;

// ============================================================================
// HELPERS
// ============================================================================

/** Calculate distance between two coordinates using Haversine formula (returns miles) */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const router = useRouter();

  // ═══════════════ BOOKING STORE (location, map, service selection) ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const selectedServiceCategory = useBookingStore((state) => state.selectedServiceCategory);
  const setSelectedServiceCategory = useBookingStore((state) => state.setSelectedServiceCategory);

  // ═══════════════ MECHANIC STORE (shops, filters, selection) ═══════════════
  // Select raw state values - don't call getter methods inside selectors (causes infinite loop)
  const shops = useMechanicStore((state) => state.shops);
  const shopIds = useMechanicStore((state) => state.shopIds);
  const selectedShopId = useMechanicStore((state) => state.selectedShopId);
  const selectedFilter = useMechanicStore((state) => state.selectedFilter);
  const setSelectedShopId = useMechanicStore((state) => state.setSelectedShopId);
  const setSelectedFilter = useMechanicStore((state) => state.setSelectedFilter);
  const setSelectedServiceCategoryFilter = useMechanicStore((state) => state.setSelectedServiceCategory);

  // Compute derived values using useMemo instead of store getters
  const selectedShop = useMemo(() => {
    return selectedShopId ? shops[selectedShopId] || null : null;
  }, [selectedShopId, shops]);

  const filteredShops = useMemo(() => {
    let filtered = shopIds.map((id) => shops[id]).filter(Boolean);

    // Apply filters first
    if (selectedFilter === "available_now") {
      filtered = filtered.filter((shop) => shop.isOpen);
    } else if (selectedFilter === "top_rated") {
      filtered = [...filtered].sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return a.isVerified === b.isVerified ? 0 : a.isVerified ? -1 : 1;
      });
    } else if (selectedFilter === "specialists") {
      filtered = filtered.filter((shop) => shop.isVerified);
    }

    // Sort by distance from user location (closest first) if we have user location
    if (userLocation?.latitude && userLocation?.longitude) {
      filtered = [...filtered].sort((a, b) => {
        const distA = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          a.coordinate.latitude,
          a.coordinate.longitude
        );
        const distB = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          b.coordinate.latitude,
          b.coordinate.longitude
        );
        return distA - distB;
      });
    }

    // Limit to closest shops for carousel
    return filtered.slice(0, MAX_CAROUSEL_SHOPS);
  }, [shops, shopIds, selectedFilter, userLocation]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleFilterSelect = (filter: FilterOption) => {
    setSelectedFilter(filter);
    console.log("Shop filter selected:", filter);
  };

  const handleServiceSelect = (service: ServiceCategory) => {
    // Update both stores: service category for service list AND shop filtering
    setSelectedServiceCategory(service); // For service list display
    setSelectedServiceCategoryFilter(service); // For shop filtering
    console.log("Service category selected:", service);
  };

  const handleSelectServices = () => {
    // Handle service selection confirmation - navigate to next step in booking flow
    console.log("Services confirmed");
  };

  const handleShopSelect = (shop: Shop) => {
    setSelectedShopId(shop.id);
    console.log("Shop selected:", shop.name);
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <ScreenContainer style={styles.container}>
      {/* Main Content - Map with shop markers (full screen) */}
      <BookingMap onShopSelect={handleShopSelect} selectedShopId={selectedShopId} />

      {/* Location Top Bar - Positioned over map with blur */}
      <View style={styles.topBarContainer}>
        <LocationTopBar
          label="Your Location"
          location={userLocation?.label ?? "Set Location"}
          onBackPress={handleBackPress}
          onFilterSelect={handleFilterSelect}
          onServiceSelect={handleServiceSelect}
          selectedService={selectedServiceCategory}
        />
      </View>

      {/* Shop Carousel - shows filtered shops */}
      <ShopCarousel
        shops={filteredShops}
        selectedShopId={selectedShopId}
        onShopSelect={handleShopSelect}
        offsetY={VERTICAL_OFFSET}
      />

      {/* Service Bottom Sheet */}
      <ServiceBottomSheet onSelectServices={handleSelectServices} offsetY={VERTICAL_OFFSET} />
    </ScreenContainer>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#E8ECF0",
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

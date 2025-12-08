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
 */

import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { FilterOption, LocationTopBar, ServiceBottomSheet, ServiceCategory } from "@/components/booking";
import { ScreenContainer } from "@/components/shared-ui";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const router = useRouter();

  // Get state and actions from booking store
  const userLocation = useBookingStore((state) => state.userLocation);
  const selectedService = useBookingStore((state) => state.selectedService);
  const setSelectedFilter = useBookingStore((state) => state.setSelectedFilter);
  const setSelectedService = useBookingStore((state) => state.setSelectedService);

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
    console.log("Filter selected:", filter);
  };

  const handleServiceSelect = (service: ServiceCategory) => {
    setSelectedService(service);
    console.log("Service selected:", service);
  };

  const handleSelectServices = () => {
    // Handle service selection confirmation - navigate to next step in booking flow
    console.log("Services confirmed");
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <ScreenContainer style={styles.container}>
      {/* Location Top Bar */}
      <LocationTopBar
        label="Your Location"
        location={userLocation?.label ?? "Set Location"}
        onBackPress={handleBackPress}
        onFilterSelect={handleFilterSelect}
        onServiceSelect={handleServiceSelect}
        selectedService={selectedService}
      />

      {/* Main Content - Map placeholder */}
      <View style={styles.mapPlaceholder}>{/* Map view will be added here */}</View>

      {/* Service Bottom Sheet */}
      <ServiceBottomSheet onSelectServices={handleSelectServices} />
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
  mapPlaceholder: {
    flex: 1,
  },
});

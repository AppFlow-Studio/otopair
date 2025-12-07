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

import { FilterOption, LocationTopBar, ServiceCategory } from "@/components/booking";
import { Container, ScreenContainer } from "@/components/shared-ui";
import { useBookingStore } from "@/stores/useBookingStore";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

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

      {/* Main Content */}
      <Container flex={1} paddingHorizontal="lg" backgroundColor="transparent">
        {/* Map and shop list content will be added here */}
      </Container>
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
});

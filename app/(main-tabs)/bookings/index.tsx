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
 */

import { FilterOption, LocationTopBar, ServiceCategory } from "@/components/booking";
import { Container, ScreenContainer } from "@/components/shared-ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceCategory>("basic_maintenance");

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleFilterSelect = (filter: FilterOption) => {
    // TODO: Update booking store with selected filter
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
        location="San Francisco, CA"
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

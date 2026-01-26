// 1. React & React Native
import React, { useEffect, useState, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Bell, MapPinned, MoveRight, Star } from 'lucide-react-native';
import Animated from 'react-native-reanimated';

// 3. Shared UI
import { Button, ScrollDrivenGradientBackground, Spacing, Text } from '@/components/shared-ui';

// 4. Flow-specific components
import { ActionCardsCarousel } from '@/components/home/ActionCardsCarousel';
import { AIAssistantButton } from '@/components/home/AIAssistantButton';
import { LoyaltyCard } from '@/components/home/LoyaltyCard';
import { MechanicSearchBar } from '@/components/home/MechanicSearchBar';
import { NavigationETABar } from '@/components/home/NavigationETABar';
import { ServiceBundlesSection } from '@/components/home/ServiceBundlesSection';
import { SuggestionsSection } from '@/components/home/SuggestionsSection';
import { VehicleMaintenanceCard } from '@/components/home/VehicleMaintenanceCard';
import { OtoPairIcon } from '@/components/icons/oto-pair';

// 5. Stores (unused imports removed)

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationName, setLocationName] = useState('Loading...');
  const [showLoyaltyCard, setShowLoyaltyCard] = useState(false);
  const [isCardSwiping, setIsCardSwiping] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showAccountSetup, setShowAccountSetup] = useState(true);
  const [showCarSetup, setShowCarSetup] = useState(true);

  useEffect(() => {
    (async () => {
      // Check existing location permission (without requesting)
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('Location unavailable');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});

      // Get location name (reverse geocoding)
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address) {
          setLocationName(
            `${address.city || address.subregion || 'Unknown'}, ${address.region || ''}`,
          );
        }
      } catch (error) {
        setLocationName('Unknown location');
      }
    })();
  }, []);

  const handleSearch = (query: string) => {
    console.log('Search submitted:', query);
    // TODO: Implement search functionality
  };

  const handleMapPress = () => {
    router.push('/home/map');
  };

  const handleAppointmentPress = () => {
    console.log('Appointment pressed');
    // TODO: Navigate to appointment details
  };

  // Search bar focus - navigate directly to map with search active
  const handleSearchFocus = useCallback(() => {
    router.push('/home/map?search=true');
  }, [router]);

  // Custom margins for content below carousel based on active card
  const getCardMargin = (cardIndex: number): number => {
    switch (cardIndex) {
      case 0: // Finish Account Setup
        return -70;
      case 1: // Upcoming Appointment - NavigationETABar shows, so no extra margin needed
        return 10;
      case 2: // Resume Booking
        return -100;
      case 3: // Finish Car Setup
        return -10;
      default:
        return 0;
    }
  };

  // Welcome screen - shows on app open
  // if (showWelcome) {
  //   return (
  //     <View style={styles.welcomeContainer}>
  //       <View style={styles.welcomeContent}>
  //         <OtoPairIcon />
  //         <Text weight="semiBold" size="2xl" style={styles.welcomeTitle}>
  //           OtoPair
  //         </Text>
  //         <Button variant="secondary" onPress={() => setShowWelcome(false)}>
  //           Let's Check Your Car Now <MoveRight size={16} color="#fff" />
  //         </Button>
  //       </View>
  //     </View>
  //   );
  // }

  return (
    <View style={styles.container}>
      <ScrollDrivenGradientBackground>
        {(scrollHandler) => (
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isCardSwiping}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* Header */}
            <View style={styles.header}>
              {/* Location */}
              <View style={styles.locationSection}>
                <MapPinned size={20} color="#5299FE" />
                <View style={styles.locationText}>
                  <Text size="xs" color="#6B7280">
                    Your Location
                  </Text>
                  <Text weight="semiBold" size="sm" color="#141C24">
                    {locationName}
                  </Text>
                </View>
              </View>

                {/* Notification Bell */}
                <Pressable
                  style={({ pressed }) => [styles.bellButton, pressed && styles.bellButtonPressed]}
                >
                  <View style={styles.bellIconContainer}>
                    <Bell size={22} color="#141C24" />
                    <View style={styles.bellDot} />
                  </View>
                </Pressable>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MechanicSearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmit={handleSearch}
                onMapPress={handleMapPress}
              />
            </View>

            {/* Content Area */}
            <View style={styles.content}>
              {/* Action Cards Carousel */}
              <ActionCardsCarousel
                // Upcoming Appointment
                appointmentBusinessName={'Premium\nAuto Care'}
                appointmentMechanicName="John Rodriguez"
                appointmentRating={4.8}
                appointmentIsVerified={true}
                appointmentDate="August 12, 2025"
                appointmentTimeSlot="12:30 PM - 1:00 PM"
                appointmentLateMinutes={30}
                onAppointmentPress={handleAppointmentPress}
                // Resume Booking
                showResumeBooking={true}
                resumeMechanicsAvailable={3}
                resumeServicesPreview="Oil Change, Fluid Ch..."
                // Account Setup
                showAccountSetup={showAccountSetup}
                onAccountSetupDismiss={() => setShowAccountSetup(false)}
                // Car Setup
                showCarSetup={showCarSetup}
                onCarSetupDismiss={() => setShowCarSetup(false)}
                // Carousel callback
                onCardChange={(index) => setActiveCardIndex(index)}
              />

              {/* Navigation ETA Bar - Only show when on Upcoming Appointment card */}
              {activeCardIndex === 1 && (
                <View style={styles.etaBarContainer}>
                  <NavigationETABar
                    etaMinutes={20}
                    destinationLatitude={37.7749}
                    destinationLongitude={-122.4194}
                    destinationName="Premium Auto Care"
                  />
                </View>
              )}

              {/* Vehicle Maintenance - with dynamic margin based on active card */}
              <View style={{ marginTop: getCardMargin(activeCardIndex) }}>
                <VehicleMaintenanceCard
                  onBookNow={(vehicleId, serviceId) => {
                    console.log(`Booking service ${serviceId} for vehicle ${vehicleId}`);
                    // TODO: Navigate to booking flow
                  }}
                  onSwipeStart={() => setIsCardSwiping(true)}
                  onSwipeEnd={() => setIsCardSwiping(false)}
                />
              </View>

              {/* Suggestions Section */}
              <SuggestionsSection />

              {/* Service Bundles Section */}
              <ServiceBundlesSection />

              {/* AI Assistant Button */}
              {/* <AIAssistantButton /> */}
            </View>
          </Animated.ScrollView>
        )}
      </ScrollDrivenGradientBackground>

      {/* Loyalty Card Overlay */}
      {showLoyaltyCard && (
        <LoyaltyCard
          totalPoints={1240}
          currentTier="Gold Member"
          currentPoints={240}
          pointsToNextTier={260}
          nextTier="Platinum"
          maxPoints={500}
          onClose={() => setShowLoyaltyCard(false)}
          onViewFullPage={() => {
            setShowLoyaltyCard(false);
            // TODO: Navigate to full loyalty page
            console.log('View full loyalty page');
          }}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  // Welcome screen styles
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeContent: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  welcomeTitle: {
    color: '#141C24',
    letterSpacing: 0.5,
  },
  // Main home screen styles
  container: {
    flex: 1,
    backgroundColor: '#dde2ee',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    gap: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goldTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldTierBadgePressed: {
    opacity: 0.7,
  },
  starCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellButton: {
    padding: 4,
  },
  bellButtonPressed: {
    opacity: 0.7,
  },
  bellIconContainer: {
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5299FE',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: 16,
  },
  etaBarContainer: {
    marginTop: -72,
  },
});

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Bell, MoveRight, Star, Trophy } from 'lucide-react-native';

// 3. Shared UI
import { Button, ScrollDrivenGradientBackground, Text } from '@/components/shared-ui';

// 4. Stores
import { useAuthStore } from '@/stores/useAuthStore';

// 5. Flow-specific components
import { ActionCardsCarousel } from '@/components/home/ActionCardsCarousel';
import { AddFirstVehicleCard } from '@/components/home/AddFirstVehicleCard';
import { LoyaltyCard } from '@/components/home/LoyaltyCard';
import { MechanicSearchBar } from '@/components/home/MechanicSearchBar';
import { NavigationETABar } from '@/components/home/NavigationETABar';
import { ServiceBundlesSection } from '@/components/home/ServiceBundlesSection';
import { MoreServicesSection } from '@/components/home/MoreServicesSection';
import { SuggestionsSection } from '@/components/home/SuggestionsSection';
import { VehicleMaintenanceCard } from '@/components/home/VehicleMaintenanceCard';
import { HomeLogo } from '@/components/icons/home-logo';
import { OtoPairIcon } from '@/components/icons/oto-pair';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isNewUser } = useAuthStore();
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
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
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

  // Helper function to get the card type at a given index based on user status
  const getCardTypeAtIndex = (index: number): 'appointment' | 'resume' | 'account' | 'car' | null => {
    if (isNewUser && showAccountSetup) {
      // New user order: account, appointment, resume, car
      switch (index) {
        case 0: return 'account';
        case 1: return 'appointment';
        case 2: return 'resume';
        case 3: return 'car';
        default: return null;
      }
    } else {
      // Existing user order: appointment, resume, account, car
      switch (index) {
        case 0: return 'appointment';
        case 1: return 'resume';
        case 2: return 'account';
        case 3: return 'car';
        default: return null;
      }
    }
  };

  // Custom margins for content below carousel based on active card
  const getCardMargin = (cardIndex: number): number => {
    const cardType = getCardTypeAtIndex(cardIndex);
    
    switch (cardType) {
      case 'appointment': // Upcoming Appointment - NavigationETABar shows, so no extra margin needed
        return 10;
      case 'resume': // Resume Booking
        return -100;
      case 'account': // Finish Account Setup
        return -70;
      case 'car': // Finish Car Setup
        return -10;
      default:
        return 0;
    }
  };

  // Welcome screen - shows on app open
  if (showWelcome) {
    return (
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContent}>
          <OtoPairIcon />
          <Text weight="semiBold" size="2xl" style={styles.welcomeTitle}>
            Otopair
          </Text>
          <Button variant="secondary" onPress={() => setShowWelcome(false)}>
            Let's Check Your Car Now <MoveRight size={16} color="#fff" />
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollDrivenGradientBackground colors={['#5BA3D9', '#8FC4E8', '#d9e8f5']}>
      {(scrollHandler) => (
    <View style={styles.container}>
      {/* Full Page Scroll */}
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
            <View style={{ marginTop: -8, marginLeft: 8 }}>
              <HomeLogo size={68} />
            </View>
            <View style={styles.locationText}>
              <Text size="xl" color="#FFFFFF" weight="bold">
                Otopair
              </Text>
              <Text weight="semiBold" size="sm" color="#FFFFFF">
                {locationName}
              </Text>
            </View>
          </View>

          {/* Right Side - Gold Tier & Bell */}
          <View style={styles.headerRight}>
            {/* Gold Tier Badge - Clickable */}
            <Pressable
              onPress={() => setShowLoyaltyCard(true)}
              style={({ pressed }) => [styles.goldTierBadge, pressed && styles.goldTierBadgePressed]}
            >
              <View style={styles.glassContainer}>
                <BlurView intensity={10} tint="dark" style={styles.glassBlur}>
                  <View style={styles.glassOverlay} />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.5 }}
                    style={styles.glassGloss}
                  />
                  <Trophy size={22} color="#FFFFFF" fill="none" strokeWidth={2} />
                </BlurView>
              </View>
            </Pressable>

            {/* Notification Bell */}
            <Pressable
              style={({ pressed }) => [styles.bellButton, pressed && styles.bellButtonPressed]}
            >
              <View style={styles.glassContainer}>
                <BlurView intensity={10} tint="dark" style={styles.glassBlur}>
                  <View style={styles.glassOverlay} />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.5 }}
                    style={styles.glassGloss}
                  />
                  <View style={styles.bellIconContainer}>
                    <Bell size={22} color="#FFFFFF" fill="none" strokeWidth={2} />
                    <View style={styles.bellDot} />
                  </View>
                </BlurView>
              </View>
            </Pressable>
          </View>
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
          <View style={styles.carouselContainer}>
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
              // User status - determines card order
              isNewUser={isNewUser}
            />
          </View>

          {/* Navigation ETA Bar - Only show when on Upcoming Appointment card */}
          {getCardTypeAtIndex(activeCardIndex) === 'appointment' && (
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
            {isNewUser ? (
              <AddFirstVehicleCard showAccountSetup={showAccountSetup} />
            ) : (
            <VehicleMaintenanceCard
              onBookNow={(vehicleId, serviceId) => {
                console.log(`Booking service ${serviceId} for vehicle ${vehicleId}`);
                // TODO: Navigate to booking flow
              }}
              onSwipeStart={() => setIsCardSwiping(true)}
              onSwipeEnd={() => setIsCardSwiping(false)}
            />
            )}
          </View>

          {/* More Services Section */}
          <MoreServicesSection />

          {/* Service Bundles Section */}
          <ServiceBundlesSection />

          {/* Suggestions Section */}
          <SuggestionsSection />

        </View>
          </Animated.ScrollView>

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
            router.push('/membership');
          }}
        />
      )}
    </View>
      )}
    </ScrollDrivenGradientBackground>
  );
}

const styles = StyleSheet.create({
  // Welcome screen styles
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContent: {
    alignItems: 'center',
    gap: 16,
  },
  welcomeTitle: {
    color: '#141C24',
    letterSpacing: 0.5,
  },
  // Main home screen styles
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 150,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingLeft: 0,
    marginBottom: 16,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    paddingLeft: 0,
  },
  locationText: {
    gap: 0,
    marginTop: -7,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goldTierBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldTierBadgePressed: {
    opacity: 0.7,
  },
  bellButton: {
    padding: 4,
  },
  bellButtonPressed: {
    opacity: 0.7,
  },
  glassContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  glassBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glassGloss: {
    ...StyleSheet.absoluteFillObject,
  },
  bellIconContainer: {
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 34,
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: 16,
  },
  carouselContainer: {
    marginBottom: 16,
  },
  etaBarContainer: {
    marginTop: -72,
  },
});

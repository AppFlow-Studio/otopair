/**
 * ActionCardsCarousel
 *
 * PURPOSE: Displays a horizontal scrollable carousel of action cards including upcoming appointments, resume booking, and setup prompts
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - upcomingAppointment (object): Upcoming appointment data to display [optional]
 *   - resumeBooking (object): Resume booking data to display [optional]
 *   - showAccountSetup (boolean): Whether to show account setup card [optional]
 *   - showCarSetup (boolean): Whether to show car setup card [optional]
 *   - onUpcomingAppointmentPress (() => void): Called when upcoming appointment card is pressed [optional]
 *   - onResumeBookingPress (() => void): Called when resume booking card is pressed [optional]
 *
 * EXAMPLE:
 *   <ActionCardsCarousel
 *     upcomingAppointment={appointmentData}
 *     showAccountSetup={!isAccountComplete}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useRef, useState } from 'react';
import {
  type ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

// 2. Expo & Third-party
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// 3. Shared UI
// (none)

// 4. Flow-specific components
import { FinishAccountSetupCard } from './FinishAccountSetupCard';
import { FinishCarSetupCard } from './FinishCarSetupCard';
import { NavigationETABar } from './NavigationETABar';
import { ResumeBookingCard } from './ResumeBookingCard';
import { BookingCard, type Booking as BookingCardBooking } from '@/components/bookings/BookingCard';

// ============================================================================
// TYPES
// ============================================================================

interface ActionCardsCarouselProps {
  // Upcoming Appointment — now uses the shared BookingCard from the
  // bookings tab for consistency. Pass the adapted booking object plus
  // the same handlers the bookings tab wires (view-details, cancel).
  showAppointment?: boolean;
  appointmentBooking?: BookingCardBooking | null;
  appointmentEtaMinutes?: number;
  appointmentDestinationLatitude?: number;
  appointmentDestinationLongitude?: number;
  appointmentDestinationName?: string;
  appointmentDestinationAddress?: string;
  onAppointmentViewDetails?: (bookingId: string) => void;
  onAppointmentCancel?: (bookingId: string) => void;
  onAppointmentReschedule?: (bookingId: string) => void;

  // Resume Booking
  showResumeBooking?: boolean;
  resumeMechanicsAvailable?: number;
  resumeServicesPreview?: string;
  resumeVehicleName?: string;
  resumeVehicleImage?: ImageSourcePropType;
  onResumePress?: () => void;

  // Finish Account Setup
  showAccountSetup?: boolean;
  onAccountSetupPress?: () => void;
  onAccountSetupDismiss?: () => void;

  // Finish Car Setup
  showCarSetup?: boolean;
  isCarSetupDone?: boolean;
  carSetupChecklist?: { id: string; label: string; completed: boolean }[];
  /** Name of the car the Finish Setup card is referring to. */
  carSetupVehicleLabel?: string;
  /** Number of cars still pending setup — when >1 the CTA opens a
   *  picker so the user can choose which one to resume. */
  carSetupVehicleCount?: number;
  onCarSetupPress?: () => void;
  onCarSetupDismiss?: () => void;

  // Carousel callbacks
  onCardChange?: (index: number) => void;

  // User status
  isNewUser?: boolean; // If true, show Finish Setup card first; if false, show Appointment first
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ActionCardsCarousel({
  // Upcoming Appointment
  showAppointment = false,
  appointmentBooking,
  appointmentEtaMinutes,
  appointmentDestinationLatitude,
  appointmentDestinationLongitude,
  appointmentDestinationName,
  appointmentDestinationAddress,
  onAppointmentViewDetails,
  onAppointmentCancel,
  onAppointmentReschedule,

  // Resume Booking
  showResumeBooking = false,
  resumeMechanicsAvailable,
  resumeServicesPreview = '',
  resumeVehicleName,
  resumeVehicleImage,
  onResumePress,

  // Finish Account Setup
  showAccountSetup = true,
  onAccountSetupPress,
  onAccountSetupDismiss,

  // Finish Car Setup
  showCarSetup = true,
  isCarSetupDone = false,
  carSetupChecklist,
  carSetupVehicleLabel,
  carSetupVehicleCount,
  onCarSetupPress,
  onCarSetupDismiss,

  // Carousel callbacks
  onCardChange,

  // User status
  isNewUser = false,
}: ActionCardsCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  // Build array of visible cards - account setup first when visible, then appointment, resume, car
  const cards = [
    { id: 'account', visible: showAccountSetup },
    { id: 'appointment', visible: showAppointment },
    { id: 'resume', visible: showResumeBooking },
    { id: 'car', visible: showCarSetup },
  ].filter((card) => card.visible);

  // Clamp + re-snap whenever the cards array changes. When a booking
  // is made, showAppointment flips and the cards array grows — the
  // ScrollView's stale contentOffset would otherwise land on a
  // half-page boundary, which is the bug Ahmad caught where the
  // appointment card (red SUV + small navigation map) and the
  // NowTierCallout Oil Change content visually collide mid-scroll.
  // Clamp activeIndex to the new valid range and imperatively re-snap
  // to that clamped page, without animation so the realignment is
  // invisible.
  useEffect(() => {
    if (!scrollViewRef.current || cards.length === 0) return;
    const clamped = Math.min(activeIndex, cards.length - 1);
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      onCardChange?.(clamped);
    }
    scrollViewRef.current.scrollTo({
      x: clamped * screenWidth,
      animated: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAccountSetup, showAppointment, showResumeBooking, showCarSetup, cards.length, screenWidth]);

  if (cards.length === 0) return null;

  const activeCard = cards[activeIndex] ?? cards[0];
  const containerHeight = activeCard ? cardHeights[activeCard.id] : undefined;

  // Smooth post-swipe reflow: instead of snapping the container to the new
  // active card's height, drive the height through a Reanimated shared value
  // with a 280 ms `withTiming` so the sections below (Vehicle Maintenance,
  // etc.) glide in lockstep. Mirrors VehicleMaintenanceCard.tsx:375-414.
  const animatedCardHeight = useSharedValue<number>(containerHeight ?? 0);
  useEffect(() => {
    if (containerHeight == null) return;
    animatedCardHeight.value = withTiming(containerHeight, { duration: 280 });
  }, [containerHeight, animatedCardHeight]);
  const containerHeightStyle = useAnimatedStyle(() => ({
    height: animatedCardHeight.value,
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / screenWidth);
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < cards.length) {
      setActiveIndex(newIndex);
      onCardChange?.(newIndex);
    }
  };

  const handleCardLayout = (cardId: string, height: number) => {
    setCardHeights((prev) => {
      if (prev[cardId] === height) return prev;
      return { ...prev, [cardId]: height };
    });
  };

  const getCardContainerStyle = (cardId: string, index: number) => [
    styles.cardContainer,
    { width: screenWidth },
    index === 0 && styles.firstCard,
    cardId === 'car' && styles.lastCard,
  ];

  const renderCard = (cardId: string, index: number) => {
    switch (cardId) {
      case 'appointment':
        return (
          <View
            key={cardId}
            style={getCardContainerStyle(cardId, index)}
            onLayout={(event) => handleCardLayout(cardId, event.nativeEvent.layout.height)}
          >
            {appointmentBooking ? (
              <View style={styles.appointmentStack}>
                <BookingCard
                  booking={appointmentBooking}
                  variant="upcoming"
                  onViewDetails={onAppointmentViewDetails}
                  onCancelBooking={onAppointmentCancel}
                  onReschedule={onAppointmentReschedule}
                />
                <NavigationETABar
                  etaMinutes={appointmentEtaMinutes}
                  destinationLatitude={appointmentDestinationLatitude}
                  destinationLongitude={appointmentDestinationLongitude}
                  destinationName={appointmentDestinationName}
                  destinationAddress={appointmentDestinationAddress}
                />
              </View>
            ) : null}
          </View>
        );
      case 'resume':
        return (
          <View
            key={cardId}
            style={getCardContainerStyle(cardId, index)}
            onLayout={(event) => handleCardLayout(cardId, event.nativeEvent.layout.height)}
          >
            <ResumeBookingCard
              mechanicsAvailable={resumeMechanicsAvailable}
              servicesPreview={resumeServicesPreview}
              vehicleName={resumeVehicleName}
              vehicleImage={resumeVehicleImage}
              onPress={onResumePress}
            />
          </View>
        );
      case 'account':
        return (
          <View
            key={cardId}
            style={getCardContainerStyle(cardId, index)}
            onLayout={(event) => handleCardLayout(cardId, event.nativeEvent.layout.height)}
          >
            <FinishAccountSetupCard
              onPress={onAccountSetupPress}
              onDismiss={onAccountSetupDismiss}
            />
          </View>
        );
      case 'car':
        return (
          <View
            key={cardId}
            style={getCardContainerStyle(cardId, index)}
            onLayout={(event) => handleCardLayout(cardId, event.nativeEvent.layout.height)}
          >
            <FinishCarSetupCard
              checklist={carSetupChecklist}
              isComplete={isCarSetupDone}
              onPress={onCarSetupPress}
              onDismiss={onCarSetupDismiss}
              vehicleLabel={carSetupVehicleLabel}
              vehicleCount={carSetupVehicleCount}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        containerHeight != null && containerHeightStyle,
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        // Explicit snap + disable multi-page momentum so a swipe always
        // lands on a single page boundary, even when the parent layout
        // re-renders mid-scroll (e.g. when a booking mutation flips
        // showAppointment). Without these, the carousel could settle
        // on a half-page with the appointment card's navigation map
        // bleeding into a sibling card.
        snapToInterval={screenWidth}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {cards.map((card, index) => renderCard(card.id, index))}
      </ScrollView>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  scrollView: {
    marginHorizontal: -16, // Extend scroll view to edges
    overflow: 'visible',
  },
  scrollContent: {
    alignItems: 'flex-start',
  },
  cardContainer: {
    paddingHorizontal: 16,
  },
  appointmentStack: {
    gap: 12,
  },
  firstCard: {
    // First card styling if needed
  },
  lastCard: {
    // Last card styling if needed
  },
});

export default ActionCardsCarousel;


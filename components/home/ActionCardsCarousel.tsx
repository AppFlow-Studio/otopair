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
  Dimensions,
  type ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
// (none)

// 3. Shared UI
// (none)

// 4. Flow-specific components
import { FinishAccountSetupCard } from './FinishAccountSetupCard';
import { FinishCarSetupCard } from './FinishCarSetupCard';
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
  onAppointmentViewDetails?: (bookingId: string) => void;
  onAppointmentCancel?: (bookingId: string) => void;

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

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 32; // Visual card width
const CARD_GAP = 0; // No gap to prevent peeking

// ============================================================================
// COMPONENT
// ============================================================================

export function ActionCardsCarousel({
  // Upcoming Appointment
  showAppointment = false,
  appointmentBooking,
  onAppointmentViewDetails,
  onAppointmentCancel,

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
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Build array of visible cards - account setup first when visible, then appointment, resume, car
  const cards = [
    { id: 'account', visible: showAccountSetup },
    { id: 'appointment', visible: showAppointment },
    { id: 'resume', visible: showResumeBooking },
    { id: 'car', visible: showCarSetup },
  ].filter((card) => card.visible);

  // Scroll to first card on mount or when card list changes
  useEffect(() => {
    if (scrollViewRef.current && cards.length > 0) {
      scrollViewRef.current.scrollTo({
        x: 0,
        animated: false,
      });
      setActiveIndex(0);
      onCardChange?.(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAccountSetup, showAppointment, showResumeBooking, showCarSetup]);

  if (cards.length === 0) return null;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < cards.length) {
      setActiveIndex(newIndex);
      onCardChange?.(newIndex);
    }
  };

  const renderCard = (cardId: string, index: number) => {
    switch (cardId) {
      case 'appointment':
        return (
          <View key={cardId} style={styles.cardContainer}>
            {appointmentBooking ? (
              <BookingCard
                booking={appointmentBooking}
                variant="upcoming"
                onViewDetails={onAppointmentViewDetails}
                onCancelBooking={onAppointmentCancel}
              />
            ) : null}
          </View>
        );
      case 'resume':
        return (
          <View key={cardId} style={styles.cardContainer}>
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
          <View key={cardId} style={[styles.cardContainer, index === 0 && styles.firstCard]}>
            <FinishAccountSetupCard
              onPress={onAccountSetupPress}
              onDismiss={onAccountSetupDismiss}
            />
          </View>
        );
      case 'car':
        return (
          <View key={cardId} style={[styles.cardContainer, styles.lastCard]}>
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
    <View style={styles.container}>
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
      >
        {cards.map((card, index) => renderCard(card.id, index))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    // BookingCard (used for the appointment slot) is the tallest card —
    // keep a uniform height so swiping between cards doesn't shift the
    // layout below.
    height: 380,
  },
  scrollView: {
    marginHorizontal: -16, // Extend scroll view to edges
  },
  scrollContent: {
    alignItems: 'flex-start',
  },
  cardContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
  },
  firstCard: {
    // First card styling if needed
  },
  lastCard: {
    // Last card styling if needed
  },
});

export default ActionCardsCarousel;


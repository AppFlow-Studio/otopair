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
import { UpcomingAppointmentCard } from './UpcomingAppointmentCard';

// ============================================================================
// TYPES
// ============================================================================

interface ActionCardsCarouselProps {
  // Upcoming Appointment
  appointmentBusinessName: string;
  appointmentMechanicName: string;
  appointmentRating: number;
  appointmentIsVerified?: boolean;
  appointmentDate: string;
  appointmentTimeSlot: string;
  appointmentLateMinutes?: number;
  onAppointmentPress?: () => void;

  // Resume Booking
  showResumeBooking?: boolean;
  resumeMechanicsAvailable?: number;
  resumeServicesPreview?: string;
  onResumePress?: () => void;

  // Finish Account Setup
  showAccountSetup?: boolean;
  onAccountSetupPress?: () => void;
  onAccountSetupDismiss?: () => void;

  // Finish Car Setup
  showCarSetup?: boolean;
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
  appointmentBusinessName,
  appointmentMechanicName,
  appointmentRating,
  appointmentIsVerified = true,
  appointmentDate,
  appointmentTimeSlot,
  appointmentLateMinutes,
  onAppointmentPress,

  // Resume Booking
  showResumeBooking = true,
  resumeMechanicsAvailable = 3,
  resumeServicesPreview = 'Oil Change, Fluid Ch...',
  onResumePress,

  // Finish Account Setup
  showAccountSetup = true,
  onAccountSetupPress,
  onAccountSetupDismiss,

  // Finish Car Setup
  showCarSetup = true,
  onCarSetupPress,
  onCarSetupDismiss,

  // Carousel callbacks
  onCardChange,

  // User status
  isNewUser = false,
}: ActionCardsCarouselProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Build array of visible cards - reorder based on isNewUser
  const allCards = [
  { id: 'appointment', visible: true },
  { id: 'resume', visible: showResumeBooking },
  { id: 'account', visible: showAccountSetup },  // add this
  { id: 'car', visible: showCarSetup },
].filter((card) => card.visible);

  // Reorder cards: if new user, put account setup first; otherwise keep appointment first
  const cards = isNewUser && showAccountSetup
    ? [
        allCards.find((c) => c.id === 'account'),
        ...allCards.filter((c) => c.id !== 'account'),
      ].filter((c): c is typeof allCards[0] => c !== undefined)
    : allCards;

  // Debug: Log card order
  if (__DEV__) {
    console.log('ActionCardsCarousel - isNewUser:', isNewUser, 'showAccountSetup:', showAccountSetup, 'cards:', cards.map(c => c.id));
  }

  // Scroll to correct initial card on mount or when isNewUser changes
  useEffect(() => {
    if (scrollViewRef.current && cards.length > 0) {
      // If new user, scroll to account setup card (index 0)
      // If existing user, scroll to appointment card (index 0 by default)
      const initialIndex = 0;
      scrollViewRef.current.scrollTo({
        x: initialIndex * SCREEN_WIDTH,
        animated: false,
      });
      setActiveIndex(initialIndex);
      onCardChange?.(initialIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewUser, showAccountSetup]);

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
            <UpcomingAppointmentCard
              businessName={appointmentBusinessName}
              mechanicName={appointmentMechanicName}
              rating={appointmentRating}
              isVerified={appointmentIsVerified}
              date={appointmentDate}
              timeSlot={appointmentTimeSlot}
              lateMinutes={appointmentLateMinutes}
              onPress={onAppointmentPress}
            />
          </View>
        );
      case 'resume':
        return (
          <View key={cardId} style={styles.cardContainer}>
            <ResumeBookingCard
              mechanicsAvailable={resumeMechanicsAvailable}
              servicesPreview={resumeServicesPreview}
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
              onPress={onCarSetupPress}
              onDismiss={onCarSetupDismiss}
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
    height: 310, // Fixed height to prevent content shifting when scrolling between cards
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


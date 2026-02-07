import { BookingCard, type Booking } from '@/components/bookings/BookingCard';
import { LiveTrackerCard, type LiveTracking } from '@/components/bookings/LiveTrackerCard';
import { ScrollDrivenGradientBackground, Text } from '@/components/shared-ui';
import { useRouter } from 'expo-router';
import { Calendar, Search, SlidersHorizontal } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import Animated, { 
    FadeInDown,
    FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================================
// ANIMATION CONFIG
// ============================================================================

const STAGGER_DELAY = 80;      // ms between each card fade-in
const FADE_DURATION = 350;     // ms for each card's fade animation

// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_LIVE_TRACKING: LiveTracking = {
  id: 'live-1',
  carModel: 'BMW M5',
  carYear: '2019',
  licensePlate: 'RPH 468',
  mechanicName: 'John Rodriguez',
  shopName: 'Premium auto care',
  mechanicImage: 'https://randomuser.me/api/portraits/men/32.jpg',
  shopPhone: '+1 234 567 8900',
  currentStage: 'Car checked in',
  progressPercent: 25,
  delayMinutes: 45,
  stages: [
    {
      id: '1',
      title: 'Booking Confirmed',
      description: 'Your appointment is set.',
      status: 'completed',
    },
    {
      id: '2',
      title: 'Service in Progress',
      description: 'Currently working on your vehicle.',
      status: 'current',
    },
    {
      id: '3',
      title: 'Your vehicle is ready',
      description: 'You will be notified when ready.',
      status: 'pending',
    },
    {
      id: '4',
      title: 'Service Completed',
      description: 'Your service is completed',
      status: 'pending',
    },
  ],
};

const SAMPLE_UPCOMING_BOOKINGS: Booking[] = [
  {
    id: '1',
    services: ['Oil Change', 'Tire Rotation', 'Brake Check'],
    carModel: 'BMW M5',
    carYear: '2019',
    licensePlate: 'RPH 468',
    mechanicName: 'John Rodriguez',
    shopName: 'Premium auto care',
    mechanicImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: 'Tuesday, Sep 10',
    time: '2:30 PM',
    status: 'confirmed',
  },
  {
    id: '2',
    services: ['Brake Pads', 'Fluid Check'],
    carModel: 'BMW M5',
    carYear: '2019',
    licensePlate: 'RPH 468',
    mechanicName: 'John Rodriguez',
    shopName: 'Premium auto care',
    mechanicImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: 'Tuesday, Sep 10',
    time: '2:30 PM',
    status: 'pending',
  },
  {
    id: '3',
    services: ['Oil Change', 'Filter Replacement', 'Diagnostics'],
    carModel: 'BMW M5',
    carYear: '2019',
    licensePlate: 'RPH 468',
    mechanicName: 'John Rodriguez',
    shopName: 'Premium auto care',
    mechanicImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: 'Tuesday, Sep 10',
    time: '2:30 PM',
    status: 'delayed',
  },
];

const SAMPLE_HISTORY_BOOKINGS: Booking[] = [
  {
    id: '4',
    services: ['Oil Change', 'Tire Rotation', 'Brake Check'],
    carModel: 'BMW M5',
    carYear: '2019',
    licensePlate: 'RPH 468',
    mechanicName: 'John Rodriguez',
    shopName: 'Premium auto care',
    mechanicImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: 'Tuesday, Sep 10',
    time: '2:30 PM',
    status: 'completed',
    totalCost: 240.00,
  },
  {
    id: '5',
    services: ['Oil Change', 'Filter Replacement', 'Diagnostics'],
    carModel: 'BMW M5',
    carYear: '2019',
    licensePlate: 'RPH 468',
    mechanicName: 'John Rodriguez',
    shopName: 'Premium auto care',
    mechanicImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: 'Tuesday, Sep 10',
    time: '2:30 PM',
    status: 'completed',
    totalCost: 240.00,
  },
];

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'liveTracker' | 'upcoming' | 'history';

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Default to liveTracker when there's an active service
  const hasActiveService = true; // This would come from your state/API
  const [activeTab, setActiveTab] = useState<TabType>(hasActiveService ? 'liveTracker' : 'upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Key to trigger re-animation when tab changes
  const [animationKey, setAnimationKey] = useState(0);

  // Handle tab change with animation reset
  const handleTabChange = useCallback((newTab: TabType) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setAnimationKey(prev => prev + 1); // Trigger re-animation
  }, [activeTab]);

  const bookings = activeTab === 'upcoming' ? SAMPLE_UPCOMING_BOOKINGS : SAMPLE_HISTORY_BOOKINGS;

  // Filter bookings based on search query
  const filteredBookings = bookings.filter(
    (booking) =>
      booking.services.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      booking.mechanicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.shopName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleViewDetails = (bookingId: string) => {
    // Navigate to coming soon - booking details page not yet implemented
    router.push({ pathname: '/coming-soon', params: { serviceName: 'Booking Details' } });
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => {
          // TODO: Implement actual cancellation API call
          Alert.alert('Booking Cancelled', 'Your booking has been cancelled.');
        }},
      ]
    );
  };

  const handleReschedule = (bookingId?: string) => {
    // Navigate to map to reschedule
    router.push('/home/map?openServices=true');
  };

  const handleDownloadPdf = (bookingId: string) => {
    // Show alert for PDF download - feature not yet implemented
    Alert.alert('Download Receipt', 'Receipt download will be available soon.');
  };

  const handleToggleFavorite = (bookingId: string) => {
    // Show feedback for favorite toggle
    Alert.alert('Saved', 'This booking has been saved to your favorites.');
  };

  const handleContactShop = () => {
    // Navigate to coming soon for contact feature
    router.push({ pathname: '/coming-soon', params: { serviceName: 'Contact Shop' } });
  };

  return (
    <ScrollDrivenGradientBackground colors={['#5BA3D9', '#8FC4E8', '#d9e8f5']}>
      {(scrollHandler) => (
    <View style={styles.container}>
      {/* Full Page Scroll - same as home page */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text weight="bold" size="xl" color="#FFFFFF">
            My Bookings
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => handleTabChange('liveTracker')}
            style={[
              styles.tab,
              activeTab === 'liveTracker' && styles.activeTab,
            ]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={activeTab === 'liveTracker' ? '#1F2937' : '#FFFFFF'}
            >
              Live Tracker
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTabChange('upcoming')}
            style={[
              styles.tab,
              activeTab === 'upcoming' && styles.activeTab,
            ]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={activeTab === 'upcoming' ? '#1F2937' : '#FFFFFF'}
            >
              Upcoming
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTabChange('history')}
            style={[
              styles.tab,
              activeTab === 'history' && styles.activeTab,
            ]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={activeTab === 'history' ? '#1F2937' : '#FFFFFF'}
            >
              History
            </Text>
          </Pressable>
        </View>

        {/* Search Bar - Only for History */}
        {activeTab === 'history' && (
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Search size={18} color="#9CA3AF" strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for past bookings..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <Pressable style={styles.filterButton}>
                <SlidersHorizontal size={18} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>
            <Pressable style={styles.calendarButton}>
              <Calendar size={20} color="#6B7280" strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {/* Booking Content */}
        <View style={styles.content} key={animationKey}>
          {activeTab === 'liveTracker' ? (
            // Live Tracker Content - single card with fade in
            hasActiveService ? (
              <Animated.View entering={FadeInDown.duration(FADE_DURATION)}>
                <LiveTrackerCard
                  tracking={SAMPLE_LIVE_TRACKING}
                  onReschedule={() => handleReschedule()}
                  onContactShop={handleContactShop}
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(FADE_DURATION)}>
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
                  </View>
                  <Text weight="semiBold" size="lg" color="#374151" center>
                    No Active Service
                  </Text>
                  <Text weight="regular" size="sm" color="#6B7280" center style={styles.emptyText}>
                    You don't have any service in progress. Book a service to get started!
                  </Text>
                </View>
              </Animated.View>
            )
          ) : filteredBookings.length > 0 ? (
            // Upcoming or History Content - staggered fade in for each card
            filteredBookings.map((booking, index) => (
              <Animated.View 
                key={booking.id}
                entering={FadeInDown.duration(FADE_DURATION).delay(index * STAGGER_DELAY)}
              >
                <BookingCard
                  booking={booking}
                  variant={activeTab}
                  onViewDetails={handleViewDetails}
                  onCancelBooking={handleCancelBooking}
                  onReschedule={handleReschedule}
                  onDownloadPdf={handleDownloadPdf}
                  onToggleFavorite={handleToggleFavorite}
                />
              </Animated.View>
            ))
          ) : (
            <Animated.View entering={FadeIn.duration(FADE_DURATION)}>
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
                </View>
                <Text weight="semiBold" size="lg" color="#374151" center>
                  No {activeTab === 'upcoming' ? 'Upcoming' : 'Past'} Bookings
                </Text>
                <Text weight="regular" size="sm" color="#6B7280" center style={styles.emptyText}>
                  {activeTab === 'upcoming'
                    ? "You don't have any upcoming appointments. Book a service to get started!"
                    : "You haven't completed any bookings yet."}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
      )}
    </ScrollDrivenGradientBackground>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingBottom: 20,
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 22,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'Urbanist-Regular',
  },
  filterButton: {
    padding: 4,
  },
  calendarButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 75,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    lineHeight: 22,
  },
});

import { BookingCard, type Booking } from '@/components/bookings/BookingCard';
import { LiveTrackerCard, type LiveTracking } from '@/components/bookings/LiveTrackerCard';
import { Text } from '@/components/shared-ui';
import { Calendar, Search, SlidersHorizontal } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // Default to liveTracker when there's an active service
  const hasActiveService = true; // This would come from your state/API
  const [activeTab, setActiveTab] = useState<TabType>(hasActiveService ? 'liveTracker' : 'upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    console.log('View details for booking:', bookingId);
  };

  const handleCancelBooking = (bookingId: string) => {
    console.log('Cancel booking:', bookingId);
  };

  const handleReschedule = (bookingId?: string) => {
    console.log('Reschedule booking:', bookingId || 'live');
  };

  const handleDownloadPdf = (bookingId: string) => {
    console.log('Download PDF for booking:', bookingId);
  };

  const handleToggleFavorite = (bookingId: string) => {
    console.log('Toggle favorite for booking:', bookingId);
  };

  const handleContactShop = () => {
    console.log('Contact shop');
  };

  return (
    <View style={styles.container}>
      {/* Full Page Scroll - same as home page */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
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
          <Text weight="bold" size="xl" color="#1F2937">
            My Bookings
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab('liveTracker')}
            style={[
              styles.tab,
              activeTab === 'liveTracker' && styles.activeTab,
            ]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={activeTab === 'liveTracker' ? '#1F2937' : '#6B7280'}
            >
              Live Tracker
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('upcoming')}
            style={[
              styles.tab,
              activeTab === 'upcoming' && styles.activeTab,
            ]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={activeTab === 'upcoming' ? '#1F2937' : '#6B7280'}
            >
              Upcoming
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('history')}
            style={[
              styles.tab,
              activeTab === 'history' && styles.activeTab,
            ]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={activeTab === 'history' ? '#1F2937' : '#6B7280'}
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
        <View style={styles.content}>
          {activeTab === 'liveTracker' ? (
            // Live Tracker Content
            hasActiveService ? (
              <LiveTrackerCard
                tracking={SAMPLE_LIVE_TRACKING}
                onReschedule={() => handleReschedule()}
                onContactShop={handleContactShop}
              />
            ) : (
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
            )
          ) : filteredBookings.length > 0 ? (
            // Upcoming or History Content
            filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                variant={activeTab}
                onViewDetails={handleViewDetails}
                onCancelBooking={handleCancelBooking}
                onReschedule={handleReschedule}
                onDownloadPdf={handleDownloadPdf}
                onToggleFavorite={handleToggleFavorite}
              />
            ))
          ) : (
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
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dde2ee',
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
    backgroundColor: '#dde2ee',
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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

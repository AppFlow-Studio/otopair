/**
 * BookingCard
 *
 * PURPOSE: Displays a booking card with vehicle info, mechanic details, service information, and action buttons for both upcoming and history bookings
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - booking (Booking): The booking object containing all booking details
 *   - variant ('upcoming' | 'history'): Determines the card layout and displayed information
 *   - onViewDetails ((bookingId: string) => void): Called when "View Details" is pressed [optional]
 *   - onCancelBooking ((bookingId: string) => void): Called when "Cancel Booking" is pressed [optional]
 *   - onReschedule ((bookingId: string) => void): Called when "Reschedule" is pressed [optional]
 *   - onDownloadPdf ((bookingId: string) => void): Called when PDF download icon is pressed [optional]
 *   - onToggleFavorite ((bookingId: string) => void): Called when favorite star icon is pressed [optional]
 *
 * EXAMPLE:
 *   <BookingCard
 *     booking={bookingData}
 *     variant="upcoming"
 *     onViewDetails={(id) => router.push(`/booking/${id}`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, View } from 'react-native';

// 2. Expo & Third-party
import { useRouter } from 'expo-router';
import { Car, FileText, Star, User } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

export type BookingStatus = 'pending' | 'pending_quote' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'delayed';

export interface Booking {
  id: string;
  // Services
  services: string[];
  // Car info
  carModel: string;
  carYear: string;
  licensePlate: string;
  /** Make logo URL from cdn_assets (content); used as car thumbnail when no vehicle image */
  makeLogoUrl?: string;
  // Mechanic info
  mechanicName: string;
  shopName: string;
  mechanicImage?: string;
  // Scheduling
  date: string;
  time: string;
  status: BookingStatus;
  // History-specific
  totalCost?: number;
}

interface BookingCardProps {
  booking: Booking;
  variant: 'upcoming' | 'history';
  onViewDetails?: (bookingId: string) => void;
  onCancelBooking?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onDownloadPdf?: (bookingId: string) => void;
  onToggleFavorite?: (bookingId: string) => void;
  /** Called when the Live Tracker toggle is flipped. Implementer flips the status. */
  onToggleLiveTracker?: (bookingId: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<BookingStatus, { label: string; bgColor: string; textColor: string }> = {
  pending: {
    label: 'Pending',
    bgColor: '#fff6ee',
    textColor: '#f89829',
  },
  pending_quote: {
    label: 'Pending Quote',
    bgColor: '#FFF8ED',
    textColor: '#C8972E',
  },
  confirmed: {
    label: 'Confirmed',
    bgColor: '#e8f5e9',
    textColor: '#4CAF50',
  },
  in_progress: {
    label: 'In Progress',
    bgColor: '#E0E7FF',
    textColor: '#4F46E5',
  },
  completed: {
    label: 'Completed',
    bgColor: '#f0fcf5',
    textColor: '#60d17e',
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: '#FEE2E2',
    textColor: '#DC2626',
  },
  delayed: {
    label: 'Delayed',
    bgColor: '#E5E7EB',
    textColor: '#6B7280',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingCard({
  booking,
  variant,
  onViewDetails,
  onCancelBooking,
  onReschedule,
  onDownloadPdf,
  onToggleFavorite,
  onToggleLiveTracker,
}: BookingCardProps) {
  const isLive = booking.status === 'in_progress';
  // Show the Live Tracker toggle on any non-final upcoming-like status.
  const canToggleLive =
    variant === 'upcoming' &&
    booking.status !== 'completed' &&
    booking.status !== 'cancelled';
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[booking.status];
  const [carImageError, setCarImageError] = useState(false);
  const showCarPlaceholder = !booking.makeLogoUrl?.trim() || carImageError;
  
  // Format services display
  const mainService = booking.services[0] || 'Service';
  const additionalCount = booking.services.length - 1;
  const additionalText = variant === 'history' 
    ? `+${additionalCount} Services` 
    : `+${additionalCount} More`;

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(booking.id);
    } else {
      // Default fallback - booking details page not yet implemented
      router.push({ pathname: '/coming-soon', params: { serviceName: 'Booking Details' } });
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => onCancelBooking?.(booking.id) },
      ]
    );
  };

  const handleReschedule = () => {
    onReschedule?.(booking.id);
  };

  const handleDownloadPdf = () => {
    onDownloadPdf?.(booking.id);
  };

  const handleToggleFavorite = () => {
    onToggleFavorite?.(booking.id);
  };

  return (
    <View style={styles.card}>
      {/* Title Row */}
      <View style={styles.titleRow}>
        <View style={styles.servicesContainer}>
          <Text weight="bold" size="xl" color="#1F2937">
            {mainService}
          </Text>
          {additionalCount > 0 && (
            <>
              <Text weight="bold" size="xl" color="#1F2937">, </Text>
              <Text weight="semiBold" size="xl" color="#5299FE">
                {additionalText}
              </Text>
            </>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text weight="semiBold" size="sm" color={statusConfig.textColor}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Car and Mechanic Info Row */}
      <View style={styles.infoRow}>
        {/* Car Info */}
        <View style={styles.carInfo}>
          {showCarPlaceholder ? (
            <View style={styles.carPlaceholder}>
              <Car size={20} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          ) : (
            <Image
              source={{ uri: booking.makeLogoUrl! }}
              style={styles.carImage}
              resizeMode="contain"
              onError={() => setCarImageError(true)}
            />
          )}
          <View style={styles.carDetails}>
            <Text
              weight="bold"
              size="sm"
              color="#1F2937"
            >
              {titleCase(booking.carModel)}
            </Text>
            <Text weight="regular" size="xs" color="#6B7280">
              {booking.licensePlate}
            </Text>
          </View>
        </View>

        {/* Mechanic Info */}
        <View style={styles.mechanicInfo}>
          {booking.mechanicImage ? (
            <Image source={{ uri: booking.mechanicImage }} style={styles.mechanicImage} />
          ) : (
            <View style={styles.mechanicPlaceholder}>
              <User size={18} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.mechanicDetails}>
            <Text weight="bold" size="sm" color="#1F2937">
              {booking.mechanicName}
            </Text>
            <Text weight="regular" size="xs" color="#6B7280">
              {booking.shopName}
            </Text>
          </View>
        </View>
      </View>

      {/* Live Tracker toggle — upcoming variant only */}
      {canToggleLive && onToggleLiveTracker ? (
        <View style={styles.liveToggleRow}>
          <View style={styles.liveToggleLabel}>
            <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
            <Text weight="semiBold" size="sm" color={isLive ? '#5299FE' : '#6B7280'}>
              {isLive ? 'Live Tracker On' : 'Move to Live Tracker'}
            </Text>
          </View>
          <Switch
            value={isLive}
            onValueChange={() => onToggleLiveTracker(booking.id)}
            trackColor={{ false: '#E5E5EA', true: '#5299FE' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E5EA"
          />
        </View>
      ) : null}

      {/* Date/Time or Completion Info */}
      {variant === 'upcoming' ? (
        <View style={styles.dateTimeContainer}>
          <Text weight="semiBold" size="sm" color="#5299FE">
            {booking.date}
          </Text>
          <Text weight="semiBold" size="sm" color="#5299FE">
            {booking.time}
          </Text>
        </View>
      ) : (
        <View style={styles.historyInfoContainer}>
          <View style={styles.historyInfoRow}>
            <Text weight="regular" size="sm" color="#6B7280">
              Completed On
            </Text>
            <Text weight="semiBold" size="sm" color="#5299FE">
              {booking.date}
            </Text>
          </View>
          <View style={styles.historyInfoRow}>
            <Text weight="regular" size="sm" color="#6B7280">
              Total Cost
            </Text>
            <Text weight="semiBold" size="sm" color="#5299FE">
              ${booking.totalCost?.toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>
      )}

      {/* Actions Row */}
      {variant === 'upcoming' ? (
        <View style={booking.status === 'confirmed' ? styles.actionsRow : styles.actionsRowSpaced}>
          <Pressable
            onPress={handleCancelBooking}
            style={({ pressed }) => [
              styles.outlinedButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text weight="semiBold" size="sm" color="#1F2937">
              Cancel Booking
            </Text>
          </Pressable>
          
          {booking.status === 'confirmed' && (
            <Pressable
              onPress={handleReschedule}
              style={({ pressed }) => [
                styles.outlinedButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text weight="semiBold" size="sm" color="#1F2937">
                Reschedule
              </Text>
            </Pressable>
          )}
          
          <Pressable
            onPress={handleViewDetails}
            style={({ pressed }) => [
              styles.filledButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text weight="semiBold" size="sm" color="#FFFFFF">
              View Details
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleDownloadPdf}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <FileText size={20} color="#1F2937" strokeWidth={1.5} />
          </Pressable>
          
          <Pressable
            onPress={handleToggleFavorite}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Star size={20} color="#1F2937" strokeWidth={1.5} />
          </Pressable>
          
          <View style={{ flex: 1 }} />
          
          <Pressable
            onPress={handleViewDetails}
            style={({ pressed }) => [
              styles.filledButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text weight="semiBold" size="sm" color="#FFFFFF">
              View Details
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  servicesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  carInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  carImage: {
    width: 50,
    height: 32,
    marginRight: 8,
  },
  carPlaceholder: {
    width: 36,
    height: 36,
    marginRight: 8,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mechanicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mechanicImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  mechanicPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mechanicDetails: {
    gap: 2,
  },
  liveToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  liveToggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  liveDotActive: {
    backgroundColor: '#5299FE',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyInfoContainer: {
    marginBottom: 16,
  },
  historyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginLeft: -4,
  },
  actionsRowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outlinedButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filledButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#5299FE',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

export default BookingCard;

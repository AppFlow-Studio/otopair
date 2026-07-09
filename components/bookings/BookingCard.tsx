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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import type { View as RNView } from 'react-native';

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { Car, FileText, Star, User } from 'lucide-react-native';
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// 3. Shared UI
import { FixedPriceBadge, Text } from '@/components/shared-ui';
import { BookingProgressBar } from '@/components/bookings/BookingProgressBar';
import { ApprovalBanner } from '@/components/booking/ApprovalBanner';
import { getBookingStageView } from '@/utils/bookingStages';
import { useRescheduleDecisionOverlayStore } from '@/stores/useRescheduleDecisionOverlayStore';
import type { Id } from '@/convex/_generated/dataModel';

// ============================================================================
// TYPES
// ============================================================================

export type BookingStatus = 'pending_shop_acceptance' | 'pending' | 'pending_quote' | 'quotes_ready' | 'pending_customer_acceptance' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'delayed' | 'no_show';

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
  /** Free-form detail. Used by PendingQuoteCard in Upcoming to display the
   *  tire specs the user requested before any shop has quoted a price. */
  notes?: string;
  /** Epoch ms the booking was created. Drives newest-first ordering in the
   *  My Bookings lists. Optional only for back-compat with legacy adapters. */
  createdAt?: number;
  /** VIN of the vehicle the booking is for. Used by the vehicle-filter
   *  chip on My Bookings to match by ID instead of name parsing. */
  vin?: string;
  /** When status === "in_progress", the convex `live_stage` slug
   *  (booking_confirmed | service_in_progress | vehicle_ready). Drives
   *  the 3rd vs 4th segment of the service progress bar. */
  liveStage?: string;
  /** Convex shop_id — needed when writing a review on a completed booking. */
  shopId?: string;
  /** Convex mechanic_id — optional review association. */
  mechanicId?: string;
  /** Pre-Job Approval flow: customer-facing range snapshotted at create. */
  disclosedRangeLowCents?: number;
  disclosedRangeHighCents?: number;
  /** Approval/capture lifecycle — drives whether to show range vs final. */
  paymentApprovalState?: string;
  /** Final captured amount in cents (set after Stripe capture). */
  finalCaptureAmountCents?: number;
  /** Shop-assigned invoice / work-order number. When the mechanic sets one,
   *  the card surfaces it instead of the last-6 booking id. */
  invoiceNumber?: string;
  /** Set on quote-stage bookings ("pending_quote" / "quotes_ready") so the
   *  Bookings tab knows which QuoteListSheet variant to open. Derived from
   *  bookings.tire_specs / bookings.rotor_specs in the Convex adapter. */
  quoteType?: "tire" | "rotor";
}

interface BookingCardProps {
  booking: Booking;
  variant: 'upcoming' | 'history';
  onViewDetails?: (bookingId: string) => void;
  onCancelBooking?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onDownloadPdf?: (bookingId: string) => void;
  onToggleFavorite?: (bookingId: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_BUTTON_GAP = 10;
const ACTION_BUTTON_LABEL_SIZE = 15;

// ============================================================================
// STATUS CONFIG
// ============================================================================

export const STATUS_CONFIG: Record<BookingStatus, { label: string; bgColor: string; textColor: string }> = {
  pending_shop_acceptance: {
    label: 'Pending Shop',
    bgColor: '#fff6ee',
    textColor: '#f89829',
  },
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
  quotes_ready: {
    label: 'Quotes Ready',
    bgColor: '#E3F0FF',
    textColor: '#2F6DCC',
  },
  pending_customer_acceptance: {
    label: 'Rescheduled',
    bgColor: '#FFF6E5',
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
  no_show: {
    label: 'No-show',
    bgColor: '#FEE2E2',
    textColor: '#DC2626',
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
}: BookingCardProps) {
  const router = useRouter();
  const openRescheduleDecision = useRescheduleDecisionOverlayStore((s) => s.open);
  const primaryBtnRef = useRef<RNView | null>(null);
  // Local "just cancelled" state. The card swaps the badge + dims for ~450ms
  // before we actually call onCancelBooking; the parent's data-source change
  // then triggers the FadeOut exit, and `layout` shifts siblings up.
  const [isCancelling, setIsCancelling] = useState(false);
  const effectiveStatus = isCancelling ? 'cancelled' : booking.status;
  // Fall back to a neutral pill when the backend returns a status we
  // don't have a config for, so an unknown value doesn't crash the card.
  const statusConfig = STATUS_CONFIG[effectiveStatus] ?? {
    label: titleCase(String(effectiveStatus ?? 'Unknown').replace(/_/g, ' ')),
    bgColor: '#E5E7EB',
    textColor: '#6B7280',
  };

  const dim = useSharedValue(1);
  useEffect(() => {
    if (isCancelling) {
      dim.value = withTiming(0.45, { duration: 280 });
    }
  }, [isCancelling, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const [carImageError, setCarImageError] = useState(false);
  const showCarPlaceholder = !booking.makeLogoUrl?.trim() || carImageError;
  
  // Invoice number wins when the mechanic has attached one; otherwise
  // fall back to the last-6 of the convex booking id so the customer
  // still has something to quote on a support ticket.
  const idLine = useMemo(() => {
    const invoice = booking.invoiceNumber?.trim();
    if (invoice) return invoice;
    if (!booking.id) return null;
    return `#${booking.id.slice(-6).toUpperCase()}`;
  }, [booking.invoiceNumber, booking.id]);

  // Format services display
  const mainService = booking.services[0] || 'Service';
  const additionalCount = booking.services.length - 1;
  const additionalText = variant === 'history' 
    ? `+${additionalCount} Services` 
    : `+${additionalCount} More`;

  const handleViewDetails = () => {
    // Bookings awaiting customer acceptance route to the dedicated
    // Accept / Decline overlay instead of the generic details sheet —
    // the action is the whole point of the row.
    if (booking.status === 'pending_customer_acceptance') {
      const launch = (rect: { x: number; y: number; width: number; height: number }) => {
        openRescheduleDecision(rect, booking.id as unknown as Id<'bookings'>);
      };
      const node = primaryBtnRef.current as unknown as { measureInWindow?: (...args: any[]) => void } | null;
      if (node && typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          launch({ x, y, width, height });
        });
      } else {
        launch({ x: 16, y: 200, width: 200, height: 48 });
      }
      return;
    }
    if (onViewDetails) {
      onViewDetails(booking.id);
    } else {
      // Default fallback - booking details page not yet implemented
      router.push({ pathname: '/coming-soon', params: { serviceName: 'Booking Details' } });
    }
  };

  const handleCancelBooking = () => {
    if (isCancelling) return;
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Cancel Appointment",
          style: "destructive",
          onPress: () => {
            // Show the in-card "cancelled" visual first, THEN fire the
            // mutation. The data-source removal triggers FadeOut, and
            // sibling cards shift smoothly via layout transition.
            setIsCancelling(true);
            setTimeout(() => onCancelBooking?.(booking.id), 450);
          },
        },
      ],
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


  const stageView = getBookingStageView(booking.status, booking.liveStage);

  return (
    <Animated.View
      style={[styles.card, dimStyle]}
      exiting={FadeOut.duration(220)}
      layout={LinearTransition.duration(260)}
    >
      {/* Lifecycle progress bar — see utils/bookingStages.ts. The status
          badge in the title row below carries the same info textually so
          the bar reads as visual reinforcement. */}
      <BookingProgressBar
        stages={stageView.stages}
        currentIndex={stageView.currentIndex}
      />

      {/* Pending-approval or reauth-required CTA. Returns null when the
          booking isn't in one of those states, so no extra guard needed. */}
      <ApprovalBanner
        bookingId={booking.id}
        paymentApprovalState={booking.paymentApprovalState}
      />

      {/* Booking identifier — invoice number if the mechanic attached one,
          else the last-6 of the convex booking id. Tiny gray line above the
          service title so customers can quote it on a support ticket. */}
      {idLine ? (
        <Text
          weight="semiBold"
          size="xs"
          color="#9CA3AF"
          style={styles.idLine}
        >
          {idLine}
        </Text>
      ) : null}

      {/* Title Row */}
      <View style={styles.titleRow}>
        <View style={styles.servicesContainer}>
          <Text
            weight="bold"
            size="xl"
            color="#1F2937"
            style={isCancelling ? styles.strikethrough : undefined}
          >
            {mainService}
          </Text>
          {additionalCount > 0 && (
            <>
              <Text weight="bold" size="xl" color="#1F2937">, </Text>
              <Text
                weight="semiBold"
                size="xl"
                color="#5299FE"
                style={isCancelling ? styles.strikethrough : undefined}
              >
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
            {/* Server falls back to shopName for `mechanicName` when no
                mechanic is assigned (e.g. accepted tire quotes). Skip
                the second line when it's the same string to avoid
                rendering "Shop / Shop". */}
            {booking.mechanicName !== booking.shopName ? (
              <Text weight="regular" size="xs" color="#6B7280">
                {booking.shopName}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Date/Time or Completion Info */}
      {variant === 'upcoming' ? (
        booking.status === 'pending_quote' ? (
          <View style={styles.dateTimeContainer}>
            <Text weight="semiBold" size="sm" color="#C8972E">
              Awaiting quote
            </Text>
            <Text weight="regular" size="sm" color="#6B7280">
              Time TBD
            </Text>
          </View>
        ) : (
          <View style={styles.dateTimeContainer}>
            <Text weight="semiBold" size="sm" color="#5299FE">
              {booking.date}
            </Text>
            <Text weight="semiBold" size="sm" color="#5299FE">
              {booking.time}
            </Text>
          </View>
        )
      ) : (
        <View style={styles.historyInfoContainer}>
          {/* Cancelled rows shouldn't fake a "Total Cost: $0.00" — many never
              reached a confirmed quote (tire-quote requests abandoned in
              pending_quote), so the dollar amount is meaningless. Show a
              status pill instead, and label the date as "Cancelled On" when
              one exists. */}
          {booking.status === 'cancelled' ? (
            <>
              {booking.date ? (
                <View style={styles.historyInfoRow}>
                  <Text weight="regular" size="sm" color="#6B7280">
                    Cancelled On
                  </Text>
                  <Text weight="semiBold" size="sm" color="#6B7280">
                    {booking.date}
                  </Text>
                </View>
              ) : null}
              <View style={styles.historyInfoRow}>
                <Text weight="regular" size="sm" color="#6B7280">
                  Status
                </Text>
                <Text weight="semiBold" size="sm" color={STATUS_CONFIG.cancelled.textColor}>
                  Not charged
                </Text>
              </View>
            </>
          ) : (
            <>
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
                <View style={styles.historyTotalCostWrap}>
                  {booking.disclosedRangeLowCents != null &&
                    booking.disclosedRangeHighCents != null &&
                    booking.disclosedRangeLowCents === booking.disclosedRangeHighCents && (
                      <FixedPriceBadge size="sm" />
                    )}
                  <Text weight="semiBold" size="sm" color="#5299FE">
                    ${booking.totalCost?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* Actions Row. Once a booking is in service the user can no
          longer cancel or reschedule because service is in flight at the shop. */}
      {variant === 'upcoming' ? (
        <View
          style={styles.actionsStack}
          pointerEvents={isCancelling ? 'none' : 'auto'}
        >
          <Pressable
            ref={primaryBtnRef}
            onPress={handleViewDetails}
            disabled={isCancelling}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.primaryButtonFull,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              weight="semiBold"
              size={ACTION_BUTTON_LABEL_SIZE}
              color="#FFFFFF"
              numberOfLines={1}
              lineHeight={1.2}
              style={styles.actionButtonLabel}
            >
              {booking.status === 'pending_customer_acceptance'
                ? 'Review change'
                : 'View Details'}
            </Text>
          </Pressable>

          {booking.status !== 'in_progress' && (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleCancelBooking}
                disabled={isCancelling}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  weight="semiBold"
                  size={ACTION_BUTTON_LABEL_SIZE}
                  color="#DC2626"
                  numberOfLines={1}
                  lineHeight={1.2}
                  style={styles.actionButtonLabel}
                >
                  Cancel Booking
                </Text>
              </Pressable>

              <Pressable
                onPress={handleReschedule}
                disabled={isCancelling}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  weight="semiBold"
                  size={ACTION_BUTTON_LABEL_SIZE}
                  color="#1F2937"
                  numberOfLines={1}
                  lineHeight={1.2}
                  style={styles.actionButtonLabel}
                >
                  Reschedule
                </Text>
              </Pressable>
            </View>
          )}
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
              View Receipt
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
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
  idLine: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
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
  strikethrough: {
    textDecorationLine: 'line-through',
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
    minWidth: 0,
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
    flex: 1,
    minWidth: 0,
    gap: 2,
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
  historyTotalCostWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTION_BUTTON_GAP,
  },
  actionsStack: {
    gap: ACTION_BUTTON_GAP,
  },
  actionButtonLabel: {
    textAlign: 'center',
  },
  // Upcoming-variant action buttons. flexBasis: 0 + flexGrow: 1 + minWidth: 0
  // forces equal widths regardless of label length — `flex: 1` alone can let
  // the longer-label button (e.g. "Cancel Booking") win an extra few pixels
  // off intrinsic text width. Same pattern is mirrored in PendingQuoteCard.
  primaryButton: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#5299FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonFull: {
    flexBasis: 'auto',
    flexGrow: 0,
    width: '100%',
  },
  secondaryButton: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // History-variant: small "View Details" pill next to icon buttons.
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

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
import { Alert, Image, PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import type { View as RNView } from 'react-native';

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { CalendarClock, Car, ChevronRight, FileText, Star, User } from 'lucide-react-native';
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// 3. Shared UI
import { FixedPriceBadge, Text } from '@/components/shared-ui';
import { BookingProgressBar } from '@/components/bookings/BookingProgressBar';
import { LinearGradient } from 'expo-linear-gradient';
// Same navy the Home banner and the booking sheet lead with — an upcoming card
// is the same object at a smaller size, so it carries the same header.
import { HERO_SURFACE, HERO_SURFACE_DEEP } from '@/components/home/UpcomingAppointmentHero';
import { ApprovalBanner } from '@/components/booking/ApprovalBanner';
import { getBookingStageView } from '@/utils/bookingStages';
import { useConnection } from '@/hooks/useConnection';
import { isBookingActionAllowed } from '@/lib/connection/offlineBookingActions';
import { OfflineActionsNotice } from '@/components/connection/OfflineActionsNotice';
import { useRescheduleDecisionOverlayStore } from '@/stores/useRescheduleDecisionOverlayStore';
import type { Id } from '@/convex/_generated/dataModel';
import { BookingCardOnLight, BookingCardOnNavy } from '@/constants/theme';

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
  /** Raw "YYYY-MM-DD" service date. `date` is formatted for display
   *  ("Tuesday, May 26") and carries no year, so it can't be sorted or grouped
   *  on — this is the only field that can. */
  scheduledDate?: string;
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
  /** Shop phone from the cached list payload — keeps the details sheet's
   *  Contact handoff working offline (live shop query can't resolve). */
  shopPhone?: string;
  /** Shop street address from the cached list payload — same offline
   *  fallback for the Directions handoff. */
  shopAddress?: string;
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

const CARD_PADDING = 16;
const CARD_RADIUS = 16;


const ACTION_BUTTON_GAP = 10;
const ACTION_BUTTON_HORIZONTAL_PADDING = 32;
const ACTION_BUTTON_LABEL_MAX_SIZE = 14;
const ACTION_BUTTON_LABEL_MIN_SIZE = 12;
const ACTION_BUTTON_LONGEST_LABEL = 'Cancel Booking';
const ACTION_BUTTON_LABEL_WIDTH_RATIO = 0.66;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getActionButtonLabelSize(rowWidth: number, fontScale: number): number {
  if (rowWidth <= 0) {
    return ACTION_BUTTON_LABEL_MAX_SIZE;
  }

  const buttonWidth = (rowWidth - ACTION_BUTTON_GAP) / 2;
  const availableLabelWidth = buttonWidth - ACTION_BUTTON_HORIZONTAL_PADDING;
  const fittedSize =
    availableLabelWidth /
    (ACTION_BUTTON_LONGEST_LABEL.length * ACTION_BUTTON_LABEL_WIDTH_RATIO * fontScale);

  return clamp(
    fittedSize,
    ACTION_BUTTON_LABEL_MIN_SIZE,
    ACTION_BUTTON_LABEL_MAX_SIZE,
  );
}

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
  // Offline gate: Cancel/Reschedule are backend writes — while offline the
  // whole row is replaced by the "last synced info" strip; View Details
  // stays live (the sheet reads cached data). Keyed on hard `offline` (not
  // useCanWrite) so a 1–2s socket "reconnecting" blip doesn't flash the
  // strip in and out.
  const conn = useConnection();
  const writeActionsAllowed = isBookingActionAllowed('cancelBooking', conn !== 'offline');
  const primaryBtnRef = useRef<RNView | null>(null);
  const [actionsRowWidth, setActionsRowWidth] = useState(0);
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
  const fontScale = PixelRatio.getFontScale();
  const actionButtonLabelSize = useMemo(
    () => getActionButtonLabelSize(actionsRowWidth, fontScale),
    [actionsRowWidth, fontScale],
  );
  
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
  const isUpcoming = variant === 'upcoming';

  /**
   * Upcoming cards are navy end to end — the hero gradient runs the full card
   * rather than banding just the header — so every foreground colour has to
   * invert. History cards stay on white and keep the original values.
   *
   * One palette, switched once, rather than `isUpcoming ? … : …` at ~25 call
   * sites.
   */
  const P = isUpcoming ? BookingCardOnNavy : BookingCardOnLight;

  return (
    <Animated.View
      style={[
        styles.card,
        // Base under the gradient so the corners and any sub-pixel gap read
        // navy rather than flashing white.
        isUpcoming && { backgroundColor: HERO_SURFACE },
        dimStyle,
      ]}
      exiting={FadeOut.duration(220)}
      layout={LinearTransition.duration(260)}
    >
      {/* Navy surface for the WHOLE card — mirrors the Home banner and the
          details sheet, so the three read as one object at three sizes.
          Upcoming only; history rows are an archive and stay plain white.
          Sits at the card root (not inside the header) so it reaches every
          edge, and bleeds past the padding while carrying its own radii, so
          the card keeps the shadow it would lose to `overflow: hidden`. */}
      {isUpcoming ? (
        <LinearGradient
          colors={[HERO_SURFACE, HERO_SURFACE_DEEP]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.navyBand}
          pointerEvents="none"
        />
      ) : null}

      {/* The card body IS the tap target — that's what replaced the old
          full-width "View Details" button. Actions stay outside the Pressable
          so there's no nested-press ambiguity. */}
      <Pressable
        onPress={handleViewDetails}
        disabled={isCancelling}
        accessibilityRole="button"
        accessibilityLabel={`${mainService} at ${booking.shopName}. ${statusConfig.label}. Open booking details`}
      >
      {/* Navy header band — mirrors the Home banner and the details sheet, so
          the three read as one object at three sizes. Upcoming only; history
          rows are an archive and stay plain white. The gradient bleeds past the
          card's padding to reach its edges and carries its own top radii, so
          the card keeps the shadow it would lose to `overflow: hidden`. It has
          to enclose the title row too — the title inverts to white inside it. */}
      <View style={styles.headerBlock}>

        {/* Lifecycle progress bar — see utils/bookingStages.ts. Segments only:
            the status badge beside the title already names the state, and the
            bar's own stage label worded it differently ("Booked" under a
            "Pending Shop" pill), which read as a contradiction. */}
        <BookingProgressBar
          stages={stageView.stages}
          currentIndex={stageView.currentIndex}
          showStageLabel={false}
          onDark={isUpcoming}
        />

        {idLine ? (
          <Text
            weight="semiBold"
            size="xs"
            color={isUpcoming ? 'rgba(255,255,255,0.55)' : '#9CA3AF'}
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
            color={isUpcoming ? '#FFFFFF' : '#1F2937'}
            style={isCancelling ? styles.strikethrough : undefined}
          >
            {mainService}
          </Text>
          {additionalCount > 0 && (
            <>
              <Text weight="bold" size="xl" color={isUpcoming ? '#FFFFFF' : '#1F2937'}>, </Text>
              <Text
                weight="semiBold"
                size="xl"
                color={P.accent}
                style={isCancelling ? styles.strikethrough : undefined}
              >
                {additionalText}
              </Text>
            </>
          )}
        </View>
        {/* STATUS_CONFIG's bgColors are near-white pastels meant for a white
            card; on the navy band they read as a bright blob, so the chip goes
            translucent and the status colour survives as the dot. */}
        <View
          style={[
            styles.statusBadge,
            isUpcoming
              ? styles.statusBadgeOnDark
              : { backgroundColor: statusConfig.bgColor },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusConfig.textColor }]} />
          <Text weight="semiBold" size="sm" color={isUpcoming ? '#FFFFFF' : statusConfig.textColor}>
            {statusConfig.label}
          </Text>
        </View>
      </View>
      </View>

      {/* Pending-approval or reauth-required CTA. Returns null when the
          booking isn't in one of those states, so no extra guard needed. Sits
          below the navy band, on the white body. */}
      <ApprovalBanner
        bookingId={booking.id}
        paymentApprovalState={booking.paymentApprovalState}
      />

      {/* Car and Mechanic Info Row */}
      <View style={styles.infoRow}>
        {/* Car Info */}
        <View style={styles.carInfo}>
          {showCarPlaceholder ? (
            <View style={styles.carPlaceholder}>
              <Car size={20} color={P.icon} strokeWidth={1.5} />
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
              color={P.text}
            >
              {titleCase(booking.carModel)}
            </Text>
            <Text weight="regular" size="xs" color={P.textMuted}>
              {booking.licensePlate}
            </Text>
          </View>
        </View>

        {/* Mechanic Info */}
        <View style={styles.mechanicInfo}>
          {booking.mechanicImage ? (
            <Image source={{ uri: booking.mechanicImage }} style={styles.mechanicImage} />
          ) : (
            <View style={[styles.mechanicPlaceholder, { backgroundColor: P.surface }]}>
              <User size={18} color={P.icon} strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.mechanicDetails}>
            <Text weight="bold" size="sm" color={P.text}>
              {booking.mechanicName}
            </Text>
            {/* Server falls back to shopName for `mechanicName` when no
                mechanic is assigned (e.g. accepted tire quotes). Skip
                the second line when it's the same string to avoid
                rendering "Shop / Shop". */}
            {booking.mechanicName !== booking.shopName ? (
              <Text weight="regular" size="xs" color={P.textMuted}>
                {booking.shopName}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Date/Time or Completion Info */}
      {variant === 'upcoming' ? (
        booking.status === 'pending_quote' ? (
          <View style={styles.whenRow}>
            <CalendarClock size={15} color={P.amber} strokeWidth={2} />
            <Text weight="semiBold" size="sm" color={P.amber}>
              Awaiting quote · Time TBD
            </Text>
            <View style={styles.whenSpacer} />
            <ChevronRight size={18} color={P.chevron} strokeWidth={2} />
          </View>
        ) : (
          <View style={styles.whenRow}>
            <CalendarClock size={15} color={P.textMuted} strokeWidth={2} />
            <Text weight="semiBold" size="sm" color={P.text} numberOfLines={1}>
              {[booking.date, booking.time].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.whenSpacer} />
            <ChevronRight size={18} color={P.chevron} strokeWidth={2} />
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
                  <Text weight="regular" size="sm" color={P.textMuted}>
                    Cancelled On
                  </Text>
                  <Text weight="semiBold" size="sm" color={P.textMuted}>
                    {booking.date}
                  </Text>
                </View>
              ) : null}
              <View style={styles.historyInfoRow}>
                <Text weight="regular" size="sm" color={P.textMuted}>
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
                <Text weight="regular" size="sm" color={P.textMuted}>
                  Completed On
                </Text>
                <Text weight="semiBold" size="sm" color={P.accent}>
                  {booking.date}
                </Text>
              </View>
              <View style={styles.historyInfoRow}>
                <Text weight="regular" size="sm" color={P.textMuted}>
                  Total Cost
                </Text>
                <View style={styles.historyTotalCostWrap}>
                  {booking.disclosedRangeLowCents != null &&
                    booking.disclosedRangeHighCents != null &&
                    booking.disclosedRangeLowCents === booking.disclosedRangeHighCents && (
                      <FixedPriceBadge size="sm" />
                    )}
                  <Text weight="semiBold" size="sm" color={P.accent}>
                    ${booking.totalCost?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      </Pressable>

      {/* Actions Row. Once a booking is in service the user can no
          longer cancel or reschedule because service is in flight at the shop. */}
      {variant === 'upcoming' ? (
        <View
          style={styles.actionsStack}
          onLayout={(event) => setActionsRowWidth(event.nativeEvent.layout.width)}
          pointerEvents={isCancelling ? 'none' : 'auto'}
        >
          {/* Only rendered when the booking needs a decision. `primaryBtnRef`
              is measured to morph the Accept/Decline overlay out of this
              button, and that is the one status that opens it — so the ref is
              never missing on the path that reads it. */}
          {booking.status === 'pending_customer_acceptance' ? (
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
                size={actionButtonLabelSize}
                color="#FFFFFF"
                numberOfLines={1}
                lineHeight={1.2}
                style={styles.actionButtonLabel}
              >
                Review change
              </Text>
            </Pressable>
          ) : null}

          {booking.status !== 'in_progress' && (
            writeActionsAllowed ? (
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleCancelBooking}
                  disabled={isCancelling}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    { backgroundColor: P.dangerSurface, borderColor: P.dangerBorder },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    weight="semiBold"
                    size={actionButtonLabelSize}
                    color={P.danger}
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
                    { backgroundColor: P.surface, borderColor: P.surfaceBorder },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    weight="semiBold"
                    size={actionButtonLabelSize}
                    color={P.text}
                    numberOfLines={1}
                    lineHeight={1.2}
                    style={styles.actionButtonLabel}
                  >
                    Reschedule
                  </Text>
                </Pressable>
              </View>
            ) : (
              <OfflineActionsNotice />
            )
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
            <FileText size={20} color={P.text} strokeWidth={1.5} />
          </Pressable>
          
          <Pressable
            onPress={handleToggleFavorite}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Star size={20} color={P.text} strokeWidth={1.5} />
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
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusBadgeOnDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Gives the band a positioning context and pushes the white body clear of it.
  headerBlock: {
    marginBottom: 4,
  },
  /** Runs the full card, not just the header band — the gradient is the card
   *  surface now, so it has to reach every edge and carry all four radii. */
  navyBand: {
    position: 'absolute',
    top: -CARD_PADDING,
    left: -CARD_PADDING,
    right: -CARD_PADDING,
    bottom: -CARD_PADDING,
    borderRadius: CARD_RADIUS,
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
  // Was a bordered box holding two blue strings at opposite ends. A card
  // inside a card, for one line of text.
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  whenSpacer: {
    flex: 1,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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

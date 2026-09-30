/**
 * BookingConfirmStatus
 *
 * Sheet body shown on the `/booking/mechanic/[id]/confirming` route. Mirrors
 * the tire-quote `QuoteRequestStatus` pattern: a summary block (appointment,
 * vehicle, mechanic) above an Uber-Eats-style Confirm-with-countdown
 * primary CTA + a Go back secondary. Reads directly from the booking,
 * mechanic, shop, and vehicle stores so the parent route stays thin.
 *
 * USED IN: app/(booking)/mechanic/[id]/confirming.tsx
 */
import React, { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { AlertTriangle, Calendar, Car, User } from "lucide-react-native";

import { FixedPriceBadge, Text } from "@/components/shared-ui";
import { ConfirmCountdownButton } from "@/components/tire-booking/QuoteRequestStatus";
import { diffCheckoutPrice } from "@/convex/lib/checkoutPrice";
import { useCheckoutLivePriceLines } from "@/hooks/useCreateBookingConvex";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { resolveBookingVehicleVin } from "@/utils/bookingVehicle";

interface Props {
  /** Fires once - either via user tap or the 8s countdown auto-fire.
   *  Triggers the createBooking mutation in the parent route. */
  onConfirm: () => void;
  /** Dismiss the sheet and bounce back to the payment screen. */
  onGoBack: () => void;
  /** Mechanic id passed in from the route params; used to pull the
   *  mechanic record in case selectedMechanicId hasn't been hydrated. */
  mechanicId?: string;
  title?: string;
  primaryCta?: string;
  showPaymentSummary?: boolean;
  /** Something the parent watches changed under the sheet (a service the
   *  shop stopped offering, a reschedule that's no longer allowed). Shows the
   *  message, stops the countdown and disables Confirm. */
  blocker?: { message: string; actionLabel?: string; onAction?: () => void } | null;
  /** Hold the countdown without a banner. */
  paused?: boolean;
  /** Something the Confirm depends on is still loading: hold the countdown
   *  and show a spinner in the button instead of firing blind. */
  loading?: boolean;
}

/** Pause while the app isn't in the foreground: Android freezes JS timers on
 *  host pause but iOS keeps them running for a while, so a backgrounded sheet
 *  could otherwise commit a booking nobody was looking at (#393). */
function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => sub.remove();
  }, []);
  return active;
}

export function BookingConfirmStatus({
  onConfirm,
  onGoBack,
  mechanicId,
  title = "Confirming your appointment...",
  primaryCta,
  showPaymentSummary = true,
  blocker = null,
  paused = false,
  loading = false,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const selectedVehicleVin = useBookingStore((s) => s.selectedVehicleVin);
  const quoteAcceptContext = useBookingStore((s) => s.quoteAcceptContext);
  const disclosedRangeFormatted = useBookingStore((s) => s.disclosedRangeFormatted);
  const disclosedRangeIsFixedPrice = useBookingStore((s) => s.disclosedRangeIsFixedPrice);
  const priceSnapshot = useBookingStore((s) => s.checkoutPriceSnapshot);
  const appIsActive = useAppIsActive();

  // #390: quote the price the customer agreed to on Review & Pay (the
  // Authorize-time snapshot), and watch the same live pricing that screen
  // renders. If a shop edit moves a line the server would reject, stop the
  // auto-fire and send them back to review it instead of committing a price
  // they never saw. Quote accepts carry a firm shop quote and no snapshot.
  const priceCheckEnabled = showPaymentSummary && !quoteAcceptContext && priceSnapshot != null;
  const { lines: liveLines } = useCheckoutLivePriceLines(priceCheckEnabled);
  const priceChanged = useMemo(
    () =>
      priceCheckEnabled && priceSnapshot && liveLines
        ? diffCheckoutPrice(priceSnapshot.price, liveLines).length > 0
        : false,
    [priceCheckEnabled, priceSnapshot, liveLines],
  );
  const displayedRange =
    !quoteAcceptContext && priceSnapshot ? priceSnapshot.formatted : disclosedRangeFormatted;
  const activeBlocker = priceChanged
    ? {
        message: "The price changed — review it before you confirm.",
        actionLabel: "Review price",
        onAction: onGoBack,
      }
    : blocker;
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);
  const bookingVehicleVin = resolveBookingVehicleVin(
    quoteAcceptContext?.vehicleVin,
    selectedVehicleVin,
  );
  const bookingVehicle = useVehicleStore((s) =>
    bookingVehicleVin ? s.vehicles[bookingVehicleVin] : undefined,
  );

  const mechanic = getMechanicById(selectedMechanicId ?? mechanicId ?? "");
  const shopId = mechanic?.shopId ?? selectedMechanicSlot?.shopId;
  const shop = shopId ? getShopById(shopId) : null;

  const appointmentLabel = scheduledAppointment
    ? `${scheduledAppointment.displayDate || scheduledAppointment.date} - ${scheduledAppointment.time}`
    : "Time TBD";

  const vehicleLabel = bookingVehicle
    ? `${bookingVehicle.year} ${bookingVehicle.make} ${bookingVehicle.model}`
    : "Selected vehicle";

  const mechanicLabel = mechanic
    ? [mechanic.name, shop?.name].filter(Boolean).join(" - ")
    : ["Any available mechanic", shop?.name].filter(Boolean).join(" - ");
  const isCompactLayout = windowHeight < 860;
  const isVeryCompactLayout = windowHeight < 860;

  return (
    <View style={[styles.container, isCompactLayout && styles.containerCompact]}>
      <Text
        size={isVeryCompactLayout ? "lg" : "xl"}
        weight="bold"
        color="#1A1A1A"
        style={[styles.title, isCompactLayout && styles.titleCompact]}
      >
        {title}
      </Text>

      <View style={[styles.rows, isCompactLayout && styles.rowsCompact]}>
        <InfoRow
          icon={<Calendar size={20} color="#4B5563" strokeWidth={2} />}
          primary="Appointment"
          secondary={appointmentLabel}
          compact={isCompactLayout}
          veryCompact={isVeryCompactLayout}
        />
        <Divider />
        <InfoRow
          icon={<Car size={20} color="#4B5563" strokeWidth={2} />}
          primary={vehicleLabel}
          secondary={bookingVehicle?.vin ? `VIN - ${bookingVehicle.vin}` : undefined}
          compact={isCompactLayout}
          veryCompact={isVeryCompactLayout}
        />
        <Divider />
        <InfoRow
          icon={<User size={20} color="#4B5563" strokeWidth={2} />}
          primary={mechanicLabel}
          compact={isCompactLayout}
          veryCompact={isVeryCompactLayout}
        />
      </View>

      <View style={[styles.actionColumn, isCompactLayout && styles.actionColumnCompact, isVeryCompactLayout && styles.actionColumnVeryCompact]}>
        {activeBlocker ? (
          <View style={styles.blockerBanner} accessibilityRole="alert">
            <AlertTriangle size={16} color="#92400E" strokeWidth={2} />
            <View style={styles.blockerText}>
              <Text size="sm" weight="semiBold" color="#92400E">
                {activeBlocker.message}
              </Text>
              {activeBlocker.actionLabel && activeBlocker.onAction ? (
                <Pressable onPress={activeBlocker.onAction} hitSlop={8}>
                  <Text size="sm" weight="bold" color="#1D4ED8">
                    {activeBlocker.actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {showPaymentSummary && displayedRange ? (
          <View style={styles.rangeBlock}>
            <Text
              size={isVeryCompactLayout ? "sm" : "md"}
              weight="semiBold"
              color="#141C24"
              style={[styles.rangeLine, isVeryCompactLayout && styles.rangeLineVeryCompact]}
            >
              The estimated price for your car is {displayedRange}.
            </Text>
            <View style={styles.rangeBadges}>
              {disclosedRangeIsFixedPrice ? <FixedPriceBadge size="sm" /> : null}
            </View>
          </View>
        ) : null}
        {showPaymentSummary ? (
          <Text
            size={isVeryCompactLayout ? "xs" : "sm"}
            weight="regular"
            color="#6B7280"
            style={[styles.holdNote, isVeryCompactLayout && styles.holdNoteVeryCompact]}
          >
            A $20 hold will be placed on your card.
          </Text>
        ) : null}
        <ConfirmCountdownButton
          onConfirm={onConfirm}
          compact={isCompactLayout}
          label={primaryCta}
          paused={paused || !appIsActive}
          disabled={activeBlocker != null}
          loading={loading && activeBlocker == null}
        />
        <Pressable
          onPress={onGoBack}
          style={({ pressed }) => [
            styles.actionButton,
            isCompactLayout && styles.actionButtonCompact,
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text size={isVeryCompactLayout ? "sm" : "md"} weight="semiBold" color="#1A1A1A">
            Go back
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  primary,
  secondary,
  compact = false,
  veryCompact = false,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  compact?: boolean;
  veryCompact?: boolean;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={[styles.iconSlot, compact && styles.iconSlotCompact]}>{icon}</View>
      <View style={styles.rowText}>
        <Text size={veryCompact ? "sm" : "md"} weight="semiBold" color="#1A1A1A" numberOfLines={1}>
          {primary}
        </Text>
        {secondary ? (
          <Text size={veryCompact ? "xs" : "sm"} weight="regular" color="#6B7280" numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  containerCompact: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    marginTop: 0,
    marginBottom: 14,
  },
  titleCompact: {
    marginBottom: 8,
  },
  rows: {
    marginBottom: 14,
  },
  rowsCompact: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 14,
  },
  rowCompact: {
    paddingVertical: 7,
    gap: 8,
  },
  iconSlot: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSlotCompact: {
    width: 24,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },
  actionColumn: {
    // Sits directly below the info rows — no auto-margin so the rows
    // pack near the top of the sheet and the buttons follow tight.
    marginTop: 8,
    gap: 10,
  },
  actionColumnCompact: {
    marginTop: 6,
    gap: 8,
  },
  actionColumnVeryCompact: {
    marginTop: 4,
    gap: 6,
  },
  actionButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  actionButtonCompact: {
    height: 46,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: "#F2F2F7",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  holdNote: {
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  holdNoteVeryCompact: {
    lineHeight: 16,
    marginBottom: 2,
  },
  rangeLine: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  rangeLineWrap: {
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  rangeLineVeryCompact: {
    lineHeight: 18,
    marginBottom: 2,
  },
  blockerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FCD34D",
  },
  blockerText: {
    flex: 1,
    gap: 4,
  },
  rangeBlock: {
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  rangeBadges: {
    flexDirection: "row",
    gap: 6,
  },
});

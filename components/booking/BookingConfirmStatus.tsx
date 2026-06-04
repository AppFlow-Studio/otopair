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
import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { Calendar, Car, User } from "lucide-react-native";

import { FixedPriceBadge, Text } from "@/components/shared-ui";
import { ConfirmCountdownButton } from "@/components/tire-booking/QuoteRequestStatus";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

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
}

export function BookingConfirmStatus({
  onConfirm,
  onGoBack,
  mechanicId,
  title = "Confirming your appointment...",
  primaryCta,
  showPaymentSummary = true,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const disclosedRangeFormatted = useBookingStore((s) => s.disclosedRangeFormatted);
  const disclosedRangeIsFixedPrice = useBookingStore((s) => s.disclosedRangeIsFixedPrice);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);
  const selectedVehicle = useVehicleStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId] : undefined,
  );

  const mechanic = getMechanicById(selectedMechanicId ?? mechanicId ?? "");
  const shopId = mechanic?.shopId ?? selectedMechanicSlot?.shopId;
  const shop = shopId ? getShopById(shopId) : null;

  const appointmentLabel = scheduledAppointment
    ? `${scheduledAppointment.displayDate || scheduledAppointment.date} - ${scheduledAppointment.time}`
    : "Time TBD";

  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
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
          secondary={selectedVehicle?.vin ? `VIN - ${selectedVehicle.vin}` : undefined}
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
        {showPaymentSummary && disclosedRangeFormatted ? (
          <Text
            size={isVeryCompactLayout ? "sm" : "md"}
            weight="semiBold"
            color="#141C24"
            style={[styles.rangeLine, isVeryCompactLayout && styles.rangeLineVeryCompact]}
          >
            The estimated price for your car is {disclosedRangeFormatted}.
          </Text>
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
});

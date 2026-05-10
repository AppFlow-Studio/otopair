/**
 * BookingConfirmStatus
 *
 * Sheet body shown on the `/home/mechanic/[id]/confirming` route. Mirrors
 * the tire-quote `QuoteRequestStatus` pattern: a summary block (appointment,
 * vehicle, mechanic) above an Uber-Eats-style Confirm-with-countdown
 * primary CTA + a Go back secondary. Reads directly from the booking,
 * mechanic, shop, and vehicle stores so the parent route stays thin.
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id]/confirming.tsx
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Calendar, Car, User } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { ConfirmCountdownButton } from "@/components/tire-booking/QuoteRequestStatus";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

interface Props {
  /** Fires once — either via user tap or the 8s countdown auto-fire.
   *  Triggers the createBooking mutation in the parent route. */
  onConfirm: () => void;
  /** Dismiss the sheet and bounce back to the payment screen. */
  onGoBack: () => void;
  /** Mechanic id passed in from the route params; used to pull the
   *  mechanic record in case selectedMechanicId hasn't been hydrated. */
  mechanicId?: string;
}

export function BookingConfirmStatus({ onConfirm, onGoBack, mechanicId }: Props) {
  const scheduledAppointment = useBookingStore((s) => s.scheduledAppointment);
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const getShopById = useShopStore((s) => s.getShopById);
  const selectedVehicle = useVehicleStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId] : undefined,
  );

  const mechanic = getMechanicById(selectedMechanicId ?? mechanicId ?? "");
  const shop = mechanic?.shopId ? getShopById(mechanic.shopId) : null;

  const appointmentLabel = scheduledAppointment
    ? `${scheduledAppointment.displayDate || scheduledAppointment.date} · ${scheduledAppointment.time}`
    : "Time TBD";

  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "Selected vehicle";

  const mechanicLabel = mechanic
    ? `${mechanic.name}${shop?.name ? ` · ${shop.name}` : ""}`
    : "Selected mechanic";

  return (
    <View style={styles.container}>
      <Text size="xl" weight="bold" color="#1A1A1A" style={styles.title}>
        Confirming your appointment…
      </Text>

      <View style={styles.rows}>
        <InfoRow
          icon={<Calendar size={20} color="#4B5563" strokeWidth={2} />}
          primary="Appointment"
          secondary={appointmentLabel}
        />
        <Divider />
        <InfoRow
          icon={<Car size={20} color="#4B5563" strokeWidth={2} />}
          primary={vehicleLabel}
          secondary={selectedVehicle?.vin ? `VIN · ${selectedVehicle.vin}` : undefined}
        />
        <Divider />
        <InfoRow
          icon={<User size={20} color="#4B5563" strokeWidth={2} />}
          primary={mechanicLabel}
        />
      </View>

      <View style={styles.actionColumn}>
        <ConfirmCountdownButton onConfirm={onConfirm} />
        <Pressable
          onPress={onGoBack}
          style={({ pressed }) => [
            styles.actionButton,
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text size="md" weight="semiBold" color="#1A1A1A">
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
}: {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>{icon}</View>
      <View style={styles.rowText}>
        <Text size="md" weight="semiBold" color="#1A1A1A" numberOfLines={1}>
          {primary}
        </Text>
        {secondary ? (
          <Text size="sm" weight="regular" color="#6B7280" numberOfLines={1}>
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
    paddingBottom: 16,
  },
  title: {
    marginTop: 2,
    marginBottom: 18,
  },
  rows: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  iconSlot: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: "auto",
    gap: 10,
  },
  actionButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  secondaryButton: {
    backgroundColor: "#F2F2F7",
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

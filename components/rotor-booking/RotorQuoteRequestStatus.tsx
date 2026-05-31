/**
 * RotorQuoteRequestStatus
 *
 * PURPOSE: Sheet body shown on the `(rotor-booking)/requesting` route while
 *          the user waits for shops to respond with firm rotor quotes.
 *          Mirrors QuoteRequestStatus from the tire flow — title + ETA +
 *          vehicle row + rotors row + confirm-countdown + go-back.
 *
 * USED IN: app/(rotor-booking)/requesting.tsx
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Car, CircleDot, Clock } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { formatRotorsLabel } from "@/constants/rotorFlow";
import { useRotorBookingStore } from "@/stores/useRotorBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

function formatClock(d: Date): string {
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${hours12}:${mm} ${suffix}`;
}

interface Props {
  onViewUpcoming: () => void;
  onGoBack: () => void;
}

export function RotorQuoteRequestStatus({ onViewUpcoming, onGoBack }: Props) {
  const axle = useRotorBookingStore((s) => s.axle);
  const tier = useRotorBookingStore((s) => s.tier);
  const selectedVehicle = useVehicleStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId] : undefined,
  );

  const etaLabel = useMemo(() => {
    const now = Date.now();
    const start = new Date(now + 5 * 60 * 1000);
    const end = new Date(now + 10 * 60 * 1000);
    return `${formatClock(start)} – ${formatClock(end)}`;
  }, []);

  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "Selected vehicle";

  const rotorsLabel = axle && tier ? formatRotorsLabel(axle, tier) : "Rotors";

  return (
    <View style={styles.container}>
      <Text size="xl" weight="bold" color="#1A1A1A" style={styles.title}>
        Reaching out to shops…
      </Text>

      <View style={styles.rows}>
        <InfoRow
          icon={<Clock size={20} color="#4B5563" strokeWidth={2} />}
          primary="Quotes ready between"
          secondary={etaLabel}
        />
        <Divider />
        <InfoRow
          icon={<Car size={20} color="#4B5563" strokeWidth={2} />}
          primary={vehicleLabel}
          secondary={selectedVehicle?.vin ? `VIN · ${selectedVehicle.vin}` : undefined}
        />
        <Divider />
        <InfoRow
          icon={<CircleDot size={20} color="#4B5563" strokeWidth={2} />}
          primary={rotorsLabel}
        />
      </View>

      <View style={styles.actionColumn}>
        <ConfirmCountdownButton onConfirm={onViewUpcoming} />
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

const COUNTDOWN_SECONDS = 7;

export function ConfirmCountdownButton({ onConfirm }: { onConfirm: () => void }) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const progress = useSharedValue(0);
  const firedRef = useRef(false);

  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onConfirm();
  };

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: COUNTDOWN_SECONDS * 1000,
      easing: Easing.linear,
    });

    const interval = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    const autoFireTimeout = setTimeout(fire, COUNTDOWN_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(autoFireTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const mm = Math.floor(remaining / 60);
  const ss = (remaining % 60).toString().padStart(2, "0");
  const timerText = `${mm}:${ss}`;

  return (
    <Pressable
      onPress={fire}
      style={({ pressed }) => [
        styles.actionButton,
        styles.primaryButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Animated.View style={[styles.primaryFill, fillStyle]} pointerEvents="none" />
      <Text size="md" weight="semiBold" color="#FFFFFF">
        Confirm ({timerText})
      </Text>
    </Pressable>
  );
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
    gap: 14,
    paddingVertical: 14,
  },
  iconSlot: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginLeft: 38,
  },
  actionColumn: {
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#5299FE",
    overflow: "hidden",
  },
  primaryFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#3E7FE0",
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

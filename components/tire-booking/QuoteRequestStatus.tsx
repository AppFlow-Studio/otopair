/**
 * QuoteRequestStatus
 *
 * PURPOSE: Sheet body shown on the `(tire-booking)/requesting` route while
 *          the user waits for shops to respond with firm quotes. Mirrors
 *          Uber Eats' "Placing order…" sheet: title + ETA row + vehicle row +
 *          tires row + cancel link. Reads directly from the tire and vehicle
 *          stores so the parent route stays thin.
 *
 * USED IN: app/(tire-booking)/requesting.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Car, Clock, Disc3 } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { TIRE_TIERS, TIRE_TYPES } from "@/constants/tireFlow";
import { useTireBookingStore } from "@/stores/useTireBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// HELPERS
// ============================================================================

/** Formats a Date as "h:mm AM/PM" (e.g. 2:05 PM). */
function formatClock(d: Date): string {
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${hours12}:${mm} ${suffix}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
  /** Navigate to the Upcoming tab in bookings. Request continues running. */
  onViewUpcoming: () => void;
  /** Dismiss this sheet and return to the tire config page. Request continues. */
  onGoBack: () => void;
  /** VIN captured when this quote request started. */
  vehicleVin: string | null;
}

export function QuoteRequestStatus({ onViewUpcoming, onGoBack, vehicleVin }: Props) {
  // Tire + vehicle selections — subscribed so the sheet reflects the request
  // that was just submitted.
  const tireSize = useTireBookingStore((s) => s.tireSize);
  const tireType = useTireBookingStore((s) => s.tireType);
  const tier = useTireBookingStore((s) => s.tier);
  const selectedCount = useTireBookingStore((s) => s.selectedTirePositions.length);
  const requestVehicle = useVehicleStore((s) =>
    vehicleVin ? s.vehicles[vehicleVin] : undefined,
  );

  // Pin the ETA range on mount. Window: 5–10 min from submit.
  const etaLabel = useMemo(() => {
    const now = Date.now();
    const start = new Date(now + 5 * 60 * 1000);
    const end = new Date(now + 10 * 60 * 1000);
    return `${formatClock(start)} – ${formatClock(end)}`;
  }, []);

  const vehicleLabel = requestVehicle
    ? `${requestVehicle.year} ${requestVehicle.make} ${requestVehicle.model}`
    : "Selected vehicle";

  const tierLabel = TIRE_TIERS.find((t) => t.id === tier)?.label ?? "";
  const typeLabel = TIRE_TYPES.find((t) => t.id === tireType)?.label ?? "";
  const tierAndType = [tierLabel, typeLabel].filter(Boolean).join(" ");
  const countLabel = selectedCount > 0 ? `${selectedCount} ${tierAndType || "tires"}` : tierAndType || "Tires";
  const tiresLabel = [countLabel, tireSize || undefined].filter(Boolean).join(" · ");

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
          secondary={requestVehicle?.vin ? `VIN · ${requestVehicle.vin}` : undefined}
        />
        <Divider />
        <InfoRow
          icon={<Disc3 size={20} color="#4B5563" strokeWidth={2} />}
          primary={tiresLabel}
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

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

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

// ============================================================================
// CONFIRM COUNTDOWN BUTTON — primary CTA on the requesting sheet.
// ============================================================================

const COUNTDOWN_SECONDS = 7;

/**
 * Uber-Eats-style "Confirm (0:07)" button. Counts down from 7s with a
 * darker-blue progress fill; auto-fires `onConfirm` when it reaches 0. The
 * user can tap at any time to confirm instantly. The timer is cancelled if
 * the button unmounts (e.g. via the Go back secondary).
 */
export function ConfirmCountdownButton({
  onConfirm,
  compact = false,
  label = "Confirm",
}: {
  onConfirm: () => void;
  compact?: boolean;
  label?: string;
}) {
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

    // Tick the label every second. Pure updater — no side effects here.
    const interval = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    // Auto-confirm via a separate timer so the navigation side-effect (which
    // triggers setState on the router) never runs inside a setRemaining
    // updater. Avoids React's "cannot update while rendering" warning.
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
        compact && styles.actionButtonCompact,
        styles.primaryButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Animated.View style={[styles.primaryFill, fillStyle]} pointerEvents="none" />
      <Text size={compact ? "sm" : "md"} weight="semiBold" color="#FFFFFF">
        {label} ({timerText})
      </Text>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
    marginLeft: 38, // aligned with text, not icon
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
  actionButtonCompact: {
    height: 46,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: "#5299FE",
    overflow: "hidden", // clip the animated countdown fill to the radius
  },
  primaryFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    // Darker OtoPair blue — subtly visible against the #5299FE base so the
    // countdown progress reads without shouting.
    backgroundColor: "#3E7FE0",
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

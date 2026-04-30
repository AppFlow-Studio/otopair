/**
 * QuoteRequestConfirmationSheet
 *
 * PURPOSE: One-shot "your quote request has been sent" confirmation sheet
 *          that auto-opens on the Upcoming tab when the user arrives from
 *          the tire-requesting flow. Celebrates the submit, tells the user
 *          what happens next, and offers a single primary CTA to dismiss
 *          back to the Upcoming list (where their Pending Quote card waits).
 *
 *          Reads tire + vehicle state directly from the stores so it always
 *          reflects the submission that just happened — no props required
 *          for content.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Bell, Car, Check, CircleDashed, Timer } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { TIRE_TIERS, TIRE_TYPES } from "@/constants/tireFlow";
import { useTireBookingStore } from "@/stores/useTireBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// HELPERS
// ============================================================================

/** Formats a Date as "h:mm AM/PM" (e.g. 8:42 PM). */
function formatClock(d: Date): string {
  const h24 = d.getHours();
  const m = d.getMinutes();
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

// ============================================================================
// REF API
// ============================================================================

export interface QuoteRequestConfirmationSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  /** Called when the user taps the primary "View booking" CTA. */
  onViewBooking: () => void;
  /** Called after the sheet finishes its close animation (swipe or CTA). */
  onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const QuoteRequestConfirmationSheet = forwardRef<QuoteRequestConfirmationSheetRef, Props>(
  ({ onViewBooking, onClose }, ref) => {
    const insets = useSafeAreaInsets();

    // Plain full-screen <Modal> with native slide animation — no FloatingSheet
    // chrome (no side insets, no bottom float, no rounded corners). Content
    // fills the entire viewport, overlaying the tab bar and status bar.
    const [modalVisible, setModalVisible] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setModalVisible(true),
      close: () => {
        setModalVisible(false);
        onClose?.();
      },
    }));

    const handleRequestClose = () => {
      setModalVisible(false);
      onClose?.();
    };

    // Subscribed reads so the sheet reflects whatever the user just submitted.
    const tireSize = useTireBookingStore((s) => s.tireSize);
    const tireType = useTireBookingStore((s) => s.tireType);
    const tier = useTireBookingStore((s) => s.tier);
    const selectedCount = useTireBookingStore((s) => s.selectedTirePositions.length);
    const selectedVehicle = useVehicleStore((s) =>
      s.selectedVehicleId ? s.vehicles[s.selectedVehicleId] : undefined,
    );

    // Pin the ETA range on mount so it doesn't drift while the sheet is open.
    // Window: 5–10 min from the moment this sheet was mounted.
    const etaLabel = useMemo(() => {
      const now = Date.now();
      const start = new Date(now + 5 * 60 * 1000);
      const end = new Date(now + 10 * 60 * 1000);
      return `${formatClock(start)} – ${formatClock(end)}`;
    }, []);

    const vehicleLabel = selectedVehicle
      ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
      : "Your vehicle";
    const tierLabel = TIRE_TIERS.find((t) => t.id === tier)?.label ?? "";
    const typeLabel = TIRE_TYPES.find((t) => t.id === tireType)?.label ?? "";
    const tiresLabel = [
      selectedCount > 0 ? `${selectedCount} ${[tierLabel, typeLabel].filter(Boolean).join(" ") || "tires"}` : [tierLabel, typeLabel].filter(Boolean).join(" "),
      tireSize || undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    const handleViewBooking = () => {
      onViewBooking();
    };

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={handleRequestClose}
      >
      <View style={styles.fullScreen}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Success badge */}
          <View style={styles.badgeWrap}>
            <View style={styles.badgeOuter}>
              <View style={styles.badgeInner}>
                <Check size={34} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
          </View>

          {/* Headline */}
          <Text size="xl" weight="bold" color="#1A1A1A" center style={styles.title}>
            Quote requests sent
          </Text>
          <Text size="md" weight="regular" color="#6B7280" center style={styles.subtitle}>
            Partner shops near you are reviewing your request.
          </Text>

          {/* What to expect */}
          <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
            WHAT TO EXPECT
          </Text>
          <View style={styles.card}>
            <ExpectRow
              icon={<Timer size={20} color="#5299FE" strokeWidth={2} />}
              primary="Quotes usually arrive in 5–10 minutes"
              secondary={`Estimated by ${etaLabel}`}
            />
            <RowDivider />
            <ExpectRow
              icon={<Bell size={20} color="#5299FE" strokeWidth={2} />}
              primary="We'll notify you when quotes are in"
              secondary="Push notification + email"
            />
            <RowDivider />
            <ExpectRow
              icon={<CircleDashed size={20} color="#5299FE" strokeWidth={2} />}
              primary="Pick the shop you like best"
              secondary="Compare price and availability side by side"
            />
          </View>

          {/* Your request */}
          <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
            YOUR REQUEST
          </Text>
          <View style={styles.card}>
            <SummaryRow
              icon={<Car size={20} color="#4B5563" strokeWidth={2} />}
              label="Vehicle"
              value={vehicleLabel}
            />
            <RowDivider />
            <SummaryRow
              icon={<CircleDashed size={20} color="#4B5563" strokeWidth={2} />}
              label="Tires"
              value={tiresLabel || "Tires"}
            />
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handleViewBooking}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text size="md" weight="semiBold" color="#FFFFFF">
              View booking
            </Text>
          </Pressable>
        </View>
      </View>
      </Modal>
    );
  },
);

QuoteRequestConfirmationSheet.displayName = "QuoteRequestConfirmationSheet";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ExpectRow({
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
        <Text size="md" weight="semiBold" color="#1A1A1A">
          {primary}
        </Text>
        {secondary ? (
          <Text size="sm" weight="regular" color="#6B7280" style={styles.rowSecondary}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>{icon}</View>
      <View style={styles.rowText}>
        <Text size="xs" weight="semiBold" color="#8E8E93" style={styles.summaryLabel}>
          {label.toUpperCase()}
        </Text>
        <Text size="md" weight="semiBold" color="#1A1A1A">
          {value}
        </Text>
      </View>
    </View>
  );
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Modal content — true full-screen (no corners, no insets, goes under the
  // status bar and over the tab bar).
  fullScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100, // clearance for the sticky CTA
  },

  // Success badge
  badgeWrap: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  badgeOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(82,153,254,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },

  // Headline
  title: {
    marginBottom: 6,
  },
  subtitle: {
    marginBottom: 16,
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Section label
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 10,
  },

  // Card
  card: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
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
  rowSecondary: {
    marginTop: 2,
    lineHeight: 18,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginLeft: 50, // aligned with text, not icon
  },
  summaryLabel: {
    letterSpacing: 1,
    marginBottom: 2,
  },

  // Sticky CTA
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    // paddingBottom overridden per-device via insets.bottom in the component.
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F0F0F0",
  },
  cta: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: {
    opacity: 0.9,
  },
});

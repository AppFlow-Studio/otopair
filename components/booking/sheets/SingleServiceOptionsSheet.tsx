/**
 * SingleServiceOptionsSheet
 *
 * Per-service option picker shown when the user taps a service with
 * has_options=true (e.g. Brake Pad Replacement → Front/Rear/Both,
 * Tire Rotation → All 4 / Front 2 / Rear 2, Battery → Standard/AGM/EFB).
 *
 * Mirrors the Tire Replacement modal pattern: full-screen slide-up Modal
 * that resolves the picker before the service is added to the cart.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMutation, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ServiceOptionItem } from "@/hooks/useServiceOptionsForSelected";
import { useVehicleStore } from "@/stores/useVehicleStore";

// Pipeline writes `battery_type` as one of "AGM" | "flooded" | "EFB" |
// "lithium-ion" (convex/vehicleEnrichment/prompts/batch1bPrompt.ts:108).
// Map those values to the option_label strings seeded in
// convex/seed_services_catalog.ts so we can pre-select the matching row.
// "lithium-ion" is intentionally absent — no matching option exists yet, so
// those vehicles fall through to manual selection.
const BATTERY_TYPE_TO_OPTION_LABEL: Record<string, string> = {
  flooded: "Standard (flooded)",
  AGM: "AGM",
  EFB: "EFB",
};

// Reverse map — used on confirm to persist the customer's pick back into
// vehicle_owner_specs.battery.type using the enrichment vocabulary, so
// next time we read it we round-trip cleanly.
const OPTION_LABEL_TO_BATTERY_TYPE: Record<string, string> = {
  "Standard (flooded)": "flooded",
  AGM: "AGM",
  EFB: "EFB",
};

interface SingleServiceOptionsSheetProps {
  visible: boolean;
  serviceId: string | null;
  serviceName: string;
  onClose: () => void;
  onConfirm: (option: ServiceOptionItem) => void;
}

function formatOptionType(optionType: string): string {
  const label = optionType.replace(/_/g, " ");
  return `Select ${label}`;
}

export function SingleServiceOptionsSheet({
  visible,
  serviceId,
  serviceName,
  onClose,
  onConfirm,
}: SingleServiceOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const raw = useQuery(
    api.service_options.getByServiceIds,
    serviceId ? { serviceIds: [serviceId as Id<"services">] } : "skip",
  );

  const options = (raw?.[0]?.options ?? []) as unknown as ServiceOptionItem[];
  const optionType = options[0]?.option_type ?? "";

  // Battery flow: pre-fill priority is (1) the customer's prior confirmed
  // choice on this car (vehicle_owner_specs.battery.type), then (2) the
  // enrichment-derived battery_type on the chassis (trim_specs today —
  // pipeline dual-writes to chassis_specs per v3pipeline.ts:745 + :783, so
  // once trim_specs is retired we can swap the spec source).
  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);
  const selectedVehicle = getSelectedVehicle();
  const isBatteryFlow = optionType === "battery_type";

  const ownerSpecBattery = useQuery(
    api.serviceParts.getOwnerSpecBattery,
    isBatteryFlow && selectedVehicle?.ownershipId
      ? { vehicleOwnerId: selectedVehicle.ownershipId as Id<"vehicle_owners"> }
      : "skip",
  );
  const specPack = useQuery(
    api.specs.getFullVehicleSpecPack,
    isBatteryFlow && selectedVehicle?.vin ? { vin: selectedVehicle.vin } : "skip",
  );

  const prefill = useMemo<{ optionId: string; source: "customer" | "spec" } | null>(() => {
    if (!isBatteryFlow || options.length === 0) return null;
    const customerValue = ownerSpecBattery?.type ?? null;
    const specValue =
      (specPack?.specs?.trim as { battery_type?: string } | null | undefined)?.battery_type ?? null;
    const resolve = (value: string | null) => {
      if (!value) return null;
      const targetLabel = BATTERY_TYPE_TO_OPTION_LABEL[value];
      if (!targetLabel) return null;
      return options.find((o) => o.option_label === targetLabel)?._id ?? null;
    };
    const customerOptionId = resolve(customerValue);
    if (customerOptionId) return { optionId: customerOptionId, source: "customer" };
    const specOptionId = resolve(specValue);
    if (specOptionId) return { optionId: specOptionId, source: "spec" };
    return null;
  }, [isBatteryFlow, options, ownerSpecBattery, specPack]);
  const prefillOptionId = prefill?.optionId ?? null;

  // Reset selection each time the sheet opens for a fresh service.
  useEffect(() => {
    if (visible) setSelectedId(null);
  }, [visible, serviceId]);

  // Pre-select from the vehicle's enrichment-derived battery_type once the
  // spec query lands. Runs only when nothing is selected, so a manual choice
  // made while the query was in flight isn't clobbered.
  useEffect(() => {
    if (visible && prefillOptionId && selectedId == null) {
      setSelectedId(prefillOptionId);
    }
  }, [visible, prefillOptionId, selectedId]);

  // Persist the customer's confirmed battery chemistry back to
  // vehicle_owner_specs so future bookings + the rest of the app treat it
  // as the truth ahead of the OEM spec. Fire-and-forget — we never block
  // the cart on the write, but we do log failures for diagnostics.
  const recordBatteryType = useMutation(api.serviceParts.recordBatteryType);

  const handleConfirm = () => {
    const picked = options.find((o) => o._id === selectedId);
    if (!picked) return;
    if (isBatteryFlow && selectedVehicle?.ownershipId) {
      const enrichmentValue = OPTION_LABEL_TO_BATTERY_TYPE[picked.option_label];
      const alreadyOnRecord = ownerSpecBattery?.type === enrichmentValue;
      if (enrichmentValue && !alreadyOnRecord) {
        void recordBatteryType({
          vehicleOwnerId: selectedVehicle.ownershipId as Id<"vehicle_owners">,
          battery_type: enrichmentValue,
          source: "user",
        }).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[battery persist] failed", e);
        });
      }
    }
    onConfirm(picked);
  };

  const isLoading = raw === undefined && serviceId != null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} hitSlop={8}>
            <ChevronLeft size={24} color={BrandColors.primary} />
          </Pressable>
          <Text size="xl" weight="bold" color={BrandColors.primary}>
            Option Selection
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text size="lg" weight="bold" color={BrandColors.primary}>
            {serviceName}
          </Text>
          <Text size="sm" weight="medium" color="#6B7280" style={styles.optionTypeLabel}>
            {isLoading ? "Loading options..." : formatOptionType(optionType)}
          </Text>

          {prefill ? (
            <Text size="xs" weight="regular" color="#6B7280" style={styles.prefillNote}>
              {prefill.source === "customer"
                ? "Pre-selected from what you confirmed last time. Change it if you've swapped batteries since."
                : "Pre-selected based on your vehicle's spec — change if your shop installed a different chemistry."}
            </Text>
          ) : null}

          <View style={styles.optionsContainer}>
            {options.map((option) => {
              const isSelected = selectedId === option._id;
              return (
                <Pressable
                  key={option._id}
                  onPress={() => setSelectedId(option._id)}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                >
                  <View style={styles.optionContent}>
                    <Text
                      size="md"
                      weight={isSelected ? "semiBold" : "regular"}
                      color={BrandColors.primary}
                    >
                      {option.option_label}
                    </Text>
                  </View>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity
            style={[styles.confirmButton, !selectedId && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedId}
            activeOpacity={0.85}
          >
            <Text size="md" weight="bold" color={BrandColors.white}>
              Add to cart
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 36 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing["2xl"],
  },
  optionTypeLabel: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  prefillNote: {
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  optionsContainer: { gap: Spacing.sm },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
  },
  optionContent: { flex: 1, marginRight: Spacing.md },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: BrandColors.secondary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.secondary,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
  confirmButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full ?? 100,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: { opacity: 0.4 },
});

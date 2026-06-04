/**
 * Rotor Booking · Shop Rotors screen
 *
 * Spec: docs/rotor-booking/SPEC_v1.pdf (June 2026). Four selection fields:
 *   1. Brake system type (Standard / Sport / Carbon ceramic) — pre-selected
 *      from OEM data via useBrakeSystemTypeFromConvex
 *   2. Axle (Front pair / Rear pair / All four) — diagram + pills
 *   3. Include brake pads? Yes/No (default Yes)
 *   4. Pad type (Ceramic / Semi-metallic / OEM recommended) — conditional
 *
 * "Find Available Rotors" fires the existing request → broadcast → response
 * pipeline; this screen is purely about the selection inputs.
 */

import { useFocusEffect, useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import { Car, Check, ChevronLeft, ListFilter } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RotorRequestingScreen from "@/app/(rotor-booking)/requesting";
import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BrakeSystemCard } from "@/components/rotor-booking/BrakeSystemCard";
import { IncludePadsRow } from "@/components/rotor-booking/IncludePadsRow";
import { PadTypeChips } from "@/components/rotor-booking/PadTypeChips";
import { RotorAxleSelector } from "@/components/rotor-booking/RotorAxleSelector";
import {
  ROTOR_AXLE_OPTIONS,
  quantityForAxle,
  type RotorAxle,
} from "@/constants/rotorFlow";
import { useBrakeSystemTypeFromConvex } from "@/hooks/useBrakeSystemTypeFromConvex";
import { useRotorBookingStore } from "@/stores/useRotorBookingStore";
import { useVehicleStore, type Vehicle } from "@/stores/useVehicleStore";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface RotorBookingScreenProps {
  onClose?: () => void;
  onConfirmed?: () => void;
}

export default function RotorBookingScreen({ onClose, onConfirmed }: RotorBookingScreenProps = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Vehicle ────────────────────────────────────────────────────────────────
  const vehiclesRecord = useVehicleStore((s) => s.vehicles);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const selectedVehicleId = useVehicleStore((s) => s.selectedVehicleId);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const vehicles = useMemo<Vehicle[]>(
    () => vehicleIds.map((id) => vehiclesRecord[id]).filter(Boolean) as Vehicle[],
    [vehicleIds, vehiclesRecord],
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId),
    [vehicles, selectedVehicleId],
  );
  const canSwitch = vehicles.length > 1;
  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
    : "your vehicle";

  // ── Rotor store ────────────────────────────────────────────────────────────
  const brakeSystemType = useRotorBookingStore((s) => s.brakeSystemType);
  const axle = useRotorBookingStore((s) => s.axle);
  const includePads = useRotorBookingStore((s) => s.includePads);
  const padType = useRotorBookingStore((s) => s.padType);
  const setBrakeSystemType = useRotorBookingStore((s) => s.setBrakeSystemType);
  const setAxle = useRotorBookingStore((s) => s.setAxle);
  const setIncludePads = useRotorBookingStore((s) => s.setIncludePads);
  const setPadType = useRotorBookingStore((s) => s.setPadType);
  const setVehicleIdOnStore = useRotorBookingStore((s) => s.setVehicleId);
  const fireRequest = useRotorBookingStore((s) => s.fireRequest);
  const resetRotorStore = useRotorBookingStore((s) => s.reset);

  useEffect(() => {
    setVehicleIdOnStore(selectedVehicleId);
  }, [selectedVehicleId, setVehicleIdOnStore]);

  // ── OEM brake-system pre-selection ────────────────────────────────────────
  // First render with a known OEM value seeds the store. User overrides win
  // afterward — switching vehicles re-seeds because the effect deps change.
  const { brakeSystemType: oemBrakeSystemType } = useBrakeSystemTypeFromConvex();
  useEffect(() => {
    if (oemBrakeSystemType && !brakeSystemType) {
      setBrakeSystemType(oemBrakeSystemType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oemBrakeSystemType, selectedVehicleId]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const vehiclePickerRef = useRef<FloatingSheetRef>(null);

  // ── Submit spinner ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsSubmitting(false);
    }, []),
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    resetRotorStore();
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  }, [router, resetRotorStore, onClose]);

  const handlePickVehicle = useCallback(
    (id: string) => {
      selectVehicle(id);
      vehiclePickerRef.current?.close();
    },
    [selectVehicle],
  );

  const handleSelectAxle = useCallback(
    (next: RotorAxle | null) => {
      haptics.selection();
      setAxle(next);
    },
    [setAxle],
  );

  // Modal mode: swap to the requesting view inline instead of pushing a new
  // route (router.push from inside the parent Modal doesn't navigate
  // reliably). Route mode keeps the original push-based flow.
  const [showRequestingInline, setShowRequestingInline] = useState(false);

  const handleGetQuotes = useCallback(() => {
    setIsSubmitting(true);
    haptics.cta();
    requestAnimationFrame(() => {
      void fireRequest();
      if (onClose) {
        setIsSubmitting(false);
        setShowRequestingInline(true);
      } else {
        router.push("/(rotor-booking)/requesting");
      }
    });
  }, [fireRequest, router, onClose]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const padsResolved = !includePads || padType != null;
  const ctaDisabled = !brakeSystemType || !axle || !padsResolved;
  const ctaLabel = (() => {
    if (!brakeSystemType) return "Confirm brake system to continue";
    if (!axle) return "Tap an axle to continue";
    if (!padsResolved) return "Pick a pad type";
    return "Find Available Rotors";
  })();

  const counterLabel = (() => {
    if (!axle) return "tap front or rear axle to choose";
    const opt = ROTOR_AXLE_OPTIONS.find((o) => o.id === axle);
    return `${opt?.label ?? ""} · ${opt?.quantity ?? quantityForAxle(axle)} rotors`;
  })();

  if (showRequestingInline && onClose) {
    return <RotorRequestingScreen onClose={onClose} onConfirmed={onConfirmed} />;
  }

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.topBarSlot}>
          <ChevronLeft size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text size="md" weight="semiBold" color="#1A1A1A">
          Shop Rotors
        </Text>
        <View style={styles.topBarSlot} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Vehicle selector chip */}
        <TouchableOpacity
          style={[styles.vehicleChip, !canSwitch && styles.vehicleChipStatic]}
          onPress={() => canSwitch && vehiclePickerRef.current?.open()}
          activeOpacity={canSwitch ? 0.85 : 1}
        >
          <View style={styles.vehicleSide}>
            {selectedVehicle?.imageSource ? (
              <Image
                source={selectedVehicle.imageSource}
                style={styles.vehicleThumbImage}
                resizeMode="contain"
              />
            ) : (
              <Car size={28} color="#9CA3AF" />
            )}
          </View>
          <Text
            size="md"
            weight="bold"
            color="#1A1A1A"
            numberOfLines={1}
            style={styles.vehicleLabel}
          >
            {selectedVehicle
              ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
              : "Select vehicle"}
          </Text>
          <View style={styles.vehicleSide}>
            {canSwitch ? <ListFilter size={16} color="#8E8E93" /> : null}
          </View>
        </TouchableOpacity>

        {/* 3 — Brake system type */}
        <View style={styles.sectionFirst}>
          <BrakeSystemCard
            vehicleLabel={vehicleLabel}
            selected={brakeSystemType}
            onSelect={(next) => {
              haptics.selection();
              setBrakeSystemType(next);
            }}
          />
        </View>

        {/* 4 — Axle diagram */}
        <View style={styles.hero}>
          <RotorAxleSelector selected={axle} onSelect={handleSelectAxle} />
        </View>

        <Text size="sm" weight="regular" color="#8E8E93" center style={styles.counter}>
          {counterLabel}
        </Text>

        {/* 5 — Axle pills */}
        <View style={styles.section}>
          <Text size="sm" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
            AXLE
          </Text>
          <View style={styles.chipRow}>
            {ROTOR_AXLE_OPTIONS.map((opt) => {
              const isSelected = opt.id === axle;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.axleChip, isSelected && styles.axleChipSelected]}
                  onPress={() => handleSelectAxle(opt.id)}
                  activeOpacity={0.85}
                >
                  <Text
                    size="sm"
                    weight={isSelected ? "semiBold" : "medium"}
                    color={isSelected ? "#FFFFFF" : "#1A1A1A"}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 6 — Include pads */}
        <View style={styles.section}>
          <IncludePadsRow value={includePads} onChange={setIncludePads} />
        </View>

        {/* 7 — Pad type (conditional) */}
        {includePads ? (
          <View style={styles.section}>
            <PadTypeChips
              selected={padType}
              onSelect={(next) => {
                haptics.selection();
                setPadType(next);
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.ctaButton, (ctaDisabled || isSubmitting) && styles.ctaButtonDisabled]}
          onPress={handleGetQuotes}
          disabled={ctaDisabled || isSubmitting}
          activeOpacity={0.85}
        >
          <View style={styles.ctaContent}>
            <Text size="md" weight="semiBold" color="#FFFFFF">
              {ctaLabel}
            </Text>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.ctaSpinner} />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      {/* Vehicle picker sheet */}
      <FloatingSheet
        ref={vehiclePickerRef}
        snapHeights={[Math.min(SCREEN_HEIGHT * 0.45, 120 + vehicles.length * 78)]}
        showBackdrop
      >
        <View style={styles.sheetContent}>
          <Text size="lg" weight="bold" color="#1A1A1A" style={styles.sheetTitle}>
            Which vehicle?
          </Text>
          <ScrollView>
            {vehicles.map((v) => {
              const active = v.id === selectedVehicleId;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleRow, active && styles.vehicleRowActive]}
                  onPress={() => handlePickVehicle(v.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.vehicleRowSide}>
                    {v.imageSource ? (
                      <Image
                        source={v.imageSource}
                        style={styles.vehicleRowImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Car size={28} color="#9CA3AF" />
                    )}
                  </View>
                  <View style={styles.vehicleRowText}>
                    <Text size="md" weight="semiBold" color="#1A1A1A">
                      {v.year} {v.make} {v.model}
                    </Text>
                    {v.vin ? (
                      <Text size="xs" weight="regular" color="#8E8E93">
                        VIN · {v.vin}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <View style={styles.checkCircle}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </FloatingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarSlot: {
    width: 40,
  },
  scroll: {
    padding: 20,
    paddingTop: 4,
  },
  vehicleChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  vehicleChipStatic: {
    opacity: 0.95,
  },
  vehicleSide: {
    width: 56,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleThumbImage: {
    width: 56,
    height: 40,
  },
  vehicleLabel: {
    flex: 1,
    textAlign: "center",
  },
  sectionFirst: {
    marginBottom: 8,
  },
  hero: {
    height: 240,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 18,
    marginBottom: 12,
  },
  counter: {
    marginTop: 10,
    marginBottom: 4,
  },
  section: {
    marginTop: 22,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  axleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  axleChipSelected: {
    backgroundColor: "#1A1A1A",
    borderColor: "#1A1A1A",
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  ctaButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaSpinner: {
    marginLeft: 4,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    marginBottom: 12,
    marginLeft: 4,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  vehicleRowActive: {
    backgroundColor: "#EAF2FF",
  },
  vehicleRowSide: {
    width: 56,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleRowImage: {
    width: 56,
    height: 40,
  },
  vehicleRowText: {
    flex: 1,
    gap: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
});

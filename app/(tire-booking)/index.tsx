/**
 * Tire Booking · Single-page flow
 *
 * Consolidates the old 6-screen flow into one dynamic page. Hero is a 3D
 * vehicle where the user taps tires to pick which to replace (1–4). Type +
 * Tier live as chip/card rows below. Get Quotes opens a FloatingSheet with
 * mocked shop quotes; accepting one drops a "Pending Quote" booking into
 * the Upcoming tab.
 */

import { useFocusEffect, useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import {
  Car,
  Check,
  ChevronLeft,
  Info,
  ListFilter,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Chip, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TierInfoSheet, type TierInfoSheetRef } from "@/components/tire-booking/TierInfoSheet";
import { VehicleTireSelector3D } from "@/components/tire-booking/VehicleTireSelector3D";
import TireRequestingScreen from "@/app/(tire-booking)/requesting";
import {
  DEFAULT_OEM_SIZES,
  MOCK_OEM_SIZES_BY_MAKE,
  TIRE_TIERS,
  TIRE_TYPES,
  type TireTierId,
  type TireTierOption,
  type TireTypeId,
} from "@/constants/tireFlow";
import { useTireBookingStore, type TirePosition } from "@/stores/useTireBookingStore";
import { useVehicleStore, type Vehicle } from "@/stores/useVehicleStore";

type TireSizeOption = {
  size: string;
  source: "verified" | "oem_default" | null;
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// SCREEN
// ============================================================================

interface TireBookingScreenProps {
  /** When provided, the back chevron calls this instead of router.back().
   *  Used when this screen is embedded as a Modal from
   *  ServiceBottomSheet (router.push to (tire-booking) wasn't
   *  navigating reliably from inside the sheet, so we embed instead). */
  onClose?: () => void;
  /** Bubbled up to TireRequestingScreen so the parent (which lives in
   *  the real screen tree, not inside the Modal) handles the booking
   *  confirmation + navigation. */
  onConfirmed?: () => void;
}

export default function TireBookingScreen({ onClose, onConfirmed }: TireBookingScreenProps = {}) {
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

  // ── Tire store ─────────────────────────────────────────────────────────────
  const tireSize = useTireBookingStore((s) => s.tireSize);
  const tireType = useTireBookingStore((s) => s.tireType);
  const tier = useTireBookingStore((s) => s.tier);
  const selectedTirePositions = useTireBookingStore((s) => s.selectedTirePositions);
  const setTireSize = useTireBookingStore((s) => s.setSize);
  const setType = useTireBookingStore((s) => s.setType);
  const setTier = useTireBookingStore((s) => s.setTier);
  const setVehicleIdOnStore = useTireBookingStore((s) => s.setVehicleId);
  const toggleTirePosition = useTireBookingStore((s) => s.toggleTirePosition);
  const fireRequest = useTireBookingStore((s) => s.fireRequest);
  const resetTireStore = useTireBookingStore((s) => s.reset);

  // Real per-vehicle tire options from Convex: verified passport sizes first,
  // then OEM defaults from trim_specs. Falls back to the static mock list
  // (`MOCK_OEM_SIZES_BY_MAKE`) only when unauthenticated, offline, or VIN
  // missing — so demo / pre-onboarding flows still work.
  const tireOptions = useQuery(
    api.vehicles.getTireOptionsForVehicle,
    selectedVehicle?.vin ? { vin: selectedVehicle.vin } : "skip",
  );
  const sizeOptions = useMemo<TireSizeOption[]>(() => {
    if (tireOptions && tireOptions.sizes.length > 0) {
      return tireOptions.sizes;
    }
    const make = selectedVehicle?.make;
    const fallback =
      make && MOCK_OEM_SIZES_BY_MAKE[make]
        ? MOCK_OEM_SIZES_BY_MAKE[make]
        : DEFAULT_OEM_SIZES;
    return fallback.map((size) => ({ size, source: null }));
  }, [tireOptions, selectedVehicle?.make]);
  const sizes = useMemo<string[]>(
    () => sizeOptions.map((option) => option.size),
    [sizeOptions],
  );

  // If the current tireSize doesn't belong to the newly selected vehicle's
  // OEM list (e.g. user switched cars mid-flow), clear it so the chips show
  // as nothing-selected instead of lying. When there's exactly one known
  // size (e.g. passport says 225/65R17 front+rear and trim_specs agrees)
  // pre-select it so the user sees a chosen chip and the CTA unlocks.
  React.useEffect(() => {
    if (tireSize && !sizes.includes(tireSize)) {
      setTireSize("");
      return;
    }
    if (!tireSize && sizes.length === 1) {
      setTireSize(sizes[0]);
    }
  }, [sizes, tireSize, setTireSize]);

  // Sync tire store's vehicleId with the user-selected vehicle.
  React.useEffect(() => {
    setVehicleIdOnStore(selectedVehicleId);
  }, [selectedVehicleId, setVehicleIdOnStore]);

  // ── Refs for sheets ────────────────────────────────────────────────────────
  const vehiclePickerRef = useRef<FloatingSheetRef>(null);
  const tierInfoRef = useRef<TierInfoSheetRef>(null);

  // Submit spinner state — flips true the moment Get Quotes is tapped so the
  // button shows a spinner while the requesting route mounts (the tire-grid
  // SVG + sheet open take ~200–400ms). Reset when this screen regains focus
  // (i.e. the user pressed Go back from requesting).
  const [isSubmitting, setIsSubmitting] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsSubmitting(false);
    }, []),
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    resetTireStore();
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  }, [router, resetTireStore, onClose]);

  const handlePickVehicle = useCallback(
    (id: string) => {
      selectVehicle(id);
      vehiclePickerRef.current?.close();
    },
    [selectVehicle],
  );

  // Haptic fires here in the parent so the diagram component stays untouched.
  const handleToggleTire = useCallback(
    (p: TirePosition) => {
      haptics.selection();
      toggleTirePosition(p);
    },
    [toggleTirePosition],
  );

  // Modal mode: swap to the requesting view inline instead of pushing a
  // new route (router.push from inside the parent Modal doesn't navigate
  // reliably). Route mode keeps the original push-based flow.
  const [showRequestingInline, setShowRequestingInline] = useState(false);

  const handleGetQuotes = useCallback(() => {
    setIsSubmitting(true);
    haptics.cta();
    requestAnimationFrame(() => {
      void fireRequest();
      if (onClose) {
        // Modal mode — render requesting inline. Reset spinner so it
        // doesn't visually hang on the now-hidden config screen.
        setIsSubmitting(false);
        setShowRequestingInline(true);
      } else {
        router.push("/(tire-booking)/requesting");
      }
    });
  }, [fireRequest, router, onClose]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCount = selectedTirePositions.length;
  // Render the SIZE section whenever there's at least one known size so the
  // user can see the Verified/OEM-default provenance pill — not just when
  // we're asking them to disambiguate between multiple OEM options.
  const showSizeSection = sizes.length >= 1;
  const sizeChosen = !!tireSize && sizes.includes(tireSize);

  const ctaDisabled =
    selectedCount === 0 ||
    !tireType ||
    !tier ||
    (showSizeSection && !sizeChosen);

  const ctaLabel = (() => {
    if (selectedCount === 0) return "Tap a wheel to continue";
    if (showSizeSection && !sizeChosen) return "Select a tire size";
    if (!tireType) return "Select a tire type";
    if (!tier) return "Select a tier";
    // Pricing is deferred to shop responses (post Apr 23 redesign), so the
    // enabled CTA is a plain action label rather than a price-range preview.
    return "Get Quotes";
  })();

  // Modal mode after Get Quotes: render the requesting screen inline.
  if (showRequestingInline && onClose) {
    return <TireRequestingScreen onClose={onClose} onConfirmed={onConfirmed} />;
  }

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.topBarSlot}>
          <ChevronLeft size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text size="md" weight="semiBold" color="#1A1A1A">
          Shop Tires
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

        {/* 3D hero */}
        <View style={styles.hero}>
          <VehicleTireSelector3D
            selected={selectedTirePositions}
            onTogglePosition={handleToggleTire}
          />
        </View>

        <Text size="sm" weight="regular" color="#8E8E93" center style={styles.counter}>
          {selectedCount} of 4 tires selected · tap a wheel to toggle
        </Text>

        {/* Size section (only if multiple OEM sizes) */}
        {showSizeSection ? (
          <View style={styles.section}>
            <Text size="sm" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
              SIZE
            </Text>
            <View style={styles.chipRow}>
              {sizeOptions.map((option) => (
                <View key={option.size} style={styles.chipWithCaption}>
                  <Chip
                    label={option.size}
                    selected={option.size === tireSize}
                    onPress={() => setTireSize(option.size)}
                  />
                  {option.source ? (
                    <View
                      style={[
                        styles.sourcePill,
                        option.source === "verified"
                          ? styles.sourcePillVerified
                          : styles.sourcePillOem,
                      ]}
                    >
                      <Text
                        size="xs"
                        weight="semiBold"
                        color={option.source === "verified" ? "#0A8754" : "#6B7280"}
                      >
                        {option.source === "verified" ? "Mechanic Verified" : "OEM default"}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Type section */}
        <View style={styles.section}>
          <Text size="sm" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
            TYPE
          </Text>
          <View style={styles.chipRow}>
            {TIRE_TYPES.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                selected={t.id === tireType}
                onPress={() => setType(t.id as TireTypeId)}
              />
            ))}
          </View>
        </View>

        {/* Tier section */}
        <View style={styles.section}>
          <Text size="sm" weight="semiBold" color="#8E8E93" style={styles.sectionLabel}>
            QUALITY TIER
          </Text>
          <Text size="xs" weight="regular" style={styles.sectionCaption}>
            How long the tires last before needing replacement
          </Text>
          <View style={styles.tierList}>
            {TIRE_TIERS.map((t) => (
              <TierCard
                key={t.id}
                tier={t}
                selected={t.id === tier}
                onSelect={() => setTier(t.id as TireTierId)}
                onInfo={() => tierInfoRef.current?.open(t.id as TireTierId)}
              />
            ))}
          </View>
        </View>
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
                      <Image source={v.imageSource} style={styles.vehicleRowImage} resizeMode="contain" />
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

      {/* Results sheet removed — the "request in progress" surface is now
          the dedicated `(tire-booking)/requesting` route (Lottie background
          + FloatingSheet). Firm quotes arrive asynchronously via the Quotes
          tab + notifications; not shown from this screen. */}

      {/* Tier info sheet — opened from the (i) icon on each tier card */}
      <TierInfoSheet ref={tierInfoRef} />
    </View>
  );
}

// ============================================================================
// TIER CARD — own shared value so the 150ms scale pulse is per-card
// ============================================================================

function TierCard({
  tier,
  selected,
  onSelect,
  onInfo,
}: {
  tier: TireTierOption;
  selected: boolean;
  onSelect: () => void;
  onInfo: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.98, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
    );
    onSelect();
  }, [onSelect, scale]);

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[styles.tierCard, selected && styles.tierCardSelected]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.tierHeader}>
          <View style={styles.tierLabelRow}>
            <Text size="sm" weight="semiBold" color="#1A1A1A">
              {tier.label}
            </Text>
            <TouchableOpacity
              onPress={onInfo}
              hitSlop={10}
              style={styles.tierInfoButton}
              accessibilityRole="button"
              accessibilityLabel={`Learn more about ${tier.label}`}
            >
              <Info size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <View style={[styles.radio, selected && styles.radioActive]}>
            {selected ? <Check size={12} color="#FFFFFF" /> : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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

  hero: {
    height: 240,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },

  counter: {
    marginTop: 10,
    marginBottom: 4,
  },

  section: {
    marginTop: 24,
  },
  sectionLabel: {
    letterSpacing: 1,
  },
  sectionCaption: {
    color: "rgba(0,0,0,0.5)",
    marginTop: 4,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chipWithCaption: {
    alignItems: "center",
    gap: 4,
  },
  sourcePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourcePillVerified: {
    backgroundColor: "rgba(10,135,84,0.08)",
    borderColor: "rgba(10,135,84,0.25)",
  },
  sourcePillOem: {
    backgroundColor: "rgba(107,114,128,0.08)",
    borderColor: "rgba(107,114,128,0.25)",
  },

  tierList: {
    gap: 10,
    marginTop: 10,
  },
  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  tierCardSelected: {
    borderWidth: 1.5,
    borderColor: "#5299FE",
    backgroundColor: "rgba(82,153,254,0.04)",
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tierInfoButton: {
    padding: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  ctaButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ctaSpinner: {
    marginLeft: 2,
  },
  ctaButtonDisabled: {
    opacity: 0.4,
  },

  // Sheet shared
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    marginBottom: 14,
  },

  // Vehicle picker sheet
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    marginBottom: 10,
  },
  vehicleRowActive: {
    borderColor: "#5299FE",
    borderWidth: 2,
    backgroundColor: "#F5F9FF",
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },

});

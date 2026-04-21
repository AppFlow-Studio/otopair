/**
 * Tire Booking · Single-page flow
 *
 * Consolidates the old 6-screen flow into one dynamic page. Hero is a 3D
 * vehicle where the user taps tires to pick which to replace (1–4). Type +
 * Tier live as chip/card rows below. Get Quotes opens a FloatingSheet with
 * mocked shop quotes; accepting one drops a "Pending Quote" booking into
 * the Upcoming tab.
 */

import { useRouter } from "expo-router";
import {
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TireQuoteCard } from "@/components/tire-booking/TireQuoteCard";
import { VehicleTireSelector3D } from "@/components/tire-booking/VehicleTireSelector3D";
import {
  DEFAULT_OEM_SIZES,
  MOCK_OEM_SIZES_BY_MAKE,
  TIRE_TIERS,
  TIRE_TYPES,
  type TireQuote,
  type TireTierId,
  type TireTypeId,
} from "@/constants/tireFlow";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import { useTireBookingStore, type TirePosition } from "@/stores/useTireBookingStore";
import { useVehicleStore, type Vehicle } from "@/stores/useVehicleStore";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const TIRE_INSTALL_SERVICE_ID = "tire_install_from_flow";

// ============================================================================
// SCREEN
// ============================================================================

export default function TireBookingScreen() {
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
  const isLoading = useTireBookingStore((s) => s.isLoading);
  const quotes = useTireBookingStore((s) => s.quotes);
  const setTireSize = useTireBookingStore((s) => s.setSize);
  const setType = useTireBookingStore((s) => s.setType);
  const setTier = useTireBookingStore((s) => s.setTier);
  const setVehicleIdOnStore = useTireBookingStore((s) => s.setVehicleId);
  const toggleTirePosition = useTireBookingStore((s) => s.toggleTirePosition);
  const setTirePositions = useTireBookingStore((s) => s.setTirePositions);
  const fireRequest = useTireBookingStore((s) => s.fireRequest);
  const acceptQuote = useTireBookingStore((s) => s.acceptQuote);
  const resetTireStore = useTireBookingStore((s) => s.reset);

  // OEM sizes for current vehicle
  const sizes = useMemo<string[]>(() => {
    const make = selectedVehicle?.make;
    if (make && MOCK_OEM_SIZES_BY_MAKE[make]) {
      return MOCK_OEM_SIZES_BY_MAKE[make];
    }
    return DEFAULT_OEM_SIZES;
  }, [selectedVehicle?.make]);

  // Keep tireSize in sync with the current vehicle's sizes.
  React.useEffect(() => {
    if (!sizes.length) return;
    if (!tireSize || !sizes.includes(tireSize)) {
      setTireSize(sizes[0]);
    }
  }, [sizes, tireSize, setTireSize]);

  // Sync tire store's vehicleId with the user-selected vehicle.
  React.useEffect(() => {
    setVehicleIdOnStore(selectedVehicleId);
  }, [selectedVehicleId, setVehicleIdOnStore]);

  // ── Refs for sheets ────────────────────────────────────────────────────────
  const vehiclePickerRef = useRef<FloatingSheetRef>(null);
  const resultsSheetRef = useRef<FloatingSheetRef>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    resetTireStore();
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  }, [router, resetTireStore]);

  const handlePickVehicle = useCallback(
    (id: string) => {
      selectVehicle(id);
      vehiclePickerRef.current?.close();
    },
    [selectVehicle],
  );

  const handlePreset = useCallback(
    (preset: "all" | "front" | "rear") => {
      const map: Record<typeof preset, TirePosition[]> = {
        all: ["FL", "FR", "RL", "RR"],
        front: ["FL", "FR"],
        rear: ["RL", "RR"],
      };
      setTirePositions(map[preset]);
    },
    [setTirePositions],
  );

  const handleGetQuotes = useCallback(() => {
    resultsSheetRef.current?.open();
    void fireRequest();
  }, [fireRequest]);

  const handleAcceptQuote = useCallback(
    (quoteId: string) => {
      const quote = acceptQuote(quoteId);
      if (!quote) return;
      synthesizeBooking(quote, selectedVehicleId);
      resetTireStore();
      router.replace("/(main-tabs)/bookings");
    },
    [acceptQuote, selectedVehicleId, router, resetTireStore],
  );

  const handleCloseResults = useCallback(() => {
    resultsSheetRef.current?.close();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCount = selectedTirePositions.length;
  const ctaLabel = selectedCount === 0 ? "Select at least one tire" : `Get Quotes (${selectedCount} tires)`;
  const ctaDisabled = selectedCount === 0;
  const showSizeSection = sizes.length > 1;

  const best = quotes.find((q) => q.isBestMatch) ?? quotes[0];
  const others = quotes.filter((q) => q !== best);

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
          <View style={styles.vehicleThumb}>
            {selectedVehicle?.imageSource ? (
              <Image source={selectedVehicle.imageSource} style={styles.vehicleThumbImage} resizeMode="contain" />
            ) : (
              <Car size={20} color="#9CA3AF" />
            )}
          </View>
          <View style={styles.vehicleText}>
            <Text size="xs" weight="semiBold" color="#8E8E93">
              TIRES FOR
            </Text>
            <Text size="md" weight="bold" color="#1A1A1A" numberOfLines={1}>
              {selectedVehicle
                ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                : "Select vehicle"}
            </Text>
          </View>
          {canSwitch ? <ChevronDown size={18} color="#8E8E93" /> : null}
        </TouchableOpacity>

        {/* 3D hero */}
        <View style={styles.hero}>
          <VehicleTireSelector3D
            selected={selectedTirePositions}
            onTogglePosition={toggleTirePosition}
          />
        </View>

        {/* Preset row */}
        <View style={styles.presetRow}>
          <PresetButton
            label="All 4"
            active={selectedCount === 4}
            onPress={() => handlePreset("all")}
          />
          <PresetButton
            label="Front"
            active={
              selectedCount === 2 &&
              selectedTirePositions.includes("FL") &&
              selectedTirePositions.includes("FR")
            }
            onPress={() => handlePreset("front")}
          />
          <PresetButton
            label="Rear"
            active={
              selectedCount === 2 &&
              selectedTirePositions.includes("RL") &&
              selectedTirePositions.includes("RR")
            }
            onPress={() => handlePreset("rear")}
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
              {sizes.map((size) => {
                const active = size === tireSize;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeChip, active && styles.sizeChipActive]}
                    onPress={() => setTireSize(size)}
                    activeOpacity={0.85}
                  >
                    <Text size="sm" weight="semiBold" color={active ? "#FFFFFF" : "#1A1A1A"}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
              <OptionCard
                key={t.id}
                label={t.label}
                active={t.id === tireType}
                recommended={t.recommended}
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
          <View style={styles.tierList}>
            {TIRE_TIERS.map((t) => {
              const active = t.id === tier;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tierCard, active && styles.tierCardActive]}
                  onPress={() => setTier(t.id as TireTierId)}
                  activeOpacity={0.85}
                >
                  <View style={styles.tierHeader}>
                    <View style={styles.tierTitleRow}>
                      <Text size="md" weight="bold" color="#1A1A1A">
                        {t.label}
                      </Text>
                      {t.recommended ? (
                        <View style={styles.recBadge}>
                          <Text size="xs" weight="bold" color="#2E7D32">
                            RECOMMENDED
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <Check size={12} color="#FFFFFF" /> : null}
                    </View>
                  </View>
                  <Text size="xs" weight="regular" color="#6B7280" style={styles.tierTag}>
                    {t.priceHintPerTire} · {t.warrantyRange}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.ctaButton, ctaDisabled && styles.ctaButtonDisabled]}
          onPress={handleGetQuotes}
          disabled={ctaDisabled}
          activeOpacity={0.85}
        >
          <Text size="md" weight="semiBold" color="#FFFFFF">
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vehicle picker sheet */}
      <FloatingSheet
        ref={vehiclePickerRef}
        snapHeights={[Math.min(SCREEN_HEIGHT * 0.45, 120 + vehicles.length * 78)]}
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
                  <View style={styles.vehicleRowThumb}>
                    {v.imageSource ? (
                      <Image source={v.imageSource} style={styles.vehicleRowImage} resizeMode="contain" />
                    ) : (
                      <Car size={20} color="#9CA3AF" />
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

      {/* Results sheet */}
      <FloatingSheet
        ref={resultsSheetRef}
        snapHeights={[SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT * 0.92]}
      >
        <View style={styles.resultsContent}>
          <Text size="lg" weight="bold" color="#1A1A1A" style={styles.sheetTitle}>
            Your Quotes
          </Text>
          {isLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color="#5299FE" />
              <Text size="md" weight="semiBold" color="#1A1A1A" center style={styles.loadingHead}>
                Finding available tires nearby
              </Text>
              <Text size="sm" weight="regular" color="#6B7280" center style={styles.loadingSub}>
                Checking shops in your area…
              </Text>
            </View>
          ) : quotes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text size="lg" weight="bold" color="#1A1A1A">
                No shops available nearby
              </Text>
              <Text size="sm" weight="regular" color="#6B7280" center style={styles.emptySub}>
                We'll notify you when a partner shop has your tires in stock.
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleCloseResults} activeOpacity={0.85}>
                <Text size="md" weight="semiBold" color="#FFFFFF">
                  Notify me
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.quoteList}>
              <Text size="sm" weight="semiBold" color="#8E8E93" style={styles.resultsLabel}>
                BEST MATCH FOR YOU
              </Text>
              {best ? (
                <TireQuoteCard
                  quote={best}
                  variant="primary"
                  onBook={() => handleAcceptQuote(best.id)}
                />
              ) : null}
              {others.length > 0 ? (
                <>
                  <Text size="sm" weight="semiBold" color="#8E8E93" style={[styles.resultsLabel, styles.resultsLabelTop]}>
                    OTHER OPTIONS
                  </Text>
                  {others.map((q) => (
                    <TireQuoteCard
                      key={q.id}
                      quote={q}
                      variant="secondary"
                      onBook={() => handleAcceptQuote(q.id)}
                    />
                  ))}
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </FloatingSheet>
    </View>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function PresetButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.presetButton, active && styles.presetButtonActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text size="sm" weight="semiBold" color={active ? "#FFFFFF" : "#1A1A1A"}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function OptionCard({
  label,
  active,
  recommended,
  onPress,
}: {
  label: string;
  active: boolean;
  recommended?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, active && styles.optionCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text size="sm" weight="semiBold" color={active ? "#FFFFFF" : "#1A1A1A"} center>
        {label}
      </Text>
      {recommended ? (
        <View style={[styles.recBadgeSmall, active && styles.recBadgeActive]}>
          <Text size="xs" weight="bold" color={active ? "#FFFFFF" : "#2E7D32"}>
            Recommended
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ============================================================================
// BOOKING SYNTHESIS (lifted from old results.tsx)
// ============================================================================

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseAvailability(label: string): { date: string; time: string } {
  const now = new Date();
  const target = new Date(now);
  const lower = label.toLowerCase();

  if (lower.startsWith("tomorrow")) {
    target.setDate(now.getDate() + 1);
  } else {
    const dayMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };
    const prefix = lower.slice(0, 3);
    const dow = dayMap[prefix];
    if (dow != null) {
      const delta = (dow - now.getDay() + 7) % 7 || 7;
      target.setDate(now.getDate() + delta);
    }
  }

  const dateStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  const timePart = label.includes(",") ? label.split(",").slice(1).join(",").trim() : "10:00 AM";
  return { date: dateStr, time: timePart };
}

function synthesizeBooking(quote: TireQuote, vehicleId: string | null) {
  const { date: scheduledDate, time: scheduledTime } = parseAvailability(quote.availability);
  const nowIso = new Date().toISOString();
  const bookingId = `tire_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  useShopStore.setState((prev) => {
    if (prev.shops[quote.shopId]) return prev;
    return {
      shops: {
        ...prev.shops,
        [quote.shopId]: {
          id: quote.shopId,
          name: quote.shopName,
          address: "",
          latitude: 0,
          longitude: 0,
          distanceKm: null,
          rating: quote.shopRating,
          imageUrl: null,
          availability: 8,
          hasAvailableSlots: true,
          nextAvailableSlot: null,
          serviceIds: [TIRE_INSTALL_SERVICE_ID],
        },
      },
      shopIds: [...prev.shopIds, quote.shopId],
    };
  });

  useBookingStore.setState((prev) => {
    const existing = prev.availableServices.find((s) => s.id === TIRE_INSTALL_SERVICE_ID);
    const availableServices = existing
      ? prev.availableServices
      : [
          ...prev.availableServices,
          {
            id: TIRE_INSTALL_SERVICE_ID,
            name: "Tire Installation",
            description: "Tire set installation, mounting, and balancing.",
            price: quote.total,
            category: "tires_wheels" as const,
          },
        ];

    return {
      availableServices,
      bookings: {
        ...prev.bookings,
        [bookingId]: {
          id: bookingId,
          userId: "current_user_id",
          shopId: quote.shopId,
          vehicleId: vehicleId ?? "default_vehicle_id",
          serviceIds: [TIRE_INSTALL_SERVICE_ID],
          status: "pending_quote" as const,
          scheduledDate,
          scheduledTime,
          estimatedDuration: 60,
          totalPrice: quote.total,
          notes: `${quote.tireBrand} · ${quote.quantity} tires at ${quote.shopName}`,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      bookingIds: [...prev.bookingIds, bookingId],
    };
  });
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFAFA",
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
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    padding: 12,
    marginBottom: 16,
  },
  vehicleChipStatic: {
    opacity: 0.95,
  },
  vehicleThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vehicleThumbImage: {
    width: 40,
    height: 40,
  },
  vehicleText: {
    flex: 1,
    gap: 2,
  },

  hero: {
    height: 240,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#F5F7FB",
    marginBottom: 12,
  },

  presetRow: {
    flexDirection: "row",
    gap: 10,
  },
  presetButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  presetButtonActive: {
    backgroundColor: "#1A1A1A",
    borderColor: "#1A1A1A",
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
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sizeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  sizeChipActive: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },

  optionCard: {
    flex: 1,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  optionCardActive: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  recBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#E8F5E9",
  },
  recBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  tierList: {
    gap: 10,
  },
  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  tierCardActive: {
    borderColor: "#5299FE",
    borderWidth: 2,
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  tierTag: {
    marginTop: 6,
  },

  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(250,250,250,0.96)",
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
  ctaButtonDisabled: {
    opacity: 0.5,
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
  vehicleRowThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vehicleRowImage: {
    width: 40,
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

  // Results sheet
  resultsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingHead: {
    marginTop: 16,
  },
  loadingSub: {
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    alignItems: "center",
  },
  emptySub: {
    marginTop: 6,
    marginBottom: 14,
    textAlign: "center",
  },
  emptyButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  quoteList: {
    paddingBottom: 24,
  },
  resultsLabel: {
    letterSpacing: 1,
    marginBottom: 10,
  },
  resultsLabelTop: {
    marginTop: 18,
  },
});

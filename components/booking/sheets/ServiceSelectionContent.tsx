/**
 * ServiceSelectionContent — Booking Taxonomy v5 grid.
 *
 * 4 tabs in NYC frequency order, slug-bound cards, applicability
 * filter, "Ask Oto" pin at the bottom. Card anatomy: title (full
 * width, one line), subtitle (Guided default-on), meta row with
 * clock + est-time + "Price at shop step". Tire Replacement renders
 * the quote variant and routes to /(tire-booking).
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * Spec: ~/Downloads/Otopair Booking Taxonomy v5.docx
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { ChevronRight, Clock, Sparkles } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import {
  SLUG_DIAGNOSTIC_SCAN,
  SLUG_TIRE_REPLACEMENT,
  TABS,
  TAXONOMY,
  type TaxonomyTab,
} from "@/constants/serviceTaxonomy";
import { BorderRadius } from "@/constants/theme";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import { formatDurationForCar } from "@/lib/formatDuration";
import { isApplicable } from "@/lib/serviceApplicability";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

const DIAGNOSTIC_SYSTEM_LABELS: Record<string, string> = {
  brakes: "Brakes",
  tires_wheels: "Tires & Wheels",
  engine: "Engine",
  battery_electrical: "Battery & Electrical",
  not_sure: "Not sure — mechanic to inspect",
};

/** Map the legacy `initialServiceCategory` signal (set by home cards
 *  pre-v5) onto a v5 tab. Best-effort — when no match, the grid falls
 *  back to Routine upkeep. */
function legacyCategoryToTab(category: ServiceCategory | null | undefined): TaxonomyTab | null {
  if (!category) return null;
  switch (category) {
    case "basic_maintenance":
      return "routine_upkeep";
    case "tires_wheels":
    case "brakes_suspension":
      return "tires_brakes";
    case "system_diagnostics":
      return "inspections";
    default:
      return null;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface ServiceSelectionContentProps {
  onCategorySelect?: () => void;
  onShopTiresRequested?: () => void;
  onServiceWithOptionsRequested?: (serviceId: string) => void;
  onDiagnosticServiceRequested?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionContent({
  onCategorySelect,
  onShopTiresRequested,
  onServiceWithOptionsRequested,
  onDiagnosticServiceRequested,
}: ServiceSelectionContentProps) {
  const router = useRouter();

  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const initialServiceCategory = useBookingStore((state) => state.initialServiceCategory);
  const selectedServiceOptions = useBookingStore((state) => state.selectedServiceOptions);
  const selectedDiagnosticSystem = useBookingStore((state) => state.selectedDiagnosticSystem);
  const customerNotes = useBookingStore((state) => state.customerNotes);
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());
  const engineId = selectedVehicle?.engineId;

  // Per-engine labor + applicability for every service in the
  // catalog (we need applicability before we know what'll render).
  const allServiceIds = useMemo(() => availableServices.map((s) => s.id), [availableServices]);
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, allServiceIds);

  // Initial tab: prefer the legacy initialServiceCategory signal
  // mapped to a tab; otherwise infer from any pre-selection's tab;
  // otherwise default to routine_upkeep (first tab in spec order).
  const preSelectedTab = useMemo<TaxonomyTab | null>(() => {
    if (selectedServiceIds.length === 0) return null;
    const svc = availableServices.find((s) => s.id === selectedServiceIds[0]);
    return svc?.tab ?? null;
  }, [selectedServiceIds, availableServices]);

  const [selectedTab, setSelectedTab] = useState<TaxonomyTab>(
    legacyCategoryToTab(initialServiceCategory) ?? preSelectedTab ?? "routine_upkeep",
  );

  useEffect(() => {
    const mapped = legacyCategoryToTab(initialServiceCategory);
    if (mapped) setSelectedTab(mapped);
  }, [initialServiceCategory]);

  const initialTabAppliedRef = useRef(false);
  useEffect(() => {
    if (initialServiceCategory) return;
    if (initialTabAppliedRef.current) return;
    if (preSelectedTab) {
      setSelectedTab(preSelectedTab);
      initialTabAppliedRef.current = true;
    }
  }, [preSelectedTab, initialServiceCategory]);

  // Per-tab service list: filter by tab, drop inapplicable, sort by
  // taxonomy order. Services without a slug or taxonomy entry never
  // reach here (the hook drops them at the boundary).
  const filteredServices = useMemo(() => {
    return availableServices
      .filter((service) => {
        if (service.tab !== selectedTab) return false;
        if (!service.slug) return false;
        const entry = TAXONOMY[service.slug];
        if (!entry) return false;
        const spec = engineSpecs[service.id] ?? null;
        return isApplicable(entry, selectedVehicle ?? null, spec);
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [availableServices, selectedTab, selectedVehicle, engineSpecs]);

  // Scroll-to-preselected on tab switch / hydrate.
  const scrollViewRef = useRef<ScrollView>(null);
  const itemPositions = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (selectedServiceIds.length === 0) return;
    const targetId = selectedServiceIds.find((id) =>
      filteredServices.some((s) => s.id === id),
    );
    if (!targetId) return;
    const t = setTimeout(() => {
      const y = itemPositions.current.get(targetId);
      if (y == null) return;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [selectedTab, filteredServices, selectedServiceIds]);

  // ── Handlers ──
  const handleServicePress = useCallback(
    (serviceId: string) => {
      const service = availableServices.find((s) => s.id === serviceId);
      if (!service) return;

      // Tire-replacement: hand off to the dedicated quote flow.
      if (service.slug === SLUG_TIRE_REPLACEMENT) {
        if (onShopTiresRequested) onShopTiresRequested();
        else router.push("/(tire-booking)");
        return;
      }

      const isAlreadySelected = selectedServiceIds.includes(serviceId);

      // has_options services route to the per-service picker first.
      if (service.has_options === true && !isAlreadySelected) {
        if (onServiceWithOptionsRequested) {
          onServiceWithOptionsRequested(serviceId);
          return;
        }
      }

      // Diagnostic scan: open the area picker on first add.
      if (service.slug === SLUG_DIAGNOSTIC_SCAN && !isAlreadySelected) {
        if (onDiagnosticServiceRequested) {
          onDiagnosticServiceRequested();
          return;
        }
      }

      toggleServiceSelection(serviceId);
    },
    [
      toggleServiceSelection,
      router,
      availableServices,
      onShopTiresRequested,
      onServiceWithOptionsRequested,
      onDiagnosticServiceRequested,
      selectedServiceIds,
    ],
  );

  const handleTabSelect = useCallback(
    (tab: TaxonomyTab) => {
      setSelectedTab(tab);
      onCategorySelect?.();
    },
    [onCategorySelect],
  );

  const handleAskOto = useCallback(() => {
    router.push("/(main-tabs)/ai-chat");
  }, [router]);

  // ── Render helpers ──
  const renderTab = useCallback(
    (tab: { key: TaxonomyTab; label: string }) => {
      const isActive = selectedTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          style={[styles.categoryTab, isActive && styles.categoryTabActive]}
          onPress={() => handleTabSelect(tab.key)}
          activeOpacity={0.7}
        >
          <Text
            size="sm"
            weight={isActive ? "semiBold" : "medium"}
            color={isActive ? BrandColors.primary : "#6B7280"}
            center
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedTab, handleTabSelect],
  );

  const renderServiceCard = useCallback(
    (service: Service) => {
      const isSelected = selectedServiceIds.includes(service.id);
      const isQuote = service.variant === "quote";
      const isDiagnostic = service.slug === SLUG_DIAGNOSTIC_SCAN;
      const optionLabel = isSelected ? selectedServiceOptions[service.id]?.option_label : undefined;
      const diagnosticAreaLabel =
        isDiagnostic && isSelected && selectedDiagnosticSystem
          ? DIAGNOSTIC_SYSTEM_LABELS[selectedDiagnosticSystem] ?? selectedDiagnosticSystem
          : null;
      const diagnosticNotes = isDiagnostic && isSelected ? customerNotes.trim() : "";

      // Meta-row time: prefer per-vehicle MOTOR labor hours when
      // available, else the taxonomy est-time fallback.
      const hours = engineSpecs[service.id]?.labor_hours ?? service.default_labor_hours;
      const carDuration = formatDurationForCar(hours);
      const metaTimeText = isQuote
        ? service.estTimeLabel ?? "Quote — pick brand & price"
        : carDuration
          ? `About ${carDuration}`
          : service.estTimeLabel ?? "";

      return (
        <TouchableOpacity
          key={service.id}
          style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
          onPress={() => handleServicePress(service.id)}
          onLayout={(e) => itemPositions.current.set(service.id, e.nativeEvent.layout.y)}
          activeOpacity={0.7}
        >
          <Text
            size="md"
            weight="semiBold"
            color={BrandColors.primary}
            style={styles.cardTitle}
            numberOfLines={1}
          >
            {service.displayLabel ?? service.name}
          </Text>

          {service.subtitle ? (
            <Text size="sm" weight="regular" color="#6B7280" style={styles.cardSubtitle} numberOfLines={1}>
              {service.subtitle}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              {!isQuote ? <Clock size={14} color="#6B7280" strokeWidth={2} /> : null}
              <Text size="xs" weight="medium" color="#6B7280">
                {metaTimeText}
              </Text>
            </View>
            <Text size="xs" weight="medium" color="#6B7280">
              {isQuote ? "" : "Price at shop step"}
            </Text>
          </View>

          {optionLabel && (
            <Text size="xs" weight="semiBold" color={BrandColors.secondary} style={styles.optionSelected}>
              Option Selected: {optionLabel}
            </Text>
          )}

          {diagnosticAreaLabel && (
            <View style={styles.diagnosticInline}>
              <View style={styles.diagnosticInlineRow}>
                <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.diagnosticInlineLabel}>
                  Selected area:
                </Text>
                <Text size="xs" weight="semiBold" color={BrandColors.primary} style={styles.diagnosticInlineValue}>
                  {diagnosticAreaLabel}
                </Text>
              </View>
              {diagnosticNotes.length > 0 && (
                <View style={styles.diagnosticInlineRow}>
                  <Text size="xs" weight="bold" color={BrandColors.secondary} style={styles.diagnosticInlineLabel}>
                    Notes:
                  </Text>
                  <Text
                    size="xs"
                    weight="regular"
                    color={BrandColors.primary}
                    style={styles.diagnosticInlineValue}
                    numberOfLines={3}
                  >
                    {diagnosticNotes}
                  </Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [
      selectedServiceIds,
      selectedServiceOptions,
      selectedDiagnosticSystem,
      customerNotes,
      handleServicePress,
      engineSpecs,
    ],
  );

  // ── Render ──
  return (
    <View style={styles.container}>
      <View style={styles.categoryTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsContent}
        >
          {TABS.map(renderTab)}
        </ScrollView>
      </View>

      <BottomSheetScrollView
        ref={scrollViewRef as unknown as React.Ref<typeof BottomSheetScrollView>}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredServices.map(renderServiceCard)}

        {filteredServices.length === 0 && (
          <View style={styles.emptyState}>
            <Text size="md" weight="medium" color="#9CA3AF" center>
              No services for this tab
            </Text>
          </View>
        )}

        {/* Ask Oto catch-all — pinned at the bottom of every tab */}
        <TouchableOpacity style={styles.askOtoRow} onPress={handleAskOto} activeOpacity={0.8}>
          <View style={styles.askOtoLeft}>
            <Sparkles size={18} color={BrandColors.secondary} strokeWidth={2} />
            <Text size="sm" weight="semiBold" color={BrandColors.primary} style={styles.askOtoText}>
              Not sure what you need? Ask Oto
            </Text>
          </View>
          <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} />
        </TouchableOpacity>
      </BottomSheetScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoryTabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryTabsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  categoryTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    minWidth: 70,
  },
  categoryTabActive: {
    borderBottomColor: BrandColors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  serviceCard: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "transparent",
  },
  serviceCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  cardSubtitle: {
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyState: {
    paddingVertical: Spacing["3xl"],
  },
  optionSelected: {
    marginTop: Spacing.xs,
  },
  diagnosticInline: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: "#F0F7FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  diagnosticInlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  diagnosticInlineLabel: {
    letterSpacing: 0.3,
    marginTop: 1,
  },
  diagnosticInlineValue: {
    flex: 1,
  },
  askOtoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F0F7FF",
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
  },
  askOtoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  askOtoText: {
    flex: 1,
  },
});

/**
 * ServiceSelectionContent — Booking Taxonomy v5 grid + coverage filter.
 *
 * Two stacked filters per the v5 spec + the vehicle-readiness backend:
 *  1. v5 taxonomy: 4 tabs in NYC frequency order, slug-bound cards,
 *     subtitle (Guided default-on), meta row with clock + est-time +
 *     "Price at shop step". Tire Replacement is the quote variant.
 *  2. Coverage filter (useBookableServices + useVehicleReadiness):
 *     per-service render state — bookable / blocked_by_specs (tap
 *     opens the PackageQuestionsSheet inline) / blocked_by_enrichment
 *     (greyed, no-op) / missing_data (hidden). When the vehicle is
 *     still enriching, a "Setting up your car…" banner shows above
 *     the grid.
 *
 * "Ask Oto" stays pinned at the bottom of every tab.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * Spec: ~/Downloads/Otopair Booking Taxonomy v5.docx
 *       docs/TICKET_PACKAGE_QUESTIONS.md
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { ChevronRight, Clock, Sparkles } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { PackageQuestionsSheet } from "@/components/cars/PackageQuestionsSheet";
import {
  HANDOFF_SLUGS,
  SLUG_DIAGNOSTIC_SCAN,
  SLUG_ROTOR_REPLACEMENT,
  SLUG_TIRE_REPLACEMENT,
  TABS,
  TAXONOMY,
  type TaxonomyTab,
} from "@/constants/serviceTaxonomy";
import { BorderRadius } from "@/constants/theme";
import { useBookableServices } from "@/hooks/useBookableServices";
import { useBookingLaborHours } from "@/hooks/useBookingLaborHours";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import { useVehicleReadiness } from "@/hooks/useVehicleReadiness";
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
  /** Called when the user picks Rotor Replacement — mirror of
   *  `onShopTiresRequested`. Parent should close the sheet and hand off
   *  to the Shop Rotors flow at `/(rotor-booking)`. */
  onShopRotorsRequested?: () => void;
  onServiceWithOptionsRequested?: (serviceId: string) => void;
  onDiagnosticServiceRequested?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionContent({
  onCategorySelect,
  onShopTiresRequested,
  onShopRotorsRequested,
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
  const ownershipId = selectedVehicle?.ownershipId;

  // Per-engine labor + applicability for every service in the
  // catalog (we need applicability before we know what'll render).
  const allServiceIds = useMemo(() => availableServices.map((s) => s.id), [availableServices]);
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, allServiceIds);

  // Engine-adjusted + director-rounded labor for the entire catalog. Same
  // source of truth the rest of the booking flow (mechanic picker, Review
  // & Pay, persisted estimated_labor_minutes) uses — so the "About X mins"
  // chip on each card matches what the customer sees downstream instead of
  // showing the raw catalog default.
  const { laborHours: laborHoursByService } = useBookingLaborHours(
    ownershipId,
    allServiceIds,
  );
  const laborHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of laborHoursByService) {
      map.set(String(row.serviceId), row.hours);
    }
    return map;
  }, [laborHoursByService]);

  // ═══════════════ Coverage filter (the dynamic filter engine) ═══════════════
  // Three per-service render states (driven by useBookableServices):
  //   - "bookable"             → enabled
  //   - "blocked_by_enrichment" → greyed, no action (wait for pipeline)
  //   - "blocked_by_specs"     → greyed + tappable; tap opens the inline
  //                              PackageQuestionsSheet so the user resolves
  //                              the pending package question without leaving
  //                              the booking flow
  //   - "missing_data"         → hidden entirely (not in applicableIds)
  //
  // Behavior:
  //   - readiness.status === "enriching" → banner shows + applicable rows
  //     render disabled (except labor-only services, which the backend
  //     treats as bookable even mid-enrichment)
  //   - readiness.status === "ready" → bookable rows enabled,
  //     needs-specs rows greyed+tappable, blocked-by-enrichment rows greyed
  //
  // Non-applicable services (is_applicable=false for this vehicle's engine
  // or owner override — e.g. timing belt on a chain engine) never render.
  // See docs/TICKET_PACKAGE_QUESTIONS.md.
  const readiness = useVehicleReadiness(ownershipId);
  const isEnriching = readiness.status === "enriching";
  const { applicableIds, bookableIds, needsSpecsIds, isLoading: isBookableLoading } =
    useBookableServices(ownershipId);

  // Spec-check sheet — opens inline when the user taps a blocked-by-specs
  // service (e.g. brake pads with an unanswered "Performance Brake Package"
  // question). On submit, the service auto-selects so they keep their place
  // in the booking flow without re-tapping.
  const [specsCheckServiceId, setSpecsCheckServiceId] = useState<string | null>(null);
  const activeVehicleLabel = useMemo(() => {
    if (!selectedVehicle) return "";
    const parts = [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model].filter(Boolean);
    return parts.join(" ").trim();
  }, [selectedVehicle]);
  // Subset of pending package questions relevant to the tapped service —
  // keep the sheet narrow so only the blocking ones surface.
  const specsCheckQuestions = useMemo(() => {
    if (!specsCheckServiceId) return [];
    const service = availableServices.find((s) => s.id === specsCheckServiceId);
    const slug = service?.slug;
    if (!slug) return [];
    return readiness.pendingPackages.filter((pkg) =>
      pkg.services_affected.includes(slug),
    );
  }, [specsCheckServiceId, availableServices, readiness.pendingPackages]);

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

  // Per-tab service list: v5 taxonomy filter (tab + slug + applicability)
  // intersected with the backend's applicableIds (which already excludes
  // "missing_data"). Per-row render state (enabled / greyed /
  // tappable-redirect) is decided at render time using bookableIds +
  // needsSpecsIds.
  const filteredServices = useMemo(() => {
    const list = availableServices
      .filter((service) => {
        if (service.tab !== selectedTab) return false;
        if (!service.slug) return false;
        const entry = TAXONOMY[service.slug];
        if (!entry) return false;
        const spec = engineSpecs[service.id] ?? null;
        return isApplicable(entry, selectedVehicle ?? null, spec);
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    // No active vehicle context — taxonomy-only filter, no coverage gate.
    if (!ownershipId) return list;
    // Bookable set still resolving — render nothing rather than flashing
    // services that will then disappear.
    if (isBookableLoading) return [];
    // Handoff services (Tire/Rotor Replacement) bypass the gate because they
    // route to dedicated pickers with their own data fallbacks.
    return list.filter(
      (s) => (s.slug && HANDOFF_SLUGS.has(s.slug)) || applicableIds.has(s.id),
    );
  }, [
    availableServices,
    selectedTab,
    selectedVehicle,
    engineSpecs,
    ownershipId,
    isBookableLoading,
    applicableIds,
  ]);

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

      const isAlreadySelected = selectedServiceIds.includes(serviceId);

      // Tire-replacement: hand off to the dedicated quote flow.
      // Re-tap on an already-selected handoff service removes it.
      if (service.slug === SLUG_TIRE_REPLACEMENT) {
        if (isAlreadySelected) {
          toggleServiceSelection(serviceId);
          return;
        }
        if (onShopTiresRequested) onShopTiresRequested();
        else router.push("/(tire-booking)");
        return;
      }

      // Rotor-replacement: hand off to the dedicated Shop Rotors flow
      // (axle pair + tier picker). Brake jobs are always done in pairs
      // per axle, so this can't be a plain cart toggle.
      if (service.slug === SLUG_ROTOR_REPLACEMENT) {
        if (isAlreadySelected) {
          toggleServiceSelection(serviceId);
          return;
        }
        if (onShopRotorsRequested) onShopRotorsRequested();
        else router.push("/(rotor-booking)");
        return;
      }

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
      onShopRotorsRequested,
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

      // Meta-row time: prefer the engine-adjusted + director-rounded labor
      // (laborHoursMap → same path the mechanic picker, Review & Pay, and
      // persistence read). Fall back to MOTOR engine specs and then the
      // catalog default — both shown without rounding because the vehicle
      // context isn't resolved at those layers.
      const hours =
        laborHoursMap.get(String(service.id)) ??
        engineSpecs[service.id]?.labor_hours ??
        service.default_labor_hours;
      const carDuration = formatDurationForCar(hours);
      const metaTimeText = isQuote
        ? service.estTimeLabel ?? "Quote — pick brand & price"
        : carDuration
          ? `About ${carDuration}`
          : service.estTimeLabel ?? "";

      // Per-service render state — only meaningful when we have a vehicle.
      // Without one, all rows render enabled (fallback / no-garage path).
      const hasVehicle = ownershipId != null;
      const isHandoff = !!service.slug && HANDOFF_SLUGS.has(service.slug);
      // Handoff services (Tire/Rotor) always render enabled — they route to
      // their own pickers with fallback data, so the bookable gate doesn't apply.
      const isBookable = !hasVehicle || isHandoff || bookableIds.has(service.id);
      const needsSpecs = hasVehicle && !isHandoff && needsSpecsIds.has(service.id);
      // "Locked" = greyed + non-tappable as a booking action. Needs-specs
      // rows are STILL greyed but tap-redirects to the inline sheet.
      const isRowLocked = hasVehicle && !isBookable;

      const onPress = () => {
        if (needsSpecs) {
          // Open the spec-check sheet inline — when the user answers, the
          // service auto-selects (see onSubmitted on PackageQuestionsSheet
          // below). They keep their place in the booking flow.
          setSpecsCheckServiceId(service.id);
          return;
        }
        if (isRowLocked) return;
        handleServicePress(service.id);
      };

      return (
        <TouchableOpacity
          key={service.id}
          style={[
            styles.serviceCard,
            isSelected && styles.serviceCardSelected,
            isRowLocked && styles.serviceCardDisabled,
          ]}
          onPress={onPress}
          onLayout={(e) => itemPositions.current.set(service.id, e.nativeEvent.layout.y)}
          activeOpacity={isRowLocked && !needsSpecs ? 1 : 0.7}
          disabled={isRowLocked && !needsSpecs}
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

          {needsSpecs && (
            <Text
              size="xs"
              weight="semiBold"
              color={BrandColors.secondary}
              style={styles.specsHint}
            >
              Tap to answer a quick spec question
            </Text>
          )}

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
      laborHoursMap,
      ownershipId,
      bookableIds,
      needsSpecsIds,
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
        {/* Enrichment-in-flight banner. Services below render disabled until
            the pipeline completes. See docs/TICKET_PACKAGE_QUESTIONS.md. */}
        {isEnriching && (
          <View style={styles.enrichingBanner}>
            <Text size="sm" weight="semiBold" color="#374151">
              Setting up your car…
            </Text>
            <Text size="xs" weight="regular" color="#6B7280" style={styles.enrichingBannerSub}>
              We&apos;re building this vehicle&apos;s profile. Services will be bookable once we have your parts data.
            </Text>
          </View>
        )}

        {filteredServices.map(renderServiceCard)}

        {filteredServices.length === 0 && !isEnriching && (
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

      {/* Inline spec-question sheet — opens when the user taps a service
          that's blocked by an unanswered package question. On submit, the
          service auto-selects so they continue in the booking flow.
          See docs/TICKET_PACKAGE_QUESTIONS.md. */}
      {ownershipId && specsCheckServiceId && (
        <PackageQuestionsSheet
          visible={true}
          vehicleOwnerId={ownershipId}
          questions={specsCheckQuestions}
          vehicleLabel={activeVehicleLabel}
          onClose={() => setSpecsCheckServiceId(null)}
          onSubmitted={() => {
            // User answered; route through the normal press handler so
            // has_options / diagnostic / tire-replacement special cases
            // still apply, then close the sheet.
            const id = specsCheckServiceId;
            if (id) handleServicePress(id);
          }}
        />
      )}
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
  serviceCardDisabled: {
    opacity: 0.45,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  cardSubtitle: {
    marginTop: 2,
  },
  specsHint: {
    marginTop: 4,
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
  enrichingBanner: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: Spacing.md,
  },
  enrichingBannerSub: {
    marginTop: 2,
    lineHeight: 16,
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

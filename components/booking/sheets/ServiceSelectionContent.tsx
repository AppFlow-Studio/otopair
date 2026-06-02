/**
 * ServiceSelectionContent
 *
 * PURPOSE: Displays the service selection UI for the booking bottom sheet.
 *          Shows category tabs and service list. Header/search is in parent.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * PROPS:
 *   - onCategorySelect (() => void): Called when a category tab is tapped (to expand sheet) [optional]
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { PackageQuestionsSheet } from "@/components/cars/PackageQuestionsSheet";
import { BorderRadius } from "@/constants/theme";
import { getVariantSpec } from "@/constants/serviceVariants";
import { useBookableServices } from "@/hooks/useBookableServices";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import { useVehicleReadiness } from "@/hooks/useVehicleReadiness";
import { formatDurationForCar } from "@/lib/formatDuration";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

/** Service NAME (not id) that hands off to the dedicated Shop Tires
 *  flow instead of being toggled like a regular line-item. We match by
 *  name because the mock catalog uses `svc_tire_replacement` while the
 *  Convex-hydrated catalog uses opaque doc ids — name is the stable
 *  identifier across both. */
const SHOP_TIRES_SERVICE_NAME = "Tire Replacement";
const ROTOR_REPLACEMENT_SERVICE_NAME = "Rotor Replacement";
const DIAGNOSTIC_SCAN_SERVICE_NAME = "Diagnostic Scan";

/** Services that hand off to a dedicated picker flow on tap instead of
 *  toggling as a cart line-item. These must always render and be tappable
 *  in the picker, even when the backend reports `missing_data` for this
 *  vehicle — the dedicated flows have their own fallbacks (e.g. the tire
 *  picker uses MOCK_OEM_SIZES_BY_MAKE when trim_specs lacks tire data). */
const HANDOFF_SERVICE_NAMES: ReadonlySet<string> = new Set([
  SHOP_TIRES_SERVICE_NAME,
  ROTOR_REPLACEMENT_SERVICE_NAME,
]);

const DIAGNOSTIC_SYSTEM_LABELS: Record<string, string> = {
  brakes: "Brakes",
  tires_wheels: "Tires & Wheels",
  engine: "Engine",
  battery_electrical: "Battery & Electrical",
  not_sure: "Not sure — mechanic to inspect",
};

// ============================================================================
// TYPES
// ============================================================================

interface ServiceSelectionContentProps {
  /** Called when a category tab is tapped (to expand sheet if minimized) */
  onCategorySelect?: () => void;
  /** Called when the user picks Tire Replacement — the parent should
   *  close the bottom sheet (so it doesn't obscure the new screen) and
   *  hand off to the Shop Tires flow. If omitted, this component falls
   *  back to a direct router.push, which works but leaves the sheet
   *  visible over the new screen. */
  onShopTiresRequested?: () => void;
  /** Called when the user picks Rotor Replacement — mirror of
   *  `onShopTiresRequested`. Parent should close the sheet and hand off
   *  to the Shop Rotors flow at `/(rotor-booking)`. */
  onShopRotorsRequested?: () => void;
  /** Called when the user taps a service whose has_options=true and isn't
   *  already selected. The parent should open a per-service options
   *  picker (SingleServiceOptionsSheet), which on confirm will toggle the
   *  service on with the selected option recorded. */
  onServiceWithOptionsRequested?: (serviceId: string) => void;
  /** Called when the user taps Diagnostic Scan and it isn't already in the
   *  cart. The parent opens DiagnosticOptionsSheet so the user picks an
   *  area + (optional) notes before the service lands in the cart. */
  onDiagnosticServiceRequested?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionContent({ onCategorySelect, onShopTiresRequested, onShopRotorsRequested, onServiceWithOptionsRequested, onDiagnosticServiceRequested }: ServiceSelectionContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const getServiceCategories = useBookingStore((state) => state.getServiceCategories);
  const initialServiceCategory = useBookingStore((state) => state.initialServiceCategory);
  const selectedServiceOptions = useBookingStore((state) => state.selectedServiceOptions);
  const serviceVariants = useBookingStore((state) => state.serviceVariants);
  const setServiceVariant = useBookingStore((state) => state.setServiceVariant);
  const selectedDiagnosticSystem = useBookingStore((state) => state.selectedDiagnosticSystem);
  const customerNotes = useBookingStore((state) => state.customerNotes);
  const engineId = useVehicleStore((state) => state.getSelectedVehicle()?.engineId);
  const ownershipId = useVehicleStore((state) => state.getSelectedVehicle()?.ownershipId);

  // ═══════════════ STATE-EFFECT: Per-car duration specs ═══════════════
  const allServiceIds = useMemo(() => availableServices.map((s) => s.id), [availableServices]);
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, allServiceIds);

  // ═══════════════ STATE-EFFECT: Coverage filter (the dynamic filter engine) ═══════════════
  // Three per-service render states (driven by useBookableServices):
  //   - "bookable"           → enabled
  //   - "blocked_by_enrichment" → greyed, no action (wait for pipeline)
  //   - "blocked_by_specs"   → greyed + tappable; tap redirects to My Cars so
  //                            the user answers the pending package question
  //   - "missing_data"       → hidden entirely (not in applicableIds)
  //
  // Behavior:
  //   - status === "enriching" → render applicableIds; bookable rows enabled
  //     (labor-only — inspections, diagnostics, etc), the rest greyed
  //   - status === "ready"    → render applicableIds; bookable rows enabled,
  //     needs-specs rows greyed+tappable, blocked_by_enrichment rows greyed
  //
  // Non-applicable services (is_applicable=false for this vehicle's engine or
  // owner override — e.g. timing belt on a chain engine) never render.
  // See docs/TICKET_PACKAGE_QUESTIONS.md.
  const readiness = useVehicleReadiness(ownershipId);
  const isEnriching = readiness.status === "enriching";
  const { applicableIds, bookableIds, needsSpecsIds, isLoading: isBookableLoading } =
    useBookableServices(ownershipId);

  // ═══════════════ STATE-EFFECT: Spec-check sheet for blocked services ═══════════════
  // When a user taps a service that's blocked_by_specs (e.g. brake pads when
  // there's an unanswered "Performance Brake Package" question), we open the
  // PackageQuestionsSheet INLINE rather than punting them to My Cars. After
  // they answer, the service auto-selects so they keep their place in the
  // booking flow without re-tapping. See docs/TICKET_PACKAGE_QUESTIONS.md.
  const [specsCheckServiceId, setSpecsCheckServiceId] = useState<string | null>(null);
  const activeVehicle = useVehicleStore((state) => state.getSelectedVehicle());
  const activeVehicleLabel = useMemo(() => {
    if (!activeVehicle) return "";
    const parts = [activeVehicle.year, activeVehicle.make, activeVehicle.model].filter(Boolean);
    return parts.join(" ").trim();
  }, [activeVehicle]);
  // Subset of pending package questions relevant to the service the user
  // tapped — keep the sheet narrow so only the blocking ones surface.
  const specsCheckQuestions = useMemo(() => {
    if (!specsCheckServiceId) return [];
    const service = availableServices.find((s) => s.id === specsCheckServiceId);
    const slug = service?.slug;
    if (!slug) return [];
    return readiness.pendingPackages.filter((pkg) =>
      pkg.services_affected.includes(slug),
    );
  }, [specsCheckServiceId, availableServices, readiness.pendingPackages]);

  // ═══════════════ STATE-EFFECT: Local State ═══════════════
  // Read the category signal from the store on first render so entries
  // from category-specific cards (e.g. home "Brakes" card) open on the
  // right tab. We intentionally DO NOT clear the signal here — in dev,
  // React strict-mode double-mounts components, and clearing during the
  // first mount would leave the second (real) mount with an empty
  // signal and fall back to `basic_maintenance`. The store keeps the
  // value as "sticky last intent"; senders (e.g. MoreServicesSection,
  // MechanicSearchBar) always set it before navigating, so the next
  // entry always has fresh intent.
  // If the flow was opened with services already pre-selected (e.g.
  // from a recommendation's "Book This Service" CTA), default the
  // active category to that service's category so the user lands on
  // the right tab instead of the generic basic_maintenance default.
  const preSelectedCategory = useMemo<ServiceCategory | null>(() => {
    if (selectedServiceIds.length === 0) return null;
    const svc = availableServices.find((s) => s.id === selectedServiceIds[0]);
    return (svc?.category as ServiceCategory | undefined) ?? null;
  }, [selectedServiceIds, availableServices]);

  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>(
    initialServiceCategory ?? preSelectedCategory ?? "basic_maintenance",
  );

  // Sync follow-up store updates while the sheet is mounted (e.g. the
  // user returns to home, taps a different card, and comes back).
  useEffect(() => {
    if (initialServiceCategory) {
      setSelectedCategory(initialServiceCategory);
    }
  }, [initialServiceCategory]);

  // availableServices may hydrate after first mount (Convex query). If
  // we mounted with a pre-selection but couldn't resolve its category
  // yet, switch once the catalog arrives.
  const initialCategoryAppliedRef = useRef(false);
  useEffect(() => {
    if (initialServiceCategory) return;
    if (initialCategoryAppliedRef.current) return;
    if (preSelectedCategory) {
      setSelectedCategory(preSelectedCategory);
      initialCategoryAppliedRef.current = true;
    }
  }, [preSelectedCategory, initialServiceCategory]);

  // ═══════════════ STATE-EFFECT: Memoized Values ═══════════════
  const filteredServices = useMemo(() => {
    const byCategory = availableServices.filter((service) => service.category === selectedCategory);
    // No active vehicle context — fall back to unfiltered (rare path; the
    // booking flow normally has a vehicle selected by this stage).
    if (!ownershipId) return byCategory;
    // Bookable set still resolving — render nothing rather than flashing
    // services that will then disappear.
    if (isBookableLoading) return [];
    // Always filter by applicableIds (which already excludes "missing_data").
    // Per-row render state (enabled / greyed / tappable-redirect) is decided
    // at render time below using bookableIds + needsSpecsIds.
    // Handoff services (Tire/Rotor Replacement) bypass the gate because they
    // route to dedicated pickers with their own data fallbacks.
    return byCategory.filter(
      (service) =>
        HANDOFF_SERVICE_NAMES.has(service.name) || applicableIds.has(service.id),
    );
  }, [availableServices, selectedCategory, ownershipId, isBookableLoading, applicableIds]);

  // Auto-scroll the list to a preselected service (e.g. when arriving via
  // Book Now / Book Service deep-link). Each item records its y-offset on
  // layout; an effect scrolls to the first selected service once layouts
  // have settled. Re-fires on tab change so tab switches also re-anchor.
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
  }, [selectedCategory, filteredServices, selectedServiceIds]);

  // ═══════════════ STATE-EFFECT: Handlers ═══════════════
  const handleServicePress = useCallback(
    (serviceId: string) => {
      const service = availableServices.find((s) => s.id === serviceId);
      const isAlreadySelected = selectedServiceIds.includes(serviceId);
      // Tire Replacement hands off to the dedicated Shop Tires flow
      // (per-wheel picker + size + type + quality tier) instead of
      // being toggled as a line-item. The flow reads the active vehicle
      // from useVehicleStore on mount, so nothing to pass.
      // If it's already in the cart, a re-tap removes it instead of
      // re-routing back into the picker.
      if (service?.name === SHOP_TIRES_SERVICE_NAME) {
        if (isAlreadySelected) {
          toggleServiceSelection(serviceId);
          return;
        }
        if (onShopTiresRequested) {
          onShopTiresRequested();
        } else {
          router.push("/(tire-booking)");
        }
        return;
      }
      // Rotor Replacement hands off to the dedicated Shop Rotors flow
      // (axle pair + tier picker) — mirror of the tire branch above.
      // Brake jobs are always done in pairs per axle, so the rotor flow
      // can't be a plain cart toggle. Same re-tap-to-deselect behavior.
      if (service?.name === ROTOR_REPLACEMENT_SERVICE_NAME) {
        if (isAlreadySelected) {
          toggleServiceSelection(serviceId);
          return;
        }
        if (onShopRotorsRequested) {
          onShopRotorsRequested();
        } else {
          router.push("/(rotor-booking)");
        }
        return;
      }
      // has_options services route to a per-service picker on the first
      // tap so the user resolves Front/Rear/Both (or equivalent) before
      // the service lands in the cart. Subsequent taps just toggle off.
      if (service?.has_options === true && !isAlreadySelected) {
        if (onServiceWithOptionsRequested) {
          onServiceWithOptionsRequested(serviceId);
          return;
        }
      }
      // Diagnostic Scan follows the same tap-to-resolve pattern: open the
      // area-picker sheet so the customer flags the system + (optional)
      // notes before the service is added. Re-tap removes it. Matched by
      // name because the catalog id is the Convex _id (varies per env),
      // not the constants/services.ts slug.
      if (service?.name === DIAGNOSTIC_SCAN_SERVICE_NAME && !isAlreadySelected) {
        if (onDiagnosticServiceRequested) {
          onDiagnosticServiceRequested();
          return;
        }
      }
      toggleServiceSelection(serviceId);
    },
    [toggleServiceSelection, router, availableServices, onShopTiresRequested, onShopRotorsRequested, onServiceWithOptionsRequested, onDiagnosticServiceRequested, selectedServiceIds],
  );

  const handleCategorySelect = useCallback(
    (category: ServiceCategory) => {
      setSelectedCategory(category);
      // Notify parent to expand sheet if minimized
      onCategorySelect?.();
    },
    [onCategorySelect],
  );

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderCategoryTab = useCallback(
    (category: { key: ServiceCategory; label: string }) => {
      const isActive = selectedCategory === category.key;

      return (
        <TouchableOpacity
          key={category.key}
          style={[styles.categoryTab, isActive && styles.categoryTabActive]}
          onPress={() => handleCategorySelect(category.key)}
          activeOpacity={0.7}
        >
          <Text
            size="sm"
            weight={isActive ? "semiBold" : "medium"}
            color={isActive ? BrandColors.primary : "#6B7280"}
            center
          >
            {category.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedCategory, handleCategorySelect],
  );

  const renderServiceItem = useCallback(
    (service: Service) => {
      const isSelected = selectedServiceIds.includes(service.id);
      const hours = engineSpecs[service.id]?.labor_hours ?? service.default_labor_hours;
      const durationLabel = formatDurationForCar(hours);
      const optionLabel = isSelected ? selectedServiceOptions[service.id]?.option_label : undefined;
      const variantSpec = getVariantSpec(service.slug);
      const variantChoice = serviceVariants[service.id];
      const isDiagnostic = service.name === DIAGNOSTIC_SCAN_SERVICE_NAME;
      const diagnosticAreaLabel =
        isDiagnostic && isSelected && selectedDiagnosticSystem
          ? DIAGNOSTIC_SYSTEM_LABELS[selectedDiagnosticSystem] ?? selectedDiagnosticSystem
          : null;
      const diagnosticNotes =
        isDiagnostic && isSelected ? customerNotes.trim() : "";

      // Per-service render state — only meaningful when we have a vehicle.
      // Without one, all rows render enabled (rare/fallback path).
      const hasVehicle = ownershipId != null;
      const isHandoff = HANDOFF_SERVICE_NAMES.has(service.name);
      // Handoff services (Tire/Rotor) always render enabled — they route to
      // their own pickers with fallback data, so the bookable gate doesn't apply.
      const isBookable = !hasVehicle || isHandoff || bookableIds.has(service.id);
      const needsSpecs = hasVehicle && !isHandoff && needsSpecsIds.has(service.id);
      // "Locked" = greyed + non-tappable as a booking action.
      // Needs-specs rows are STILL greyed but tap-redirects to My Cars.
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
            styles.serviceItem,
            isSelected && styles.serviceItemSelected,
            isRowLocked && styles.serviceItemDisabled,
          ]}
          onPress={onPress}
          activeOpacity={isRowLocked && !needsSpecs ? 1 : 0.7}
          disabled={isRowLocked && !needsSpecs}
        >
          <View style={styles.serviceInfo}>
            <View style={styles.serviceTitleRow}>
              <Text
                size="md"
                weight="semiBold"
                color={BrandColors.primary}
                style={styles.serviceName}
                numberOfLines={1}
              >
                {service.name}
              </Text>
              {durationLabel && (
                <Text size="xs" weight="medium" color="#6B7280">
                  Est. Duration {durationLabel}
                </Text>
              )}
            </View>
            <Text size="sm" weight="regular" color="#6B7280">
              {service.description}
            </Text>
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
            {optionLabel && (
              <Text size="xs" weight="semiBold" color={BrandColors.secondary} style={styles.optionSelected}>
                Option Selected: {optionLabel}
              </Text>
            )}
            {/* Position chips for services with axle/side variants (brake
                pads, rotors). Render only when the service is in the cart —
                tap-to-select then a chip row appears beneath the row. The
                Add-to-Cart CTA gates on a choice being made (see
                ServiceBottomSheet:handleServicesSelected). */}
            {isSelected && variantSpec && (
              <View style={styles.variantChipsRow}>
                {variantSpec.options.map((opt) => {
                  const isActive = variantChoice === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.variantChip, isActive && styles.variantChipActive]}
                      onPress={(e) => {
                        // Prevent the parent service row's onPress (which
                        // would toggle the service off) from firing.
                        e.stopPropagation();
                        setServiceVariant(service.id, opt.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        size="xs"
                        weight={isActive ? "semiBold" : "medium"}
                        color={isActive ? BrandColors.white : BrandColors.primary}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
          </View>
        </TouchableOpacity>
      );
    },
    [selectedServiceIds, selectedServiceOptions, selectedDiagnosticSystem, customerNotes, handleServicePress, engineSpecs, ownershipId, bookableIds, needsSpecsIds, router, serviceVariants, setServiceVariant],
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      <View style={styles.categoryTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsContent}
        >
          {getServiceCategories().map(renderCategoryTab)}
        </ScrollView>
      </View>

      {/* Service List - Scrollable content with spacer for footer clearance */}
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
        {filteredServices.map(renderServiceItem)}
        {/* Intentionally no empty-state copy when filteredServices is []. When
            the bookable set is empty for this vehicle (all services blocked
            by pending package questions, no fitments), the picker renders
            nothing. Discovery happens on My Cars ("Confirm your car's specs"
            CTA). See docs/TICKET_PACKAGE_QUESTIONS.md. */}

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
  serviceItem: {
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
  serviceItemSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
  },
  serviceItemDisabled: {
    opacity: 0.45,
  },
  // Hint that overrides the row's reduced opacity so the call-to-action stays
  // legible even on greyed needs-specs rows. Lives outside the .serviceItem
  // opacity scope by rendering at full color (the Text doesn't inherit opacity
  // when given an explicit color prop, so this stays readable).
  specsHint: {
    marginTop: 4,
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
  serviceInfo: {
    flex: 1,
  },
  serviceTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  serviceName: {
    flex: 1,
  },
  emptyState: {
    paddingVertical: Spacing["3xl"],
  },
  optionSelected: {
    marginTop: Spacing.xs,
  },
  variantChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  variantChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  variantChipActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
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
});

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
import { BorderRadius } from "@/constants/theme";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
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
  /** Called when the user taps a service whose has_options=true and isn't
   *  already selected. The parent should open a per-service options
   *  picker (SingleServiceOptionsSheet), which on confirm will toggle the
   *  service on with the selected option recorded. */
  onServiceWithOptionsRequested?: (serviceId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionContent({ onCategorySelect, onShopTiresRequested, onServiceWithOptionsRequested }: ServiceSelectionContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const getServiceCategories = useBookingStore((state) => state.getServiceCategories);
  const initialServiceCategory = useBookingStore((state) => state.initialServiceCategory);
  const engineId = useVehicleStore((state) => state.getSelectedVehicle()?.engineId);

  // ═══════════════ STATE-EFFECT: Per-car duration specs ═══════════════
  const allServiceIds = useMemo(() => availableServices.map((s) => s.id), [availableServices]);
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, allServiceIds);

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
    return availableServices.filter((service) => service.category === selectedCategory);
  }, [availableServices, selectedCategory]);

  // ═══════════════ STATE-EFFECT: Handlers ═══════════════
  const handleServicePress = useCallback(
    (serviceId: string) => {
      // Tire Replacement hands off to the dedicated Shop Tires flow
      // (per-wheel picker + size + type + quality tier) instead of
      // being toggled as a line-item. The flow reads the active vehicle
      // from useVehicleStore on mount, so nothing to pass.
      const service = availableServices.find((s) => s.id === serviceId);
      if (service?.name === SHOP_TIRES_SERVICE_NAME) {
        if (onShopTiresRequested) {
          onShopTiresRequested();
        } else {
          router.push("/(tire-booking)");
        }
        return;
      }
      // has_options services route to a per-service picker on the first
      // tap so the user resolves Front/Rear/Both (or equivalent) before
      // the service lands in the cart. Subsequent taps just toggle off.
      const isAlreadySelected = selectedServiceIds.includes(serviceId);
      if (service?.has_options === true && !isAlreadySelected) {
        if (onServiceWithOptionsRequested) {
          onServiceWithOptionsRequested(serviceId);
          return;
        }
      }
      toggleServiceSelection(serviceId);
    },
    [toggleServiceSelection, router, availableServices, onShopTiresRequested, onServiceWithOptionsRequested, selectedServiceIds],
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

      return (
        <TouchableOpacity
          key={service.id}
          style={[styles.serviceItem, isSelected && styles.serviceItemSelected]}
          onPress={() => handleServicePress(service.id)}
          activeOpacity={0.7}
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
          </View>
        </TouchableOpacity>
      );
    },
    [selectedServiceIds, handleServicePress, engineSpecs],
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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredServices.map(renderServiceItem)}

        {filteredServices.length === 0 && (
          <View style={styles.emptyState}>
            <Text size="md" weight="medium" color="#9CA3AF" center>
              No services found
            </Text>
          </View>
        )}

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
});

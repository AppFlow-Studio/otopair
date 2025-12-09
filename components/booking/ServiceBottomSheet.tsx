/**
 * ServiceBottomSheet
 *
 * PURPOSE: Displays a swipeable bottom sheet with searchable service list for booking flow
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onSelectServices (() => void): Called when user confirms service selection [optional]
 *
 * EXAMPLE:
 *   <ServiceBottomSheet onSelectServices={() => console.log("Services selected")} />
 *
 * OWNER: Waleed Mansour
 */

import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius, FontFamily, Shadows } from "@/constants/theme";
import type { Service } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { Check, Search } from "lucide-react-native";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceBottomSheetProps {
  /** Called when user confirms service selection */
  onSelectServices?: () => void;
  /** Vertical offset to shift bottom sheet down (pixels) */
  offsetY?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBottomSheet({ onSelectServices, offsetY = 0 }: ServiceBottomSheetProps) {
  // ═══════════════ STATE-EFFECT: Refs ═══════════════
  const bottomSheetRef = useRef<BottomSheet>(null); // [STATE-EFFECT] Bottom sheet ref for programmatic control

  // ═══════════════ STATE-EFFECT: Local State ═══════════════
  const [searchQuery, setSearchQuery] = useState(""); // [STATE-EFFECT] Search input state
  const [sheetIndex, setSheetIndex] = useState(0); // [STATE-EFFECT] Current bottom sheet position (0=collapsed, 1=expanded)
  const insets = useSafeAreaInsets(); // [STATE-EFFECT] Safe area insets for layout

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds); // [STATE-EFFECT] Selected service IDs from store
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection); // [STATE-EFFECT] Action to toggle selection
  const getServicesByCategory = useBookingStore((state) => state.getServicesByCategory); // [STATE-EFFECT] Getter for filtered services
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal); // [STATE-EFFECT] Getter for total price
  const getSelectedServicesCount = useBookingStore((state) => state.getSelectedServicesCount); // [STATE-EFFECT] Getter for selection count

  // ═══════════════ STATE-EFFECT: Memoized Values ═══════════════
  const { height } = Dimensions.get("window");
  const offsetPercent = (offsetY / height) * 100;
  const snapPoints = useMemo(() => [`${22 - offsetPercent}%`, `${75 - offsetPercent}%`], [offsetPercent]); // [STATE-EFFECT] Bottom sheet snap points

  // [STATE-EFFECT] Derived state: services filtered by category and search query
  const filteredServices = useMemo(() => {
    const categoryServices = getServicesByCategory();
    if (!searchQuery.trim()) return categoryServices;

    const query = searchQuery.toLowerCase();
    return categoryServices.filter(
      (service) => service.name.toLowerCase().includes(query) || service.description.toLowerCase().includes(query)
    );
  }, [getServicesByCategory, searchQuery]);

  // ═══════════════ STATE-EFFECT: Computed Values ═══════════════
  const selectedCount = getSelectedServicesCount(); // [STATE-EFFECT] Computed: number of selected services
  const selectedTotal = getSelectedServicesTotal(); // [STATE-EFFECT] Computed: total price of selected services
  const hasSelection = selectedCount > 0; // [STATE-EFFECT] Computed: whether any service is selected
  const isExpanded = sheetIndex === 1; // [STATE-EFFECT] Computed: whether bottom sheet is expanded
  const isCollapsed = sheetIndex === 0; // [STATE-EFFECT] Computed: whether bottom sheet is collapsed

  // ═══════════════ STATE-EFFECT: Handlers ═══════════════
  // [STATE-EFFECT] Handler: toggle service selection on press
  const handleServicePress = useCallback(
    (serviceId: string) => {
      toggleServiceSelection(serviceId);
    },
    [toggleServiceSelection]
  );

  // [STATE-EFFECT] Handler: confirm selection and call parent callback
  const handleSelectPress = useCallback(() => {
    onSelectServices?.();
  }, [onSelectServices]);

  // [STATE-EFFECT] Handler: track bottom sheet position changes
  const handleSheetChange = useCallback((index: number) => {
    setSheetIndex(index);
  }, []);

  // Render service item
  const renderServiceItem = useCallback(
    (service: Service) => {
      const isSelected = selectedServiceIds.includes(service.id);

      return (
        <TouchableOpacity
          key={service.id}
          style={[styles.serviceItem, isSelected && styles.serviceItemSelected]}
          onPress={() => handleServicePress(service.id)}
          activeOpacity={0.7}
        >
          <View style={styles.serviceInfo}>
            <Text size="md" weight="semiBold" color={BrandColors.primary}>
              {service.name}
            </Text>
            <Text size="sm" weight="regular" color="#6B7280">
              {service.description}
            </Text>
          </View>
          <View style={styles.servicePriceContainer}>
            <Text size="md" weight="semiBold" color={BrandColors.secondary}>
              ${service.price.toFixed(2)}
            </Text>
            {isSelected && (
              <View style={styles.checkIcon}>
                <Check size={16} color={BrandColors.white} strokeWidth={3} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedServiceIds, handleServicePress]
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      onChange={handleSheetChange}
      enablePanDownToClose={false}
      enableOverDrag={true}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
    >
      {/* Collapsed State Text - visible when collapsed */}
      <View style={[styles.collapsedContent, !isCollapsed && styles.hidden]}>
        <Text size="lg" weight="medium" color={BrandColors.primary} center>
          Swipe up for service list
        </Text>
      </View>

      {/* Expanded Content - visible when expanded */}
      <View style={[styles.expandedContainer, isCollapsed && styles.hidden]}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for services..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Service List */}
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredServices.map(renderServiceItem)}

          {filteredServices.length === 0 && (
            <View style={styles.emptyState}>
              <Text size="md" weight="medium" color="#9CA3AF" center>
                No services found
              </Text>
            </View>
          )}
        </BottomSheetScrollView>

        {/* Action Button */}
        <View style={[styles.buttonContainer, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <PrimaryButton
            onPress={handleSelectPress}
            style={[styles.selectButton, !hasSelection && styles.selectButtonDisabled]}
            disabled={!hasSelection}
          >
            <Text size="md" weight="semiBold" color={BrandColors.white}>
              {hasSelection ? `Add ${selectedCount} to Cart • $${selectedTotal.toFixed(0)}` : "Select Service(s)"}
            </Text>
          </PrimaryButton>
        </View>
      </View>
    </BottomSheet>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    ...Shadows.lg,
  },
  handleContainer: {
    paddingVertical: Spacing.md,
  },
  handleIndicator: {
    backgroundColor: BrandColors.primary,
    width: 80,
    height: 5,
    borderRadius: BorderRadius.full,
  },
  collapsedContent: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: BrandColors.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  serviceItemSelected: {
    backgroundColor: "#F0F7FF",
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomColor: "#E0EDFF",
  },
  serviceInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  servicePriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    paddingVertical: Spacing["3xl"],
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  selectButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  selectButtonDisabled: {
    opacity: 0.5,
  },
});

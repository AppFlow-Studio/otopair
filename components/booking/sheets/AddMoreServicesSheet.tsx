/**
 * AddMoreServicesSheet
 *
 * PURPOSE: Stacked bottom sheet for adding more services during booking details stage
 *          Appears on top of the booking details sheet
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SERVICE_CATEGORIES } from "@/constants/services";
import { BorderRadius, Layout, Shadows } from "@/constants/theme";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

export interface AddMoreServicesSheetRef {
  open: () => void;
  close: () => void;
}

interface AddMoreServicesSheetProps {
  /** Called when sheet is closed */
  onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AddMoreServicesSheet = forwardRef<AddMoreServicesSheetRef, AddMoreServicesSheetProps>(
  function AddMoreServicesSheet({ onClose }, ref) {
    // ═══════════════ REFS ═══════════════
    const bottomSheetRef = useRef<BottomSheet>(null);

    // ═══════════════ HOOKS ═══════════════
    const insets = useSafeAreaInsets();

    // ═══════════════ LOCAL STATE ═══════════════
    const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("basic_maintenance");
    // Track newly selected services in this session (for the "Add X More" button)
    const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);

    // ═══════════════ STORE ═══════════════
    const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
    const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
    const availableServices = useBookingStore((state) => state.availableServices);

    // ═══════════════ SNAP POINTS ═══════════════
    const snapPoints = useMemo(() => ["85%"], []);

    // ═══════════════ COMPUTED VALUES ═══════════════
    const filteredServices = useMemo(() => {
      return availableServices.filter((service) => service.category === selectedCategory);
    }, [availableServices, selectedCategory]);

    // Calculate newly added services count and total
    const newlyAddedServices = useMemo(() => {
      return selectedServiceIds.filter((id) => !initialSelectedIds.includes(id));
    }, [selectedServiceIds, initialSelectedIds]);

    const newlyAddedTotal = useMemo(() => {
      return availableServices
        .filter((service) => newlyAddedServices.includes(service.id))
        .reduce((total, service) => total + service.price, 0);
    }, [availableServices, newlyAddedServices]);

    // ═══════════════ IMPERATIVE HANDLE ═══════════════
    useImperativeHandle(ref, () => ({
      open: () => {
        // Store current selection when opening
        setInitialSelectedIds([...selectedServiceIds]);
        setSelectedCategory("basic_maintenance");
        bottomSheetRef.current?.snapToIndex(0);
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

    // ═══════════════ HANDLERS ═══════════════
    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose?.();
        }
      },
      [onClose]
    );

    const handleCancel = useCallback(() => {
      // Revert any newly added services
      newlyAddedServices.forEach((id) => {
        toggleServiceSelection(id);
      });
      bottomSheetRef.current?.close();
    }, [newlyAddedServices, toggleServiceSelection]);

    const handleConfirm = useCallback(() => {
      bottomSheetRef.current?.close();
    }, []);

    const handleServicePress = useCallback(
      (serviceId: string) => {
        toggleServiceSelection(serviceId);
      },
      [toggleServiceSelection]
    );

    const handleCategorySelect = useCallback((category: ServiceCategory) => {
      setSelectedCategory(category);
    }, []);

    // ═══════════════ RENDER HELPERS ═══════════════
    const renderBackdrop = useCallback(
      (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
      []
    );

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
      [selectedCategory, handleCategorySelect]
    );

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
            </View>
          </TouchableOpacity>
        );
      },
      [selectedServiceIds, handleServicePress]
    );

    // ═══════════════ RENDER ═══════════════
    return (
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handleContainer}
        onChange={handleSheetChange}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text size="lg" weight="bold" color={BrandColors.primary}>
              Add More Services
            </Text>
          </View>

          {/* Category Tabs */}
          <View style={styles.categoryTabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {SERVICE_CATEGORIES.map(renderCategoryTab)}
            </ScrollView>
          </View>

          {/* Service List - Spacer ensures all items scroll above footer */}
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

            {/* Spacer to ensure content scrolls above the footer buttons */}
            <View style={styles.footerSpacer} />
          </BottomSheetScrollView>

          {/* Footer Buttons */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.7}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Cancel
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              style={[styles.confirmButton, newlyAddedServices.length === 0 && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={newlyAddedServices.length === 0}
            >
              <Text size="md" weight="semiBold" color={BrandColors.white}>
                {newlyAddedServices.length > 0
                  ? `Add ${newlyAddedServices.length} More • $${newlyAddedTotal}`
                  : "Select Services"}
              </Text>
            </PrimaryButton>
          </View>
        </View>
      </BottomSheet>
    );
  }
);

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
    backgroundColor: "#E5E7EB",
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
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
    marginRight: Spacing.md,
  },
  servicePriceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyState: {
    paddingVertical: Spacing["3xl"],
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
  confirmButton: {
    flex: 1.5,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  footerSpacer: {
    // Height to ensure content scrolls above the footer buttons
    height: Layout.actionButtonHeight + Layout.scrollBuffer,
  },
});

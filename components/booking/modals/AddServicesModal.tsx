/**
 * AddServicesModal
 *
 * PURPOSE: Full-screen modal for adding/editing services during mechanic detail view.
 *          Uses React Native Modal for reliable rendering outside scroll containers.
 *
 * FLOW: Booking
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id]/index.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface AddServicesModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddServicesModal({ visible, onClose }: AddServicesModalProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ LOCAL STATE ═══════════════
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("basic_maintenance");
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);

  // ═══════════════ STORE ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const getServiceCategories = useBookingStore((state) => state.getServiceCategories);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const filteredServices = useMemo(() => {
    return availableServices.filter((service) => service.category === selectedCategory);
  }, [availableServices, selectedCategory]);

  // Calculate newly added services count
  const newlyAddedServices = useMemo(() => {
    return selectedServiceIds.filter((id) => !initialSelectedIds.includes(id));
  }, [selectedServiceIds, initialSelectedIds]);

  // ═══════════════ HANDLERS ═══════════════
  const handleModalShow = useCallback(() => {
    // Store current selection when opening
    setInitialSelectedIds([...selectedServiceIds]);
    setSelectedCategory("basic_maintenance");
  }, [selectedServiceIds]);

  const handleCancel = useCallback(() => {
    // Revert any newly added services
    newlyAddedServices.forEach((id) => {
      toggleServiceSelection(id);
    });
    onClose();
  }, [newlyAddedServices, toggleServiceSelection, onClose]);

  const handleConfirm = useCallback(() => {
    onClose();
  }, [onClose]);

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
        </TouchableOpacity>
      );
    },
    [selectedServiceIds, handleServicePress]
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
      onShow={handleModalShow}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleCancel} activeOpacity={0.7}>
            <X size={24} color={BrandColors.primary} />
          </TouchableOpacity>
          <Text size="lg" weight="bold" color={BrandColors.primary}>
            Add More Services
          </Text>
          <View style={styles.headerSpacer} />
        </View>

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

        {/* Service List */}
        <ScrollView
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
        </ScrollView>

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
                ? `Add ${newlyAddedServices.length} Service${newlyAddedServices.length > 1 ? "s" : ""}`
                : "Select Services"}
            </Text>
          </PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
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
    paddingBottom: Spacing.xl,
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
    ...Shadows.sm,
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
});

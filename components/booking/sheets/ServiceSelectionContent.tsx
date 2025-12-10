/**
 * ServiceSelectionContent
 *
 * PURPOSE: Displays the service selection UI for the booking bottom sheet
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius, FontFamily } from "@/constants/theme";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { Check, Search } from "lucide-react-native";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Service category display names and order */
const SERVICE_CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: "basic_maintenance", label: "Basic\nMaintenance" },
  { key: "tires_wheels", label: "Tires &\nWheels" },
  { key: "brakes_suspension", label: "Brakes &\nSuspension" },
  { key: "system_diagnostics", label: "System\nDiagnostics" },
];

// ============================================================================
// TYPES
// ============================================================================

interface ServiceSelectionContentProps {
  /** Called when user confirms service selection */
  onSelectServices?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionContent({ onSelectServices }: ServiceSelectionContentProps) {
  // ═══════════════ STATE-EFFECT: Local State ═══════════════
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("basic_maintenance");

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal);
  const getSelectedServicesCount = useBookingStore((state) => state.getSelectedServicesCount);

  // ═══════════════ STATE-EFFECT: Computed Values ═══════════════
  const selectedCount = getSelectedServicesCount();
  const selectedTotal = getSelectedServicesTotal();
  const hasSelection = selectedCount > 0;

  // ═══════════════ STATE-EFFECT: Memoized Values ═══════════════
  const filteredServices = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return availableServices.filter(
        (service) => service.name.toLowerCase().includes(query) || service.description.toLowerCase().includes(query)
      );
    }
    return availableServices.filter((service) => service.category === selectedCategory);
  }, [availableServices, selectedCategory, searchQuery]);

  // ═══════════════ STATE-EFFECT: Handlers ═══════════════
  const handleServicePress = useCallback(
    (serviceId: string) => {
      toggleServiceSelection(serviceId);
    },
    [toggleServiceSelection]
  );

  const handleSelectPress = useCallback(() => {
    onSelectServices?.();
  }, [onSelectServices]);

  const handleCategorySelect = useCallback((category: ServiceCategory) => {
    setSelectedCategory(category);
    setSearchQuery("");
  }, []);

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderCategoryTab = useCallback(
    (category: { key: ServiceCategory; label: string }) => {
      const isActive = selectedCategory === category.key && !searchQuery.trim();

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
    [selectedCategory, searchQuery, handleCategorySelect]
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
          {SERVICE_CATEGORIES.map(renderCategoryTab)}
        </ScrollView>
      </View>

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
      <BottomSheetScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
      <View style={styles.buttonContainer}>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    marginBottom: 80,
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



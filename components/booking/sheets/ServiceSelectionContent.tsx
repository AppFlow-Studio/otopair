/**
 * ServiceSelectionContent
 *
 * PURPOSE: Displays the service selection UI for the booking bottom sheet
 *          Button is rendered separately in ServiceBottomSheet for proper positioning
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Search } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SERVICE_CATEGORIES } from "@/constants/services";
import { BorderRadius, FontFamily, Layout } from "@/constants/theme";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// CONSTANTS
// ============================================================================

// No local constants needed - using centralized Layout from theme

// ============================================================================
// TYPES
// ============================================================================

// No props needed - button is rendered in ServiceBottomSheet

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceSelectionContent() {
  // ═══════════════ STATE-EFFECT: Local State ═══════════════
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("basic_maintenance");

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const availableServices = useBookingStore((state) => state.availableServices);

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
          </View>
        </TouchableOpacity>
      );
    },
    [selectedServiceIds, handleServicePress]
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      {/* Header - Fixed at top */}
      <View style={styles.header}>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Select Services
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

      {/* Service List - Scrollable content with bottom padding for footer */}
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

        {/* Spacer to ensure content scrolls above the footer button */}
        <View style={styles.footerSpacer} />
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
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
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
    gap: Spacing.md,
    // Note: paddingBottom is applied dynamically based on safe area insets
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
  footerSpacer: {
    // Height to ensure content scrolls above the footer button
    height: Layout.actionButtonHeight + Layout.tabBarHeight + Layout.scrollBuffer,
  },
});

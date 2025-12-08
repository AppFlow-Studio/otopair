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
 * OWNER: Dev 3
 */

import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
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
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBottomSheet({ onSelectServices }: ServiceBottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const insets = useSafeAreaInsets();

  // Store state and actions
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((state) => state.toggleServiceSelection);
  const getServicesByCategory = useBookingStore((state) => state.getServicesByCategory);
  const getSelectedServicesTotal = useBookingStore((state) => state.getSelectedServicesTotal);
  const getSelectedServicesCount = useBookingStore((state) => state.getSelectedServicesCount);

  // Snap points for bottom sheet
  const snapPoints = useMemo(() => ["22%", "75%"], []);

  // Present the modal when screen is focused, dismiss when unfocused
  useFocusEffect(
    useCallback(() => {
      // Present when screen gains focus
      bottomSheetRef.current?.present();

      // Dismiss when screen loses focus
      return () => {
        bottomSheetRef.current?.dismiss();
      };
    }, [])
  );

  // Get services filtered by category and search
  const filteredServices = useMemo(() => {
    const categoryServices = getServicesByCategory();
    if (!searchQuery.trim()) return categoryServices;

    const query = searchQuery.toLowerCase();
    return categoryServices.filter(
      (service) => service.name.toLowerCase().includes(query) || service.description.toLowerCase().includes(query)
    );
  }, [getServicesByCategory, searchQuery]);

  // Computed values
  const selectedCount = getSelectedServicesCount();
  const selectedTotal = getSelectedServicesTotal();
  const hasSelection = selectedCount > 0;

  // Handlers
  const handleServicePress = useCallback(
    (serviceId: string) => {
      toggleServiceSelection(serviceId);
    },
    [toggleServiceSelection]
  );

  const handleSelectPress = useCallback(() => {
    onSelectServices?.();
  }, [onSelectServices]);

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
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      enablePanDownToClose={false}
      enableOverDrag={true}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
      stackBehavior="push"
    >
      {/* Collapsed State Text */}
      <View style={styles.collapsedContent}>
        <Text size="lg" weight="medium" color={BrandColors.primary} center>
          Swipe up for service list
        </Text>
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
    </BottomSheetModal>
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

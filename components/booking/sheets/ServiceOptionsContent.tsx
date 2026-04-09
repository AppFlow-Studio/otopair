/**
 * ServiceOptionsContent
 *
 * PURPOSE: Displays service option selection UI for the booking bottom sheet.
 *          For each selected service that has options (e.g. Brake Pad Replacement → axle_position),
 *          shows radio-style cards so the user picks one option per service.
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ChevronLeft } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import { useServiceOptionsForSelected } from "@/hooks/useServiceOptionsForSelected";
import type { ServiceOptionItem } from "@/hooks/useServiceOptionsForSelected";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// HELPERS
// ============================================================================

/** Format option_type for display: "axle_position" → "Select axle position" */
function formatOptionType(optionType: string): string {
  const label = optionType.replace(/_/g, " ");
  return `Select ${label}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface ServiceOptionsContentProps {
  onGoBack: () => void;
}

export function ServiceOptionsContent({ onGoBack }: ServiceOptionsContentProps) {
  // ═══════════════ HOOKS ═══════════════
  const { servicesWithOptions, isLoading } = useServiceOptionsForSelected();
  const selectedServiceOptions = useBookingStore((s) => s.selectedServiceOptions);
  const setSelectedServiceOption = useBookingStore((s) => s.setSelectedServiceOption);

  // ═══════════════ HANDLERS ═══════════════
  const handleSelectOption = useCallback(
    (serviceId: string, option: ServiceOptionItem) => {
      setSelectedServiceOption(serviceId, {
        optionId: option._id,
        labor_hours: option.labor_hours,
        parts_cost_avg: (option.parts_cost_low + option.parts_cost_high) / 2,
        state_fee: option.state_fee,
      });
    },
    [setSelectedServiceOption],
  );

  // ═══════════════ RENDER ═══════════════
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text size="sm" weight="medium" color="#6B7280">
          Loading options...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onGoBack} hitSlop={8}>
          <ChevronLeft size={24} color={BrandColors.primary} />
        </Pressable>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          Option Selection
        </Text>
        {/* Spacer to balance the back button */}
        <View style={styles.headerSpacer} />
      </View>

      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableFooterMarginAdjustment
      >
        {servicesWithOptions.map((service) => {
          const selectedOption = selectedServiceOptions[service.serviceId];

          return (
            <View key={service.serviceId} style={styles.serviceSection}>
              {/* Service Name Header */}
              <Text size="lg" weight="bold" color={BrandColors.primary}>
                {service.serviceName}
              </Text>

              {/* Option Type Label */}
              <Text size="sm" weight="medium" color="#6B7280" style={styles.optionTypeLabel}>
                {formatOptionType(service.options[0]?.option_type ?? "")}
              </Text>

              {/* Option Cards */}
              <View style={styles.optionsContainer}>
                {service.options.map((option) => {
                  const isSelected = selectedOption?.optionId === option._id;
                  return (
                    <OptionCard
                      key={option._id}
                      option={option}
                      isSelected={isSelected}
                      onSelect={() => handleSelectOption(service.serviceId, option)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

      </BottomSheetScrollView>
    </View>
  );
}

// ============================================================================
// OPTION CARD
// ============================================================================

interface OptionCardProps {
  option: ServiceOptionItem;
  isSelected: boolean;
  onSelect: () => void;
}

function OptionCard({ option, isSelected, onSelect }: OptionCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
    >
      <View style={styles.optionContent}>
        <Text size="md" weight={isSelected ? "semiBold" : "regular"} color={BrandColors.primary}>
          {option.option_label}
        </Text>
      </View>

      {/* Selection indicator */}
      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
        {isSelected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  serviceSection: {
    marginBottom: Spacing["2xl"],
  },
  optionTypeLabel: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionCard: {
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
  optionCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
  },
  optionContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: BrandColors.secondary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.secondary,
  },
});

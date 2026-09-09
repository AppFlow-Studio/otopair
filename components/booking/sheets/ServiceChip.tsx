/**
 * ServiceChip
 *
 * PURPOSE: Displays a selected service as a removable chip in the mechanic selection flow
 *
 * USED IN: components/booking/sheets/MechanicSelectionContent.tsx
 *
 * PROPS:
 *   - service (Service): The service data to display
 *   - onRemove ((serviceId: string) => void): Called when remove button is pressed [optional]
 *
 * EXAMPLE:
 *   <ServiceChip service={selectedService} onRemove={handleRemove} />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo, useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { Wrench, X } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, Shadows } from "@/constants/theme";
import type { Service } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceChipProps {
  /** The service to display */
  service: Service;
  /** Called when remove button is pressed */
  onRemove?: (serviceId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ServiceChip = memo(function ServiceChip({ service, onRemove }: ServiceChipProps) {
  const handleRemove = useCallback(() => {
    onRemove?.(service.id);
  }, [onRemove, service.id]);

  return (
    <View style={styles.container}>
      {/* Service Icon */}
      <View style={styles.iconContainer}>
        <Wrench size={16} color="#6B7280" />
      </View>

      {/* Service Info */}
      <View style={styles.textContainer}>
        <Text size="sm" weight="semiBold" color={BrandColors.primary}>
          {service.name}
        </Text>
        <Text size="xs" weight="regular" color="#6B7280">
          {service.description}
        </Text>
      </View>

      {/* Remove Button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={handleRemove}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={14} color={BrandColors.white} />
      </TouchableOpacity>
    </View>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    marginRight: Spacing.sm,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  textContainer: {
    marginRight: Spacing.sm,
  },
  removeButton: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

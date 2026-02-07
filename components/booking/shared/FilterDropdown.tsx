/**
 * FilterDropdown
 *
 * PURPOSE: A modal dropdown menu for selecting filter options,
 *          typically used for sorting/filtering shop listings
 *
 * USED IN: components/booking/TopBar.tsx
 *
 * PROPS:
 *   - visible (boolean): Controls modal visibility
 *   - options (FilterDropdownOption[]): Array of filter options to display
 *   - onSelect ((id: string) => void): Called when an option is selected
 *   - onDismiss (() => void): Called when modal is dismissed
 *
 * EXAMPLE:
 *   <FilterDropdown
 *     visible={isFilterOpen}
 *     options={SHOP_FILTER_OPTIONS}
 *     onSelect={handleFilterSelect}
 *     onDismiss={handleFilterDismiss}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

// 2. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 3. Constants
import { BorderRadius, Shadows } from "@/constants/theme";

// 4. SwiftUI Components
// ============================================================================
// TYPES
// ============================================================================

export interface FilterDropdownOption {
  /** Unique identifier for the option */
  id: string;
  /** Display label for the option */
  label: string;
}

export interface FilterDropdownProps {
  /** Controls modal visibility */
  visible: boolean;
  /** Array of filter options to display */
  options: FilterDropdownOption[];
  /** Called when an option is selected */
  onSelect: (id: string) => void;
  /** Called when modal is dismissed */
  onDismiss: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FilterDropdown({ visible, options, onSelect, onDismiss }: FilterDropdownProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.modalOverlay} onPress={onDismiss}>
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdown}>
            {options.map((option, index) => (
              <React.Fragment key={option.id}>
                <Pressable style={styles.dropdownOption} onPress={() => onSelect(option.id)}>
                  <Text size="md" weight="medium" color={BrandColors.primary}>
                    {option.label}
                  </Text>
                </Pressable>
                {index < options.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dropdownContainer: {
    position: "absolute",
    top: "13%",
    right: Spacing.lg,
  },
  dropdown: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xs,
    ...Shadows.lg,
  },
  dropdownOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginHorizontal: Spacing.sm,
  },
});





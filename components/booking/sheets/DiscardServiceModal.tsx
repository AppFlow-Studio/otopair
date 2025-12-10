/**
 * DiscardServiceModal
 *
 * PURPOSE: Confirmation modal for removing a selected service from the booking flow
 *
 * USED IN: components/booking/sheets/MechanicSelectionContent.tsx
 *
 * PROPS:
 *   - visible (boolean): Whether the modal is visible
 *   - onClose (() => void): Called when modal is dismissed
 *   - onConfirm (() => void): Called when user confirms removal
 *   - onDontAskAgain (() => void): Called when "Don't ask again" is tapped [optional]
 *
 * EXAMPLE:
 *   <DiscardServiceModal
 *     visible={showModal}
 *     onClose={() => setShowModal(false)}
 *     onConfirm={handleConfirmRemove}
 *     onDontAskAgain={handleDontAskAgain}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { Trash2 } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, Shadows } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

interface DiscardServiceModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal is dismissed */
  onClose: () => void;
  /** Called when user confirms removal */
  onConfirm: () => void;
  /** Called when "Don't ask again" is toggled */
  onDontAskAgain?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DiscardServiceModal({ visible, onClose, onConfirm, onDontAskAgain }: DiscardServiceModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Trash2 size={32} color="#EF4444" />
          </View>

          {/* Title */}
          <Text size="xl" weight="bold" color={BrandColors.primary} style={styles.title}>
            Discard Selected{"\n"}Service?
          </Text>

          {/* Description */}
          <Text size="sm" weight="regular" color="#6B7280" style={styles.description}>
            You can always go back and select other services from the service selection screen if you want.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Cancel
              </Text>
            </TouchableOpacity>

            <PrimaryButton style={styles.removeButton} onPress={onConfirm}>
              <Text size="md" weight="semiBold" color={BrandColors.white}>
                Remove
              </Text>
            </PrimaryButton>
          </View>

          {/* Don't ask again */}
          <TouchableOpacity style={styles.dontAskButton} onPress={onDontAskAgain} activeOpacity={0.7}>
            <Text size="sm" weight="medium" color="#6B7280" style={styles.dontAskText}>
              Don't ask again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  container: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.lg,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    ...Shadows.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
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
  removeButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    backgroundColor: "#EF4444",
  },
  dontAskButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  dontAskText: {
    textDecorationLine: "underline",
  },
});

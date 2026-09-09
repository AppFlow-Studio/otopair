/**
 * ErrorOccurredModal
 *
 * Modal shown when an error occurs (e.g. booking failed, slot taken, app crash).
 * Matches the style of DiscardServiceModal - centered white card with overlay.
 *
 * USED IN: Error boundary fallback, payment/booking error handling
 */

import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { AlertCircle } from "lucide-react-native";

import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";
import { PrimaryButton } from "./Button";
import { Text } from "./Text";

interface ErrorOccurredModalProps {
  visible: boolean;
  onClose: () => void;
  /** Optional "Try again" callback - hides that button if not provided */
  onRetry?: () => void;
  title?: string;
  message?: string;
  /** When true, uses a subtle overlay so it feels like the error is handled in-context on the page */
  inline?: boolean;
}

export function ErrorOccurredModal({
  visible,
  onClose,
  onRetry,
  title = "An error occurred",
  message = "Something went wrong. Please try again.",
  inline = false,
}: ErrorOccurredModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, inline && styles.overlayInline]}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <AlertCircle size={32} color="#EF4444" />
          </View>

          <Text size="xl" weight="bold" color={BrandColors.primary} style={styles.title}>
            {title}
          </Text>

          <Text size="sm" weight="regular" color="#6B7280" style={styles.description}>
            {message}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                {onRetry ? "Dismiss" : "OK"}
              </Text>
            </TouchableOpacity>

            {onRetry && (
              <PrimaryButton style={styles.retryButton} onPress={onRetry}>
                <Text size="md" weight="semiBold" color={BrandColors.white}>
                  Try again
                </Text>
              </PrimaryButton>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  overlayInline: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
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
  retryButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
});

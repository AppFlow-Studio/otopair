/**
 * CantLoadModal — shown when a screen requests data that isn't cached this
 * session and we're offline. Page-agnostic: one component covers every screen.
 * Copy is locked by the spec — do not paraphrase.
 */
import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { WifiOff } from "lucide-react-native";

import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";
import { PrimaryButton, Text } from "@/components/shared-ui";

interface CantLoadModalProps {
  visible: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function CantLoadModal({ visible, onRetry, onDismiss }: CantLoadModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <WifiOff size={32} color={BrandColors.primary} />
          </View>

          <Text size="xl" weight="bold" color={BrandColors.primary} style={styles.title}>
            Can&apos;t load this right now
          </Text>

          <Text size="sm" weight="regular" color="#6B7280" style={styles.description}>
            This needs a connection — we&apos;ll load it as soon as you&apos;re back online.
          </Text>

          <View style={styles.buttonColumn}>
            <PrimaryButton style={styles.retryButton} onPress={onRetry}>
              <Text size="md" weight="semiBold" color={BrandColors.white}>
                Retry
              </Text>
            </PrimaryButton>

            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.7}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                Dismiss · back to last page
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 28, 36, 0.45)",
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: { textAlign: "center", marginBottom: Spacing.md },
  description: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  buttonColumn: { width: "100%", gap: Spacing.md },
  retryButton: { borderRadius: BorderRadius.lg, paddingVertical: Spacing.md },
  dismissButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
});

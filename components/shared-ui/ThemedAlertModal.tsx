/**
 * ThemedAlertModal
 *
 * PURPOSE: An Alert.alert-style dialog in the app's own confirm-modal look
 * (DiscardServiceModal): centered white card on a blurred backdrop, optional
 * icon chip, outlined Cancel, red destructive button. Shown by `themedAlert`
 * (lib/themed-alert.tsx) wherever the native alert looks out of place.
 *
 * With `input` it is Alert.prompt instead: a text field above the buttons,
 * and each button's onPress gets the typed text (themedPrompt).
 *
 * USED IN: lib/themed-alert.tsx (ThemedAlertHost)
 */

import React, { useEffect, useRef, useState } from "react";
import {
  type AlertButton,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import type { LucideIcon } from "lucide-react-native";

import { BorderRadius, BrandColors, FontFamily, Shadows, Spacing } from "@/constants/theme";
import { PrimaryButton } from "./Button";
import { Text } from "./Text";

interface ThemedAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: readonly AlertButton[];
  icon?: LucideIcon;
  /** Shows a text field seeded with `defaultValue` (Alert.prompt). */
  input?: { defaultValue: string };
  /** Called with the button the user tapped, and the field's text when `input` is set. */
  onPress: (button: AlertButton, value?: string) => void;
  /** Android back button, or a tap outside the card when `dismissible`. */
  onDismiss: () => void;
  dismissible?: boolean;
}

const DESTRUCTIVE = "#EF4444";
// A centered card would sit behind the keyboard the text field opens, so a
// prompt hangs from the upper part of the screen instead.
const PROMPT_TOP = Dimensions.get("window").height * 0.18;

export function ThemedAlertModal({
  visible,
  title,
  message,
  buttons,
  icon: Icon,
  input,
  onPress,
  onDismiss,
  dismissible = false,
}: ThemedAlertModalProps) {
  const [value, setValue] = useState(input?.defaultValue ?? "");
  const inputRef = useRef<TextInput>(null);
  // Reseed on every open: the host keeps one modal and swaps its content.
  useEffect(() => {
    if (visible && input) setValue(input.defaultValue);
  }, [visible, input]);

  // Like the native alert: two buttons side by side with Cancel first, more
  // than two stacked with Cancel last.
  const stacked = buttons.length > 2;
  const cancels = buttons.filter((b) => b.style === "cancel");
  const others = buttons.filter((b) => b.style !== "cancel");
  const ordered = stacked ? [...others, ...cancels] : [...cancels, ...others];
  const destructive = buttons.some((b) => b.style === "destructive");
  const press = (button: AlertButton) => onPress(button, input ? value : undefined);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
      // Focus the field once the dialog is up. autoFocus ran before Android's
      // dialog window had focus: the field was focused but no keyboard opened.
      onShow={() => inputRef.current?.focus()}
    >
      <View style={[styles.overlay, input && styles.overlayPrompt]}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissible ? onDismiss : undefined}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={styles.container} accessibilityViewIsModal>
          {Icon && (
            <View style={[styles.iconContainer, !destructive && styles.iconContainerNeutral]}>
              <Icon size={32} color={destructive ? DESTRUCTIVE : BrandColors.primary} />
            </View>
          )}

          <Text size="xl" weight="bold" color={BrandColors.primary} style={styles.title} accessibilityRole="header">
            {title}
          </Text>

          {!!message && (
            <Text size="sm" weight="regular" color="#6B7280" style={styles.description}>
              {message}
            </Text>
          )}

          {input && (
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={setValue}
              selectTextOnFocus
              returnKeyType="done"
              // Return taps the action button, like the native prompt.
              onSubmitEditing={() => {
                if (others[0]) press(others[0]);
              }}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          )}

          <View
            style={[
              styles.buttonRow,
              stacked && styles.buttonColumn,
              !message && !input && styles.buttonRowNoMessage,
            ]}
          >
            {ordered.map((button, i) =>
              button.style === "cancel" ? (
                <TouchableOpacity
                  key={`${button.text}-${i}`}
                  style={[styles.button, styles.cancelButton, stacked && styles.buttonStacked]}
                  onPress={() => press(button)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text size="md" weight="semiBold" color={BrandColors.primary}>
                    {button.text ?? "Cancel"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <PrimaryButton
                  key={`${button.text}-${i}`}
                  style={[
                    styles.button,
                    button.style === "destructive" && styles.destructiveButton,
                    stacked && styles.buttonStacked,
                  ]}
                  onPress={() => press(button)}
                >
                  <Text size="md" weight="semiBold" color={BrandColors.white}>
                    {button.text ?? "OK"}
                  </Text>
                </PrimaryButton>
              ),
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
  overlayPrompt: {
    justifyContent: "flex-start",
    paddingTop: PROMPT_TOP,
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
  iconContainerNeutral: {
    backgroundColor: "#F3F4F6",
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
  input: {
    alignSelf: "stretch",
    height: 48,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: BrandColors.primary,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
  },
  buttonRowNoMessage: {
    marginTop: Spacing.sm,
  },
  buttonColumn: {
    flexDirection: "column",
  },
  button: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  buttonStacked: {
    flex: 0,
    width: "100%",
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
  destructiveButton: {
    backgroundColor: DESTRUCTIVE,
  },
});

/**
 * MileageEditModal — small inline modal for updating a vehicle's
 * current odometer reading.
 *
 * Used by the Cars page's "Edit Maintenance Info" sheet when the
 * user picks the Mileage row. Cross-platform friendly: a centered
 * card with a numeric TextInput + Save/Cancel buttons. Validates
 * the input and forwards a clean integer mileage to the parent
 * `onSave` handler.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Text } from "@/components/shared-ui";

const INK = "#0F172A";
const MUTED = "#6B7280";
const ACCENT = "#5299FE";

interface MileageEditModalProps {
  visible: boolean;
  initialMileage: number | null;
  onClose: () => void;
  /** Called with a positive integer mileage. Parent handles the
   *  mutation; modal stays open while the promise resolves so we
   *  can show a spinner. Throw to keep the modal open with an
   *  error toast outside; resolve to close. */
  onSave: (mileage: number) => Promise<void>;
}

export function MileageEditModal({
  visible,
  initialMileage,
  onClose,
  onSave,
}: MileageEditModalProps) {
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState<string>(
    initialMileage != null ? String(Math.round(initialMileage)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on every open so the field reflects the latest stored
  // value and the user doesn't see stale text from a prior open.
  useEffect(() => {
    if (visible) {
      setValue(initialMileage != null ? String(Math.round(initialMileage)) : "");
      setError(null);
      setSaving(false);
      // Autofocus after the modal animates in.
      const id = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(id);
    }
  }, [visible, initialMileage]);

  const handleSave = async () => {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (cleaned.length === 0) {
      setError("Enter a mileage value.");
      return;
    }
    const parsed = parseInt(cleaned, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid mileage.");
      return;
    }
    if (parsed > 9_999_999) {
      setError("Mileage looks too high. Double-check.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(parsed);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={saving ? undefined : onClose}>
        {/* Stop tap-to-dismiss from firing when the user taps inside the card. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.center}
          pointerEvents="box-none"
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <Text weight="bold" size="lg" color={INK} style={styles.title}>
              Update mileage
            </Text>
            <Text size="sm" color={MUTED} style={styles.subtitle}>
              Enter your car's current odometer reading.
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(t) => {
                  setValue(t.replace(/[^0-9]/g, ""));
                  if (error) setError(null);
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                editable={!saving}
                maxLength={7}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel="Mileage"
              />
              <Text weight="semiBold" size="md" color={MUTED} style={styles.unit}>
                mi
              </Text>
            </View>

            {error ? (
              <Text size="sm" color="#EF4444" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnCancel,
                  pressed && !saving && styles.btnPressed,
                ]}
              >
                <Text weight="semiBold" size="md" color={INK}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnSave,
                  pressed && !saving && styles.btnPressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text weight="bold" size="md" color="#FFFFFF">
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  center: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Urbanist-SemiBold",
    color: "#0F172A",
    paddingVertical: 2,
  },
  unit: {
    paddingLeft: 4,
  },
  error: {
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: {
    backgroundColor: "rgba(15, 23, 42, 0.06)",
  },
  btnSave: {
    backgroundColor: ACCENT,
  },
  btnPressed: {
    opacity: 0.85,
  },
});

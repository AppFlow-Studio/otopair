/**
 * VehicleRoleSheet
 *
 * Bottom sheet for picking a vehicle's role (garageRole). Preset chips +
 * a custom entry + Skip/Clear. Fully optional. "Primary" is special — it
 * designates the default car shown on app reopen (handled by the caller's
 * setVehicleRole mutation).
 *
 * Built on the project-standard FloatingSheet (blur backdrop, grabber,
 * drag-to-dismiss) so it matches the app's other bottom sheets.
 */

import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Spacing } from "@/constants/theme";
import { scale, moderateScale } from "@/utils/responsive";

const PRESET_ROLES = ["Primary", "Secondary", "Commuter", "Family", "Weekend", "Work"];

// Snap height sized to the content (title + 2 chip rows + custom row +
// footer) so there's no blank space. The sheet lifts with the keyboard, so
// it doesn't need to be tall to keep the custom input visible.
const SHEET_HEIGHT = 360;

interface VehicleRoleSheetProps {
  visible: boolean;
  currentRole?: string | null;
  vehicleName?: string;
  onClose: () => void;
  /** role string, or null to clear the role */
  onSelect: (role: string | null) => void;
}

export function VehicleRoleSheet({
  visible,
  currentRole,
  vehicleName,
  onClose,
  onSelect,
}: VehicleRoleSheetProps) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [custom, setCustom] = useState("");

  // Open the FloatingSheet when the parent flips `visible`. The sheet
  // closes itself (backdrop tap / drag / a pick) and reports via onClose.
  useEffect(() => {
    if (visible) {
      setCustom("");
      sheetRef.current?.open();
    }
  }, [visible]);

  const normalizedCurrent = (currentRole ?? "").trim().toLowerCase();

  const pick = (role: string | null) => {
    onSelect(role);
    sheetRef.current?.close();
  };

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[SHEET_HEIGHT]}
      showBackdrop
      liftWithKeyboard
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text weight="bold" size="xl" color="#111827">
          What&apos;s this car&apos;s role?
        </Text>
        {vehicleName ? (
          <Text size="sm" color="#6B7280" style={styles.subtitle}>
            {vehicleName}
          </Text>
        ) : null}
        <Text size="xs" color="#9CA3AF" style={styles.hint}>
          Optional. &quot;Primary&quot; is the car the app opens to.
        </Text>

        <View style={styles.chips}>
          {PRESET_ROLES.map((r) => {
            const selected = normalizedCurrent === r.toLowerCase();
            return (
              <Pressable
                key={r}
                onPress={() => pick(r)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text weight="semiBold" size="sm" color={selected ? "#FFFFFF" : "#1F2937"}>
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder="Custom role…"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            returnKeyType="done"
            maxLength={24}
            onSubmitEditing={() => custom.trim() && pick(custom.trim())}
          />
          <Pressable
            disabled={!custom.trim()}
            onPress={() => pick(custom.trim())}
            style={[styles.addBtn, !custom.trim() && styles.addBtnDisabled]}
          >
            <Text weight="bold" size="sm" color="#FFFFFF">
              Add
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          {currentRole ? (
            <Pressable onPress={() => pick(null)} hitSlop={8}>
              <Text weight="semiBold" size="sm" color="#EF4444">
                Clear role
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={() => sheetRef.current?.close()} hitSlop={8}>
            <Text weight="semiBold" size="sm" color="#6B7280">
              Skip
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </FloatingSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: scale(4),
    paddingBottom: scale(20),
  },
  subtitle: {
    marginTop: scale(2),
  },
  hint: {
    marginTop: scale(6),
    marginBottom: scale(16),
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
  },
  chip: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: moderateScale(20),
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipSelected: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginTop: scale(16),
  },
  input: {
    flex: 1,
    height: scale(44),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: scale(14),
    fontSize: moderateScale(14),
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  addBtn: {
    paddingHorizontal: scale(18),
    height: scale(44),
    borderRadius: moderateScale(12),
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: scale(20),
  },
});

export default VehicleRoleSheet;

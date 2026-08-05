/**
 * VehicleRoleSheet
 *
 * Bottom sheet for picking a vehicle's role (garageRole). Primary is the
 * only role with a functional effect (default car on app reopen) — it gets
 * its own hero card. Everything else lives in a 3-col card grid, with a
 * custom-role input at the bottom.
 *
 * Built on the project-standard FloatingSheet (blur backdrop, grabber,
 * drag-to-dismiss, lift-with-keyboard) so it matches the app's other
 * bottom sheets.
 */

import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Briefcase, Car, Route, Star, Sun, Users } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Spacing } from "@/constants/theme";
import { moderateScale, scale } from "@/utils/responsive";

const SECONDARY_ROLES: Array<{ id: string; Icon: typeof Car }> = [
  { id: "Secondary", Icon: Car },
  { id: "Commuter", Icon: Route },
  { id: "Family", Icon: Users },
  { id: "Weekend", Icon: Sun },
  { id: "Work", Icon: Briefcase },
];

// Sized for the new layout: title block + primary hero + 2-row grid +
// custom input + footer. liftWithKeyboard handles the keyboard offset.
const SHEET_HEIGHT = 520;

const BLUE = "#5299FE";
const BLUE_BG = "#EEF4FF";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#6B7280";
const TEXT_MUTED = "#9CA3AF";

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

  useEffect(() => {
    if (visible) {
      setCustom("");
      sheetRef.current?.open();
    }
  }, [visible]);

  const normalizedCurrent = (currentRole ?? "").trim().toLowerCase();
  const isSelected = (id: string) => normalizedCurrent === id.toLowerCase();
  const primarySelected = isSelected("Primary");

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
      floatBottomInset={12}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Header */}
        <Text weight="bold" size="xl" color={TEXT_PRIMARY}>
          Pick a role for your car
        </Text>
        {vehicleName ? (
          <Text size="sm" color={TEXT_SECONDARY} style={styles.subtitle}>
            {vehicleName}
          </Text>
        ) : null}
        <Text size="xs" color={TEXT_MUTED} style={styles.hint}>
          Only &quot;Primary&quot; has an effect — it&apos;s the car the app opens to.
        </Text>

        {/* Primary hero */}
        <Pressable
          onPress={() => pick("Primary")}
          style={({ pressed }) => [
            styles.primaryCard,
            primarySelected && styles.primaryCardSelected,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.primaryIconCircle,
              primarySelected && styles.primaryIconCircleSelected,
            ]}
          >
            <Star
              size={scale(22)}
              color={primarySelected ? "#FFFFFF" : BLUE}
              fill={primarySelected ? "#FFFFFF" : "transparent"}
              strokeWidth={2}
            />
          </View>
          <View style={styles.primaryText}>
            <Text
              weight="bold"
              size="md"
              color={primarySelected ? BLUE : TEXT_PRIMARY}
            >
              Primary
            </Text>
            <Text size="xs" color={TEXT_SECONDARY} style={styles.primarySub}>
              Default car when you open the app
            </Text>
          </View>
        </Pressable>

        {/* Secondary grid */}
        <View style={styles.grid}>
          {SECONDARY_ROLES.map(({ id, Icon }) => {
            const sel = isSelected(id);
            return (
              <Pressable
                key={id}
                onPress={() => pick(id)}
                style={({ pressed }) => [
                  styles.gridCard,
                  sel && styles.gridCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  size={scale(22)}
                  color={sel ? BLUE : "#374151"}
                  strokeWidth={2}
                />
                <Text
                  weight={sel ? "bold" : "semiBold"}
                  size="sm"
                  color={sel ? BLUE : TEXT_PRIMARY}
                  style={styles.gridLabel}
                >
                  {id}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom row */}
        <Text
          size="xs"
          weight="semiBold"
          color={TEXT_SECONDARY}
          style={styles.customLabel}
        >
          CUSTOM ROLE
        </Text>
        <View style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder="e.g. Project car"
            placeholderTextColor={TEXT_MUTED}
            style={styles.input}
            returnKeyType="done"
            maxLength={24}
            onSubmitEditing={() => custom.trim() && pick(custom.trim())}
          />
          <Pressable
            disabled={!custom.trim()}
            onPress={() => pick(custom.trim())}
            style={({ pressed }) => [
              styles.addBtn,
              !custom.trim() && styles.addBtnDisabled,
              pressed && custom.trim() && styles.pressed,
            ]}
          >
            <Text weight="bold" size="sm" color="#FFFFFF">
              Add
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        {currentRole ? (
          <View style={styles.footer}>
            <Pressable onPress={() => pick(null)} hitSlop={8}>
              <Text weight="semiBold" size="sm" color="#EF4444">
                Clear role
              </Text>
            </Pressable>
          </View>
        ) : null}
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
  pressed: {
    opacity: 0.7,
  },

  // ── Primary hero ──────────────────────────────────────────────────
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(14),
    borderRadius: moderateScale(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    gap: scale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  primaryCardSelected: {
    backgroundColor: BLUE_BG,
    borderColor: BLUE,
  },
  primaryIconCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryIconCircleSelected: {
    backgroundColor: BLUE,
  },
  primaryText: {
    flex: 1,
  },
  primarySub: {
    marginTop: scale(2),
  },

  // ── Secondary grid ────────────────────────────────────────────────
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
    marginTop: scale(14),
  },
  gridCard: {
    // 3 columns with a ~10pt gap. Percentage tuned so 3 cards + 2 gaps
    // fit on a row across the common iPhone widths.
    width: "31%",
    aspectRatio: 1.15,
    borderRadius: moderateScale(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
  },
  gridCardSelected: {
    backgroundColor: BLUE_BG,
    borderColor: BLUE,
  },
  gridLabel: {
    textAlign: "center",
  },

  // ── Custom ────────────────────────────────────────────────────────
  customLabel: {
    marginTop: scale(20),
    marginBottom: scale(8),
    letterSpacing: 0.5,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  input: {
    flex: 1,
    height: scale(44),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: scale(16),
    fontSize: moderateScale(14),
    color: TEXT_PRIMARY,
    backgroundColor: "#F9FAFB",
  },
  addBtn: {
    paddingHorizontal: scale(20),
    height: scale(44),
    borderRadius: moderateScale(999),
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: {
    opacity: 0.4,
  },

  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: scale(20),
  },
});

export default VehicleRoleSheet;

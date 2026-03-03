/**
 * MaintenanceInputModal
 *
 * PURPOSE: Bottom-sheet-style modal to edit maintenance data for a single type.
 *          Questions match CarInfoStepper exactly so answers are interchangeable.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (triggered by "Add Info" / edit button)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  UIManager,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/shared-ui";
import { FontFamily, FontSize, Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MAINTENANCE_LABELS,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

const WARNING_LIGHT_FOR_TYPE: Partial<Record<MaintenanceType, string>> = {
  oil: "oil_pressure",
  battery: "battery_charging",
  brakes: "abs",
  tires: "tpms",
};

const WARNING_LIGHT_LABELS: Record<string, string> = {
  oil_pressure: "Oil pressure light",
  battery_charging: "Battery / charging light",
  abs: "ABS / brake warning light",
  tpms: "Tire pressure (TPMS) light",
};

// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceInputModalProps {
  visible: boolean;
  maintenanceType: MaintenanceType;
  vehicleOwnerId: Id<"vehicle_owners">;
  existingRecord?: {
    lastServiceDate?: number;
    lastServiceMileage?: number;
    customInputs?: Record<string, unknown>;
  };
  onClose: () => void;
  onSaved: () => void;
  vehicleYear?: number;
  knownIssues?: string[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MaintenanceInputModal({
  visible,
  maintenanceType,
  vehicleOwnerId,
  existingRecord,
  onClose,
  onSaved,
  vehicleYear,
  knownIssues,
}: MaintenanceInputModalProps) {
  const saveField = useMutation(api.vehicles.saveOnboardingField);
  const updateWarningLight = useMutation(api.vehicles.updateWarningLight);
  const label = MAINTENANCE_LABELS[maintenanceType];

  // ── Animation refs ─────────────────────────────────────────
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height + 10,
        duration: Platform.OS === "ios" ? e.duration ?? 250 : 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === "ios" ? (e as any).duration ?? 250 : 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardOffset]);

  // ── Form state (matches CarInfoStepper exactly) ────────────
  const [oilRecency, setOilRecency] = useState<string | null>(null);
  const [brakeFeel, setBrakeFeel] = useState<string | null>(null);
  const [tireOriginal, setTireOriginal] = useState<string | null>(null);
  const [batteryReplaced, setBatteryReplaced] = useState<string | null>(null);
  const [warningLightOn, setWarningLightOn] = useState(false);
  const [saving, setSaving] = useState(false);

  const relevantLight = WARNING_LIGHT_FOR_TYPE[maintenanceType];
  const lightLabel = relevantLight ? WARNING_LIGHT_LABELS[relevantLight] : undefined;

  // ── Open/close animations ──────────────────────────────────
  const openSheet = useCallback(() => {
    setModalVisible(true);
    sheetTranslateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: 0, tension: 40, friction: 12, useNativeDriver: false }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [sheetTranslateY, backdropOpacity]);

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    keyboardOffset.setValue(0);
    Animated.parallel([
      Animated.timing(sheetTranslateY, { toValue: SHEET_HEIGHT, duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [sheetTranslateY, backdropOpacity, keyboardOffset, onClose]);

  useEffect(() => {
    if (visible) {
      openSheet();
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(sheetTranslateY, { toValue: SHEET_HEIGHT, duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => { setModalVisible(false); });
    }
  }, [visible]);

  // ── Pre-fill from existing record ──────────────────────────
  useEffect(() => {
    if (existingRecord?.customInputs) {
      const ci = existingRecord.customInputs;
      setOilRecency((ci.recency as string) ?? null);
      setBrakeFeel((ci.feel as string) ?? null);
      setTireOriginal((ci.tireOriginal as string) ?? null);
      setBatteryReplaced((ci.batteryReplaced as string) ?? null);
    } else {
      setOilRecency(null);
      setBrakeFeel(null);
      setTireOriginal(null);
      setBatteryReplaced(null);
    }
    setWarningLightOn(relevantLight ? (knownIssues?.includes(relevantLight) ?? false) : false);
  }, [existingRecord, visible, maintenanceType, knownIssues, relevantLight]);

  // ── Validation ────────────────────────────────────────────
  const canSave = useMemo(() => {
    switch (maintenanceType) {
      case "oil":     return oilRecency !== null;
      case "brakes":  return brakeFeel !== null;
      case "tires":   return tireOriginal !== null;
      case "battery": return batteryReplaced !== null;
      default:        return false;
    }
  }, [maintenanceType, oilRecency, brakeFeel, tireOriginal, batteryReplaced]);

  // ── Save handler ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      switch (maintenanceType) {
        case "oil":
          await saveField({ vehicleOwnerId, field: "oil", value: { recency: oilRecency } });
          break;
        case "brakes":
          await saveField({ vehicleOwnerId, field: "brakes", value: { feel: brakeFeel } });
          break;
        case "tires":
          await saveField({ vehicleOwnerId, field: "tires", value: { original: tireOriginal } });
          break;
        case "battery":
          await saveField({ vehicleOwnerId, field: "battery", value: { replaced: batteryReplaced } });
          break;
      }

      if (relevantLight) {
        await updateWarningLight({
          vehicleOwnerId,
          lightId: relevantLight,
          isOn: warningLightOn,
        });
      }

      onSaved();
      closeSheet();
    } catch (err) {
      console.error("[MaintenanceInput] Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [
    maintenanceType, vehicleOwnerId,
    oilRecency, brakeFeel, tireOriginal, batteryReplaced,
    warningLightOn, relevantLight, updateWarningLight,
    saveField, onSaved, closeSheet,
  ]);

  // ── Render helpers ─────────────────────────────────────────

  const renderOptionCard = <T extends string>(
    value: T | null,
    setValue: (v: T) => void,
    options: { id: T; label: string; good?: boolean }[],
  ) => (
    <View style={styles.optionList}>
      {options.map((opt) => {
        const selected = value === opt.id;
        const isGood = opt.good && selected;
        return (
          <Pressable
            key={opt.id}
            style={[styles.optionCard, selected && styles.optionCardActive, isGood && styles.optionCardGood]}
            onPress={() => setValue(opt.id)}
          >
            <Text
              weight={selected ? "bold" : "semiBold"}
              size="md"
              color={selected ? (isGood ? "#166534" : "#1E40AF") : "#1F2937"}
              style={{ flex: 1 }}
            >
              {opt.label}
            </Text>
            {selected && <Ionicons name="checkmark-circle" size={22} color={isGood ? "#22C55E" : "#5299FE"} />}
          </Pressable>
        );
      })}
    </View>
  );

  // ── Render question content ────────────────────────────────
  const renderContent = () => {
    switch (maintenanceType) {
      case "oil":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Know when your last oil change was?</Text>
            {renderOptionCard(oilRecency, setOilRecency, [
              { id: "recently",   label: "Recently" },
              { id: "few_months", label: "A few months ago" },
              { id: "over_6mo",   label: "Over 6 months ago" },
              { id: "not_sure",   label: "Not sure" },
            ])}
          </View>
        );

      case "brakes":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">How do your brakes feel?</Text>
            {renderOptionCard(brakeFeel, setBrakeFeel, [
              { id: "fine",      label: "Fine", good: true },
              { id: "noise",     label: "They make noise" },
              { id: "soft_slow", label: "They feel soft or slow" },
            ])}
            {brakeFeel === "soft_slow" && (
              <Text weight="medium" size="sm" color="#DC2626">
                We{'\u2019'}ll flag this as urgent in your health report.
              </Text>
            )}
          </View>
        );

      case "tires":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Are these the original tires?</Text>
            {renderOptionCard(tireOriginal, setTireOriginal, [
              { id: "yes",      label: "Yes" },
              { id: "no",       label: "No" },
              { id: "not_sure", label: "Not sure" },
            ])}
          </View>
        );

      case "battery":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Has your battery ever been replaced?</Text>
            {renderOptionCard(batteryReplaced, setBatteryReplaced, [
              { id: "yes",      label: "Yes" },
              { id: "no",       label: "No" },
              { id: "not_sure", label: "Not sure" },
            ])}
          </View>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
      </Animated.View>

      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: Animated.add(sheetTranslateY, keyboardOffset) }] },
        ]}
      >
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text weight="bold" size="xl" color="#1F2937">{label}</Text>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}

          {/* Warning light toggle */}
          {relevantLight && lightLabel && (
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="semiBold" size="md" color="#1F2937">{lightLabel}</Text>
                  <Text weight="medium" size="xs" color="#6B7280">Is this light currently on in your dashboard?</Text>
                </View>
                <Switch
                  value={warningLightOn}
                  onValueChange={setWarningLightOn}
                  trackColor={{ false: "#E5E7EB", true: "#5299FE" }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              pressed && canSave && styles.saveButtonPressed,
            ]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Text weight="bold" size="md" color="#FFFFFF">
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>
          <Pressable
            onPress={closeSheet}
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}
          >
            <Text weight="medium" size="md" color="#6B7280">Cancel</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  scrollContent: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  scrollInner: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  optionList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  optionCardActive: {
    backgroundColor: "rgba(82, 153, 254, 0.08)",
    borderColor: "#5299FE",
    borderWidth: 2,
  },
  optionCardGood: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderColor: "#22C55E",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  saveButton: {
    width: "100%",
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
  },
});

export default MaintenanceInputModal;

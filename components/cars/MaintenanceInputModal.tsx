/**
 * MaintenanceInputModal
 *
 * PURPOSE: Bottom-sheet-style modal to collect user-provided maintenance data
 *          for items Smartcar doesn't cover (brakes, inspection, battery, etc.).
 *          Uses the same bottom sheet animation pattern as membership.tsx.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (triggered by "Add Info" button on MaintenanceTracker)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/shared-ui";
import { BrandColors, Colors, FontFamily, FontSize, Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MAINTENANCE_LABELS,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceInputModalProps {
  visible: boolean;
  maintenanceType: MaintenanceType;
  vehicleOwnerId: Id<"vehicle_owners">;
  /** Pre-fill form if editing an existing record */
  existingRecord?: {
    lastServiceDate?: number;
    lastServiceMileage?: number;
    customInputs?: Record<string, unknown>;
  };
  onClose: () => void;
  onSaved: () => void;
}

// ============================================================================
// QUESTION CONFIGS
// ============================================================================

interface QuestionConfig {
  showDate: boolean;
  dateLabel: string;
  showMileage: boolean;
  extraDate?: { key: string; label: string };
  toggle?: { key: string; label: string };
  oilTypePicker?: boolean;
  tirePressure?: boolean;
}

const QUESTION_CONFIGS: Record<MaintenanceType, QuestionConfig> = {
  oil: {
    showDate: true,
    dateLabel: "When was your last oil change?",
    showMileage: true,
    oilTypePicker: true,
  },
  brakes: {
    showDate: true,
    dateLabel: "When were your brakes last replaced?",
    showMileage: true,
    toggle: { key: "squeaking", label: "Do you hear squeaking or grinding?" },
  },
  inspection: {
    showDate: true,
    dateLabel: "When was your last inspection?",
    showMileage: false,
    extraDate: { key: "expirationDate", label: "When does your inspection expire?" },
  },
  tires: {
    showDate: true,
    dateLabel: "When were your tires last replaced?",
    showMileage: true,
    tirePressure: true,
  },
  battery: {
    showDate: true,
    dateLabel: "When was your battery last replaced?",
    showMileage: false,
    toggle: { key: "slowStarts", label: "Have you experienced slow starts?" },
  },
};

const OIL_TYPES = ["Conventional", "Synthetic", "Synthetic Blend"] as const;

/** Date-range options shown instead of a calendar picker */
const DATE_RANGE_OPTIONS = [
  { id: "lt6m", label: "Less than 6 months ago" },
  { id: "6m1y", label: "6 months to a year ago" },
  { id: "gt1y", label: "Over a year ago" },
  { id: "never", label: "Don't know / Never" },
] as const;

type DateRangeId = (typeof DATE_RANGE_OPTIONS)[number]["id"];

/** Convert a selected range into an approximate past timestamp */
function dateRangeToTimestamp(range: DateRangeId): number | undefined {
  const now = Date.now();
  const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
  switch (range) {
    case "lt6m":
      return now - 3 * MS_PER_MONTH;   // ~3 months ago
    case "6m1y":
      return now - 9 * MS_PER_MONTH;   // ~9 months ago
    case "gt1y":
      return now - 18 * MS_PER_MONTH;  // ~18 months ago
    case "never":
      return undefined;                 // no date
  }
}

/** Map an existing timestamp back to the closest range option */
function timestampToDateRange(ts: number): DateRangeId {
  const monthsAgo = (Date.now() - ts) / (30.44 * 24 * 60 * 60 * 1000);
  if (monthsAgo < 6) return "lt6m";
  if (monthsAgo < 12) return "6m1y";
  return "gt1y";
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
}: MaintenanceInputModalProps) {
  const upsertRecord = useMutation(api.maintenance.upsertRecord);
  const config = QUESTION_CONFIGS[maintenanceType];
  const label = MAINTENANCE_LABELS[maintenanceType];

  // ── Animation refs (same pattern as membership.tsx) ─────────
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  // ── Keyboard offset: shift sheet up when keyboard appears ─────────
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

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  // ── Form state ──────────────────────────────────────────────
  const [serviceDateRange, setServiceDateRange] = useState<DateRangeId | null>(null);
  const [mileage, setMileage] = useState("");
  const [extraDate, setExtraDate] = useState<Date | null>(null);
  const [toggleValue, setToggleValue] = useState(false);
  const [oilType, setOilType] = useState<string>("Conventional");
  const [tirePressure, setTirePressure] = useState({ fl: "", fr: "", rl: "", rr: "" });
  const [saving, setSaving] = useState(false);

  // ── Date picker visibility (Android — extra date only) ──
  const [showExtraDatePicker, setShowExtraDatePicker] = useState(false);

  // ── Open/close animations ───────────────────────────────────
  const openSheet = useCallback(() => {
    setModalVisible(true);
    sheetTranslateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 40,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetTranslateY, backdropOpacity]);

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    keyboardOffset.setValue(0);
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [sheetTranslateY, backdropOpacity, keyboardOffset, onClose]);

  // Sync with parent visible prop
  useEffect(() => {
    if (visible) {
      openSheet();
    } else if (modalVisible) {
      // Parent closed us — run close animation
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_HEIGHT,
          duration: 250,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  // ── Pre-fill from existing record ────────────────────────────
  useEffect(() => {
    if (existingRecord) {
      if (existingRecord.lastServiceDate) {
        setServiceDateRange(timestampToDateRange(existingRecord.lastServiceDate));
      }
      if (existingRecord.lastServiceMileage) {
        setMileage(String(Math.round(existingRecord.lastServiceMileage)));
      }
      const ci = existingRecord.customInputs;
      if (ci) {
        if (ci.expirationDate) setExtraDate(new Date(ci.expirationDate as number));
        if (ci.squeaking != null) setToggleValue(ci.squeaking as boolean);
        if (ci.slowStarts != null) setToggleValue(ci.slowStarts as boolean);
        if (ci.oilType) setOilType(ci.oilType as string);
        if (ci.tirePressure) {
          const tp = ci.tirePressure as Record<string, number>;
          setTirePressure({
            fl: tp.fl ? String(tp.fl) : "",
            fr: tp.fr ? String(tp.fr) : "",
            rl: tp.rl ? String(tp.rl) : "",
            rr: tp.rr ? String(tp.rr) : "",
          });
        }
      }
    } else {
      // Reset form
      setServiceDateRange(null);
      setMileage("");
      setExtraDate(null);
      setToggleValue(false);
      setOilType("Conventional");
      setTirePressure({ fl: "", fr: "", rl: "", rr: "" });
    }
  }, [existingRecord, visible]);

  // ── Save handler ────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const customInputs: Record<string, unknown> = {};

      if (config.oilTypePicker) customInputs.oilType = oilType;
      if (config.toggle) customInputs[config.toggle.key] = toggleValue;
      if (config.extraDate && extraDate) customInputs[config.extraDate.key] = extraDate.getTime();
      if (config.tirePressure) {
        const tp: Record<string, number | null> = {
          fl: tirePressure.fl ? parseFloat(tirePressure.fl) : null,
          fr: tirePressure.fr ? parseFloat(tirePressure.fr) : null,
          rl: tirePressure.rl ? parseFloat(tirePressure.rl) : null,
          rr: tirePressure.rr ? parseFloat(tirePressure.rr) : null,
        };
        customInputs.tirePressure = tp;
      }
      const computedServiceDate = serviceDateRange ? dateRangeToTimestamp(serviceDateRange) : undefined;

      await upsertRecord({
        vehicleOwnerId,
        type: maintenanceType,
        lastServiceDate: computedServiceDate,
        lastServiceMileage: mileage ? parseFloat(mileage) : undefined,
        customInputs: Object.keys(customInputs).length > 0 ? customInputs : undefined,
      });

      onSaved();
      closeSheet();
    } catch (err) {
      console.error("[MaintenanceInput] Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [
    config,
    maintenanceType,
    vehicleOwnerId,
    serviceDateRange,
    mileage,
    extraDate,
    toggleValue,
    oilType,
    tirePressure,
    upsertRecord,
    onSaved,
    closeSheet,
  ]);

  // ── Validation: at least one piece of data must be provided ──
  const canSave = useMemo(() => {
    return !!serviceDateRange || !!mileage;
  }, [serviceDateRange, mileage]);

  // ── Date change handlers (extra date only — main date uses range options) ──
  const onExtraDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowExtraDatePicker(false);
    if (date) setExtraDate(date);
  };

  const formatDisplayDate = (d: Date | null) => {
    if (!d) return "Select date";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: Animated.add(sheetTranslateY, keyboardOffset) }] },
        ]}
      >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text weight="bold" size="xl" color="#1F2937">
              {label}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Date range options ─────────────────────── */}
            {config.showDate && (
              <View style={styles.fieldGroup}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  {config.dateLabel}
                </Text>
                <View style={styles.dateRangeList}>
                  {DATE_RANGE_OPTIONS.map((opt) => {
                    const selected = serviceDateRange === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.dateRangeCard, selected && styles.dateRangeCardActive]}
                        onPress={() => setServiceDateRange(opt.id)}
                      >
                        <Text
                          weight={selected ? "bold" : "medium"}
                          size="sm"
                          color={selected ? "#1E40AF" : "#1F2937"}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Mileage input ──────────────────────────── */}
            {config.showMileage && (
              <View style={styles.fieldGroup}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  Mileage at last service
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={mileage}
                    onChangeText={setMileage}
                    placeholder="e.g. 42000"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    keyboardType="numeric"
                  />
                  <Text size="sm" color="rgba(0,0,0,0.4)" style={styles.inputSuffix}>
                    miles
                  </Text>
                </View>
              </View>
            )}

            {/* ── Extra date (inspection expiration) ──────── */}
            {config.extraDate && (
              <View style={styles.fieldGroup}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  {config.extraDate.label}
                </Text>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={extraDate || new Date()}
                    mode="date"
                    display="compact"
                    onChange={onExtraDateChange}
                    style={styles.extraDatePicker}
                  />
                ) : (
                  <>
                    <Pressable
                      style={styles.extraDateButton}
                      onPress={() => setShowExtraDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#5299FE" />
                      <Text size="md" color="#1F2937">
                        {formatDisplayDate(extraDate)}
                      </Text>
                    </Pressable>
                    {showExtraDatePicker && (
                      <DateTimePicker
                        value={extraDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={onExtraDateChange}
                      />
                    )}
                  </>
                )}
              </View>
            )}

            {/* ── Oil type picker ────────────────────────── */}
            {config.oilTypePicker && (
              <View style={styles.fieldGroup}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  Oil type (optional)
                </Text>
                <View style={styles.chipRow}>
                  {OIL_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.chip,
                        oilType === type && styles.chipActive,
                      ]}
                      onPress={() => setOilType(type)}
                    >
                      <Text
                        weight={oilType === type ? "bold" : "medium"}
                        size="sm"
                        color={oilType === type ? "#1E40AF" : "#1F2937"}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── Toggle (squeaking / slow starts) ───────── */}
            {config.toggle && (
              <View style={styles.fieldGroup}>
                <View style={styles.toggleRow}>
                  <Text weight="semiBold" size="md" color="#1F2937" style={styles.toggleLabel}>
                    {config.toggle.label}
                  </Text>
                  <Switch
                    value={toggleValue}
                    onValueChange={setToggleValue}
                    trackColor={{ false: "#E5E7EB", true: "#5299FE" }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            )}

            {/* ── Tire pressure inputs ───────────────────── */}
            {config.tirePressure && (
              <View style={styles.fieldGroup}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  Current tire pressure (optional)
                </Text>
                <View style={styles.tireGrid}>
                  {(["fl", "fr", "rl", "rr"] as const).map((pos) => (
                    <View key={pos} style={styles.tireInputWrap}>
                      <Text weight="medium" size="xs" color="#6B7280">
                        {pos === "fl" ? "Front Left" : pos === "fr" ? "Front Right" : pos === "rl" ? "Rear Left" : "Rear Right"}
                      </Text>
                      <TextInput
                        style={styles.tireInput}
                        value={tirePressure[pos]}
                        onChangeText={(val) =>
                          setTirePressure((prev) => ({ ...prev, [pos]: val }))
                        }
                        placeholder="PSI"
                        placeholderTextColor="rgba(0,0,0,0.25)"
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

          </ScrollView>

          {/* ── Footer ───────────────────────────────────── */}
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
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text weight="medium" size="md" color="#6B7280">
                Cancel
              </Text>
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
  // Backdrop — same as membership.tsx
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },

  // Bottom sheet — same positioning & radius as membership.tsx
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

  // Drag handle — same as membership.tsx
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

  // Header
  header: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },

  // Scrollable content
  scrollContent: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  scrollInner: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 20,
  },

  // Fields
  fieldGroup: {
    gap: 8,
  },
  dateRangeList: {
    gap: 8,
  },
  dateRangeCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  dateRangeCardActive: {
    backgroundColor: "rgba(82, 153, 254, 0.08)",
    borderColor: "#5299FE",
    borderWidth: 2,
  },
  extraDatePicker: {
    alignSelf: "flex-start",
  },
  extraDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: "#1F2937",
    paddingVertical: 14,
  },
  inputSuffix: {
    marginLeft: 6,
  },

  // Chips (oil type)
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: "rgba(82, 153, 254, 0.08)",
    borderColor: "#5299FE",
  },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    flex: 1,
    marginRight: 12,
  },

  // Tire pressure grid
  tireGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tireInputWrap: {
    width: "47%" as unknown as number,
    gap: 4,
  },
  tireInput: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  // Footer
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

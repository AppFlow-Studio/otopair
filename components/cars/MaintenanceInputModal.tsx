/**
 * MaintenanceInputModal
 *
 * PURPOSE: Bottom-sheet-style modal to collect user-provided maintenance data
 *          for items Smartcar doesn't cover (brakes, inspection, battery, etc.).
 *          Uses a tabbed step-by-step layout for multi-question types.
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
  TextInput,
  UIManager,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
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


// ============================================================================
// TYPES
// ============================================================================

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

type DateRangeId = "lt6m" | "6m1y" | "gt1y" | "never";
type BrakeLastDone = "within_6m" | "6m_to_1y" | "over_1y" | "never_on_this_car" | "dont_know";
type BrakeFeel = "normal" | "squeak" | "soft_slow" | "not_noticed";
type BrakeAction = "waiting_quote" | "not_scheduled" | "no_not_yet";
type TireReplaced = "yes_new" | "original" | "dont_know";
type TireReplacedWhen = "within_6m" | "6m_to_1y" | "1_to_2y" | "over_2y";
type TireRepaired = "yes" | "no" | "not_sure";

// ============================================================================
// DATE HELPERS
// ============================================================================

const DATE_RANGE_OPTIONS: { id: DateRangeId; label: string }[] = [
  { id: "lt6m", label: "Less than 6 months ago" },
  { id: "6m1y", label: "6 months to a year ago" },
  { id: "gt1y", label: "Over a year ago" },
  { id: "never", label: "Don't know / Never" },
];

function dateRangeToTimestamp(range: DateRangeId): number | undefined {
  const now = Date.now();
  const MS = 30.44 * 24 * 60 * 60 * 1000;
  switch (range) {
    case "lt6m":  return now - 3 * MS;
    case "6m1y":  return now - 9 * MS;
    case "gt1y":  return now - 18 * MS;
    case "never": return undefined;
  }
}

function timestampToDateRange(ts: number): DateRangeId {
  const monthsAgo = (Date.now() - ts) / (30.44 * 24 * 60 * 60 * 1000);
  if (monthsAgo < 6) return "lt6m";
  if (monthsAgo < 12) return "6m1y";
  return "gt1y";
}

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

function quickReadDateToTimestamp(range: string): number | undefined {
  const now = Date.now();
  switch (range) {
    case "within_6m": return now - 3 * MS_PER_MONTH;
    case "6m_to_1y":  return now - 9 * MS_PER_MONTH;
    case "over_1y":   return now - 18 * MS_PER_MONTH;
    case "1_to_2y":   return now - 18 * MS_PER_MONTH;
    case "over_2y":   return now - 30 * MS_PER_MONTH;
    default:          return undefined;
  }
}

function timestampToBrakeLastDone(ts: number): BrakeLastDone {
  const monthsAgo = (Date.now() - ts) / MS_PER_MONTH;
  if (monthsAgo < 6) return "within_6m";
  if (monthsAgo < 12) return "6m_to_1y";
  return "over_1y";
}

function timestampToTireReplacedWhen(ts: number): TireReplacedWhen {
  const monthsAgo = (Date.now() - ts) / MS_PER_MONTH;
  if (monthsAgo < 6) return "within_6m";
  if (monthsAgo < 12) return "6m_to_1y";
  if (monthsAgo < 24) return "1_to_2y";
  return "over_2y";
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
  const upsertRecord = useMutation(api.maintenance.upsertRecord);
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

  // ── Tab state ──────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState(0);

  // ── Shared form state (oil, battery, inspection) ───────────
  const [serviceDateRange, setServiceDateRange] = useState<DateRangeId | null>(null);
  const [mileage, setMileage] = useState("");
  const [extraDate, setExtraDate] = useState<Date | null>(null);
  const [warningLightOn, setWarningLightOn] = useState(false);
  const [showExtraDatePicker, setShowExtraDatePicker] = useState(false);

  const relevantLight = WARNING_LIGHT_FOR_TYPE[maintenanceType];
  const lightLabel = relevantLight ? WARNING_LIGHT_LABELS[relevantLight] : undefined;

  // ── Brakes Quick Read state ────────────────────────────────
  const [brakeLastDone, setBrakeLastDone] = useState<BrakeLastDone | null>(null);
  const [brakeFeel, setBrakeFeel] = useState<BrakeFeel | null>(null);
  const [brakeAction, setBrakeAction] = useState<BrakeAction | null>(null);

  // ── Tires Quick Read state ─────────────────────────────────
  const [tireReplaced, setTireReplaced] = useState<TireReplaced | null>(null);
  const [tireReplacedWhen, setTireReplacedWhen] = useState<TireReplacedWhen | null>(null);
  const [tireRepaired, setTireRepaired] = useState<TireRepaired | null>(null);

  const [saving, setSaving] = useState(false);

  const vehicleAge = vehicleYear ? new Date().getFullYear() - vehicleYear : 0;
  const isBatteryYoung = maintenanceType === "battery" && vehicleAge < 3;

  // ── Compute active tabs for current type ───────────────────
  const tabs = useMemo(() => {
    switch (maintenanceType) {
      case "oil":
        return serviceDateRange === "never" ? ["date"] : ["date", "mileage"];
      case "battery":
        return isBatteryYoung ? ["batteryHealthy"] : ["date"];
      case "brakes": {
        const base: string[] = ["brakeLastDone", "brakeFeel"];
        if (brakeFeel === "squeak" || brakeFeel === "soft_slow") base.push("brakeAction");
        return base;
      }
      case "tires": {
        const base: string[] = ["tireReplaced"];
        if (tireReplaced === "yes_new") base.push("tireReplacedWhen");
        base.push("tireRepaired");
        return base;
      }
      case "inspection":
        return ["single"] as const;
      default:
        return ["single"] as const;
    }
  }, [maintenanceType, brakeFeel, tireReplaced, serviceDateRange, isBatteryYoung]);

  const totalTabs = tabs.length;
  const isMultiTab = totalTabs > 1;
  const isLastTab = currentTab >= totalTabs - 1;

  // Clamp tab when conditional tabs disappear
  useEffect(() => {
    if (currentTab >= totalTabs) {
      setCurrentTab(Math.max(0, totalTabs - 1));
    }
  }, [totalTabs, currentTab]);

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
    setCurrentTab(0);

    if (existingRecord) {
      if (existingRecord.lastServiceDate) {
        setServiceDateRange(timestampToDateRange(existingRecord.lastServiceDate));
      } else {
        setServiceDateRange(null);
      }
      if (existingRecord.lastServiceMileage) {
        setMileage(String(Math.round(existingRecord.lastServiceMileage)));
      } else {
        setMileage("");
      }
      const ci = existingRecord.customInputs;
      if (ci) {
        if (ci.expirationDate) setExtraDate(new Date(ci.expirationDate as number));
        // Brakes Quick Read pre-fill
        if (ci.brakeLastDoneAnswer) {
          setBrakeLastDone(ci.brakeLastDoneAnswer as BrakeLastDone);
        } else if (existingRecord.lastServiceDate && maintenanceType === "brakes") {
          setBrakeLastDone(timestampToBrakeLastDone(existingRecord.lastServiceDate));
        } else {
          setBrakeLastDone(null);
        }
        setBrakeFeel((ci.brakeFeel as BrakeFeel) ?? null);
        setBrakeAction((ci.brakeActionStatus as BrakeAction) ?? null);

        // Tires Quick Read pre-fill
        setTireReplaced((ci.tireReplaced as TireReplaced) ?? null);
        if (ci.tireReplacedWhen) {
          setTireReplacedWhen(ci.tireReplacedWhen as TireReplacedWhen);
        } else if (existingRecord.lastServiceDate && maintenanceType === "tires") {
          setTireReplacedWhen(timestampToTireReplacedWhen(existingRecord.lastServiceDate));
        } else {
          setTireReplacedWhen(null);
        }
        setTireRepaired((ci.tireRepaired as TireRepaired) ?? null);
      } else {
        // No customInputs — reset type-specific fields
        setBrakeLastDone(null); setBrakeFeel(null); setBrakeAction(null);
        setTireReplaced(null); setTireReplacedWhen(null); setTireRepaired(null);
        setExtraDate(null);
      }
    } else {
      // Full reset
      setServiceDateRange(null); setMileage(""); setExtraDate(null);
      setBrakeLastDone(null); setBrakeFeel(null); setBrakeAction(null);
      setTireReplaced(null); setTireReplacedWhen(null); setTireRepaired(null);
    }

    // Pre-fill warning light toggle from knownIssues
    setWarningLightOn(relevantLight ? (knownIssues?.includes(relevantLight) ?? false) : false);
  }, [existingRecord, visible, maintenanceType, knownIssues, relevantLight]);

  // ── Per-tab validation ─────────────────────────────────────
  const canProceed = useMemo(() => {
    const tabId = tabs[currentTab];
    switch (tabId) {
      // Oil / Battery shared tabs
      case "date":        return !!serviceDateRange;
      case "mileage":     return true; // mileage is optional
      case "batteryHealthy": return true;
      // Brakes
      case "brakeLastDone": return brakeLastDone !== null;
      case "brakeFeel":     return brakeFeel !== null;
      case "brakeAction":   return brakeAction !== null;
      // Tires
      case "tireReplaced":     return tireReplaced !== null;
      case "tireReplacedWhen": return tireReplacedWhen !== null;
      case "tireRepaired":     return tireRepaired !== null;
      // Inspection (single)
      case "single":      return !!serviceDateRange;
      default:            return true;
    }
  }, [tabs, currentTab, serviceDateRange, brakeLastDone, brakeFeel, brakeAction, tireReplaced, tireReplacedWhen, tireRepaired]);

  // ── Navigation ─────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (currentTab < totalTabs - 1) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentTab(currentTab + 1);
    }
  }, [currentTab, totalTabs]);

  const handleBack = useCallback(() => {
    if (currentTab > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentTab(currentTab - 1);
    } else {
      closeSheet();
    }
  }, [currentTab, closeSheet]);

  // ── Save handler ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let lastServiceDate: number | undefined;
      let lastServiceMileage: number | undefined;
      const customInputs: Record<string, unknown> = {};

      switch (maintenanceType) {
        case "oil": {
          lastServiceDate = serviceDateRange ? dateRangeToTimestamp(serviceDateRange) : undefined;
          lastServiceMileage = mileage ? parseFloat(mileage) : undefined;
          break;
        }
        case "battery": {
          if (isBatteryYoung) {
            // Young vehicle — assume factory battery, installed at vehicle manufacture
            lastServiceDate = vehicleYear
              ? new Date(vehicleYear, 0, 1).getTime()
              : Date.now();
          } else {
            lastServiceDate = serviceDateRange ? dateRangeToTimestamp(serviceDateRange) : undefined;
          }
          break;
        }
        case "brakes": {
          lastServiceDate = brakeLastDone ? quickReadDateToTimestamp(brakeLastDone) : undefined;
          customInputs.brakeLastDoneAnswer = brakeLastDone;
          customInputs.brakeFeel = brakeFeel;
          if (brakeAction) customInputs.brakeActionStatus = brakeAction;
          break;
        }
        case "tires": {
          lastServiceDate = tireReplacedWhen ? quickReadDateToTimestamp(tireReplacedWhen) : undefined;
          customInputs.tireReplaced = tireReplaced;
          if (tireReplacedWhen) customInputs.tireReplacedWhen = tireReplacedWhen;
          customInputs.tireRepaired = tireRepaired;
          break;
        }
        case "inspection": {
          lastServiceDate = serviceDateRange ? dateRangeToTimestamp(serviceDateRange) : undefined;
          if (extraDate) customInputs.expirationDate = extraDate.getTime();
          break;
        }
      }

      await upsertRecord({
        vehicleOwnerId,
        type: maintenanceType,
        lastServiceDate,
        lastServiceMileage,
        customInputs: Object.keys(customInputs).length > 0 ? customInputs : undefined,
      });

      // Update warning light status if this type has a corresponding light
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
    serviceDateRange, mileage, extraDate, warningLightOn, relevantLight, updateWarningLight,
    brakeLastDone, brakeFeel, brakeAction,
    tireReplaced, tireReplacedWhen, tireRepaired,
    upsertRecord, onSaved, closeSheet,
  ]);

  // ── Date change handler (inspection extra date) ────────────
  const onExtraDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowExtraDatePicker(false);
    if (date) setExtraDate(date);
  };
  const formatDisplayDate = (d: Date | null) => {
    if (!d) return "Select date";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // ── Render helpers ─────────────────────────────────────────

  const renderOptionCard = <T extends string>(
    value: T | null,
    setValue: (v: T) => void,
    options: { id: T; label: string; good?: boolean; icon?: string }[],
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              {opt.icon && <Ionicons name={opt.icon as any} size={20} color={selected ? "#5299FE" : "#6B7280"} />}
              <Text
                weight={selected ? "bold" : "semiBold"}
                size="md"
                color={selected ? (isGood ? "#166534" : "#1E40AF") : "#1F2937"}
                style={{ flex: 1 }}
              >
                {opt.label}
              </Text>
            </View>
            {selected && <Ionicons name="checkmark-circle" size={22} color={isGood ? "#22C55E" : "#5299FE"} />}
          </Pressable>
        );
      })}
    </View>
  );

  const renderMileageTab = () => (
    <View style={styles.fieldGroup}>
      <Text weight="semiBold" size="md" color="#1F2937">
        What was your mileage at that service?
      </Text>
      <Text weight="medium" size="sm" color="#9CA3AF" style={{ marginTop: -2 }}>
        Optional — helps us predict your next service
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
  );

  // ── Render tab content ─────────────────────────────────────
  const renderTabContent = () => {
    const tabId = tabs[currentTab];

    switch (tabId) {
      // ── Oil / Battery: Date tab ────────────────────────
      case "date": {
        const dateLabel = maintenanceType === "oil"
          ? "When was your last oil change?"
          : "When was your battery last replaced?";
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">{dateLabel}</Text>
            <View style={styles.optionList}>
              {DATE_RANGE_OPTIONS.map((opt) => {
                const selected = serviceDateRange === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.optionCard, selected && styles.optionCardActive]}
                    onPress={() => setServiceDateRange(opt.id)}
                  >
                    <Text
                      weight={selected ? "bold" : "semiBold"}
                      size="md"
                      color={selected ? "#1E40AF" : "#1F2937"}
                      style={{ flex: 1 }}
                    >
                      {opt.label}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                  </Pressable>
                );
              })}
            </View>

          </View>
        );
      }

      // ── Oil: Mileage tab ─────────────────────────────────
      case "mileage":
        return renderMileageTab();

      // ── Battery: Young vehicle confirmation ────────────
      case "batteryHealthy":
        return (
          <View style={styles.fieldGroup}>
            <View style={{ alignItems: "center", paddingVertical: 16, gap: 12 }}>
              <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
              <Text weight="bold" size="lg" color="#166534">Battery looks good</Text>
              <Text weight="medium" size="sm" color="#6B7280" style={{ textAlign: "center", lineHeight: 20 }}>
                Your vehicle is {vehicleAge > 0 ? `~${vehicleAge} year${vehicleAge !== 1 ? "s" : ""}` : "less than a year"} old.
                Factory batteries typically last 3–5 years, so yours should still be in great shape.
              </Text>
            </View>
          </View>
        );

      // ── Brakes: Quick Read questions ───────────────────
      case "brakeLastDone":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">When were your brakes last done?</Text>
            {renderOptionCard(brakeLastDone, setBrakeLastDone, [
              { id: "within_6m", label: "Within the last 6 months" },
              { id: "6m_to_1y", label: "6 months to a year ago" },
              { id: "over_1y", label: "Over a year ago" },
              { id: "never_on_this_car", label: "I\u2019ve never had them done on this car" },
              { id: "dont_know", label: "I don\u2019t know" },
            ])}
          </View>
        );

      case "brakeFeel":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">How do your brakes feel right now?</Text>
            {renderOptionCard(brakeFeel, setBrakeFeel, [
              { id: "normal", label: "They feel normal", good: true },
              { id: "squeak", label: "They squeak or make noise" },
              { id: "soft_slow", label: "They feel soft or take longer to stop" },
              { id: "not_noticed", label: "I haven\u2019t noticed anything either way" },
            ])}
          </View>
        );

      case "brakeAction":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Have you had them looked at yet?</Text>
            {renderOptionCard(brakeAction, setBrakeAction, [
              { id: "waiting_quote", label: "Yes, waiting on a quote" },
              { id: "not_scheduled", label: "Yes, but haven\u2019t scheduled yet" },
              { id: "no_not_yet", label: "No, not yet" },
            ])}
          </View>
        );

      // ── Tires: Quick Read questions ────────────────────
      case "tireReplaced":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Have your tires been replaced on this car?</Text>
            {renderOptionCard(tireReplaced, setTireReplaced, [
              { id: "yes_new", label: "Yes, I put new tires on" },
              { id: "original", label: "No, they\u2019re the original tires" },
              { id: "dont_know", label: "I don\u2019t know (I bought it this way)" },
            ])}
          </View>
        );

      case "tireReplacedWhen":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Roughly when?</Text>
            {renderOptionCard(tireReplacedWhen, setTireReplacedWhen, [
              { id: "within_6m", label: "Within the last 6 months" },
              { id: "6m_to_1y", label: "6 months to a year ago" },
              { id: "1_to_2y", label: "1 to 2 years ago" },
              { id: "over_2y", label: "Over 2 years ago" },
            ])}
          </View>
        );

      case "tireRepaired":
        return (
          <View style={styles.fieldGroup}>
            <Text weight="semiBold" size="md" color="#1F2937">Have any of your tires been repaired? (Patched, plugged, etc.)</Text>
            {renderOptionCard(tireRepaired, setTireRepaired, [
              { id: "yes", label: "Yes" },
              { id: "no", label: "No", good: true },
              { id: "not_sure", label: "I\u2019m not sure" },
            ])}
          </View>
        );

      // ── Inspection: single page (unchanged) ────────────
      case "single":
        return (
          <>
            <View style={styles.fieldGroup}>
              <Text weight="semiBold" size="md" color="#1F2937">
                When was your last inspection?
              </Text>
              <View style={styles.optionList}>
                {DATE_RANGE_OPTIONS.map((opt) => {
                  const selected = serviceDateRange === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.optionCard, selected && styles.optionCardActive]}
                      onPress={() => setServiceDateRange(opt.id)}
                    >
                      <Text
                        weight={selected ? "bold" : "semiBold"}
                        size="md"
                        color={selected ? "#1E40AF" : "#1F2937"}
                        style={{ flex: 1 }}
                      >
                        {opt.label}
                      </Text>
                      {selected && <Ionicons name="checkmark-circle" size={22} color="#5299FE" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text weight="semiBold" size="md" color="#1F2937">
                When does your inspection expire?
              </Text>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={extraDate || new Date()}
                  mode="date"
                  display="compact"
                  onChange={onExtraDateChange}
                  style={{ alignSelf: "flex-start" }}
                />
              ) : (
                <>
                  <Pressable style={styles.extraDateButton} onPress={() => setShowExtraDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={18} color="#5299FE" />
                    <Text size="md" color="#1F2937">{formatDisplayDate(extraDate)}</Text>
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
          </>
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

        {/* Header + progress */}
        <View style={styles.header}>
          <Text weight="bold" size="xl" color="#1F2937">{label}</Text>
          {isMultiTab && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((currentTab + 1) / totalTabs) * 100}%` }]} />
              </View>
              <Text weight="medium" size="xs" color="#9CA3AF">
                {currentTab + 1} of {totalTabs}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderTabContent()}

          {/* Warning light toggle — shown on last tab for types with a corresponding light */}
          {relevantLight && lightLabel && currentTab === totalTabs - 1 && maintenanceType !== "inspection" && (
            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="semiBold" size="md" color="#1F2937">{lightLabel}</Text>
                  <Text weight="medium" size="xs" color="#6B7280">Is this light currently on in your dashboard?</Text>
                </View>
                <Switch
                  value={warningLightOn}
                  onValueChange={setWarningLightOn}
                  trackColor={{ false: "#E5E7EB", true: warningLightOn ? "#F87171" : "#E5E7EB" }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {isMultiTab ? (
            <View style={styles.footerButtons}>
              <Pressable
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={18} color="#6B7280" />
                <Text weight="semiBold" size="md" color="#6B7280">
                  {currentTab === 0 ? "Cancel" : "Back"}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.nextButton,
                  !canProceed && styles.nextButtonDisabled,
                  pressed && canProceed && { opacity: 0.9 },
                ]}
                onPress={isLastTab ? handleSave : handleNext}
                disabled={!canProceed || saving}
              >
                <Text weight="bold" size="md" color="#FFFFFF">
                  {saving ? "Saving..." : isLastTab ? "Save" : "Next"}
                </Text>
                {!isLastTab && !saving && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  !canProceed && styles.saveButtonDisabled,
                  pressed && canProceed && styles.saveButtonPressed,
                ]}
                onPress={handleSave}
                disabled={!canProceed || saving}
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
            </>
          )}
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
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#5299FE",
    borderRadius: 2,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    flex: 1,
    marginRight: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  footerButtons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: 14,
  },
  nextButtonDisabled: {
    opacity: 0.4,
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

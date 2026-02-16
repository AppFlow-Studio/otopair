/**
 * VehicleProfileFields
 *
 * PURPOSE: Inline onboarding fields for non-Smartcar vehicles.
 *          Replaces the multi-step wizard with a save-as-you-go vertical stack.
 *          Each field saves individually via `saveOnboardingField`.
 *          Styled with Otopair's frosted-glass design language.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (rendered when !isConnected && !onboardingComplete)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Text } from "@/components/shared-ui";
import { BrandColors, FontFamily, FontSize, Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

interface VehicleProfileFieldsProps {
  vehicleOwnerId: Id<"vehicle_owners">;
  ownership: Record<string, any>;
  vehicleYear?: number;
  scrollViewRef?: React.RefObject<ScrollView>;
  scrollOffset?: React.RefObject<number>;
  /** If provided, only show these fields (for connected vehicles that already have some data) */
  visibleFields?: FieldKey[];
  /** Custom header title (default: "Vehicle Profile") */
  headerTitle?: string;
  /** Custom header subtitle (overrides auto-generated one) */
  headerSubtitle?: string;
}

type FieldKey =
  | "mileage"
  | "avgMonthlyDriving"
  | "oil"
  | "tires"
  | "brakes"
  | "battery"
  | "inspection"
  | "drivingConditions";

interface FieldConfig {
  key: FieldKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  required: boolean;
}

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const FIELDS: FieldConfig[] = [
  { key: "mileage", label: "Current Mileage", icon: "speedometer-outline", required: true },
  { key: "avgMonthlyDriving", label: "Vehicle Usage", icon: "car-outline", required: true },
  { key: "oil", label: "Oil Change", icon: "water-outline", required: true },
  { key: "tires", label: "Tire Condition", icon: "ellipse-outline", required: true },
  { key: "brakes", label: "Brakes History", icon: "disc-outline", required: true },
  { key: "battery", label: "Battery Age", icon: "battery-half-outline", required: true },
  { key: "inspection", label: "State Inspection", icon: "document-text-outline", required: false },
  { key: "drivingConditions", label: "Driving Conditions", icon: "navigate-outline", required: false },
];

const REQUIRED_FIELDS = FIELDS.filter((f) => f.required);

// Chip options
const USAGE_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "average", label: "Average" },
  { value: "heavy", label: "Heavy" },
];

const TIRE_TYPE_OPTIONS = [
  { value: "rotation", label: "Rotation" },
  { value: "new_tires", label: "New Tires" },
  { value: "dont_remember", label: "Don't Remember" },
];

const DRIVING_OPTIONS = [
  { value: "city", label: "City" },
  { value: "highway", label: "Highway" },
  { value: "mixed", label: "Mixed" },
];

// ============================================================================
// ANIMATED EXPAND / COLLAPSE
// ============================================================================

const EXPAND_DURATION = 700;
const COLLAPSE_DURATION = 500;

/**
 * Smoothly expands/collapses children by animating height + opacity.
 * Mounts children immediately when expanding, unmounts after collapse finishes.
 * Uses a two-phase approach: mount → measure → animate.
 */
function AnimatedExpand({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(expanded);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const isAnimating = useRef(false);
  const prevExpanded = useRef(expanded);

  // Phase 2: once content is mounted and measured, run the expand animation
  // Add buffer for date pickers that can measure slightly short
  const targetHeight = measuredHeight + 40;

  useEffect(() => {
    if (expanded && shouldRender && measuredHeight > 0 && !isAnimating.current) {
      isAnimating.current = true;
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: targetHeight,
          duration: EXPAND_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: EXPAND_DURATION * 0.8,
          delay: EXPAND_DURATION * 0.15,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    }
  }, [expanded, shouldRender, measuredHeight, heightAnim, opacityAnim]);

  // Handle expanded prop changes
  useEffect(() => {
    if (expanded === prevExpanded.current) return;
    prevExpanded.current = expanded;

    if (expanded) {
      // Phase 1: mount children so they can be measured
      heightAnim.setValue(0);
      opacityAnim.setValue(0);
      setShouldRender(true);
      // measuredHeight will trigger the animation via the other useEffect
    } else {
      // Collapse animation
      isAnimating.current = true;
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: COLLAPSE_DURATION * 0.5,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: COLLAPSE_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        isAnimating.current = false;
        if (finished) {
          setShouldRender(false);
          setMeasuredHeight(0);
        }
      });
    }
  }, [expanded, heightAnim, opacityAnim]);

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={{
        height: measuredHeight > 0 ? heightAnim : undefined,
        opacity: opacityAnim,
        overflow: "hidden",
      }}
    >
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && h !== measuredHeight) {
            setMeasuredHeight(h);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function VehicleProfileFields({
  vehicleOwnerId,
  ownership,
  vehicleYear,
  scrollViewRef,
  scrollOffset,
  visibleFields,
  headerTitle,
  headerSubtitle,
}: VehicleProfileFieldsProps) {
  const saveField = useMutation(api.vehicles.saveOnboardingField);
  const records = useQuery(api.maintenance.getRecordsByVehicle, { vehicleOwnerId });

  // Track which field is being edited
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [saving, setSaving] = useState(false);

  // Refs for each field card to measure position
  const fieldRefs = useRef<Record<string, View | null>>({});

  // Listen for keyboard to align card bottom with keyboard top
  useEffect(() => {
    if (!editingField) return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, (e) => {
      // Delay to let the expand animation settle and override automaticallyAdjustKeyboardInsets
      setTimeout(() => {
        const ref = fieldRefs.current[editingField];
        if (!ref || !scrollViewRef?.current || scrollOffset?.current == null) return;

        ref.measureInWindow((_x, y, _w, height) => {
          const cardBottom = y + height;
          const keyboardTop = SCREEN_HEIGHT - e.endCoordinates.height;
          if (cardBottom > keyboardTop) {
            // Scroll up so card bottom sits right at keyboard top
            const currentOffset = scrollOffset.current ?? 0;
            const scrollBy = cardBottom - keyboardTop;
            scrollViewRef.current?.scrollTo({
              y: currentOffset + scrollBy,
              animated: true,
            });
          }
        });
      }, 250);
    });

    return () => sub.remove();
  }, [editingField, scrollViewRef, scrollOffset]);

  // Local edit state
  const [mileageText, setMileageText] = useState("");
  const [usageValue, setUsageValue] = useState<string | null>(null);
  const [oilDate, setOilDate] = useState<Date | null>(null);
  const [oilMileageText, setOilMileageText] = useState("");
  const [tireType, setTireType] = useState<string | null>(null);
  const [tireDate, setTireDate] = useState<Date | null>(null);
  const [brakeDate, setBrakeDate] = useState<Date | null>(null);
  const [brakeNever, setBrakeNever] = useState(false);
  const [batteryDate, setBatteryDate] = useState<Date | null>(null);
  const [batteryOriginal, setBatteryOriginal] = useState(false);
  const [inspectionDate, setInspectionDate] = useState<Date | null>(null);
  const [drivingValue, setDrivingValue] = useState<string | null>(null);

  // Build a map of existing maintenance records by type
  const recordMap = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    if (records) {
      for (const r of records) m.set(r.type, r);
    }
    return m;
  }, [records]);

  // Check if a field has saved data
  const isFieldSaved = useCallback(
    (key: FieldKey): boolean => {
      switch (key) {
        case "mileage":
          return ownership?.mileage != null && ownership.mileage > 0;
        case "avgMonthlyDriving":
          return !!ownership?.avgMonthlyDriving;
        case "drivingConditions":
          return !!ownership?.drivingConditions;
        case "oil":
        case "tires":
        case "brakes":
        case "battery":
        case "inspection":
          return recordMap.has(key);
        default:
          return false;
      }
    },
    [ownership, recordMap],
  );

  // Filtered fields: if visibleFields prop is set, only show those
  const displayFields = useMemo(
    () => visibleFields ? FIELDS.filter((f) => visibleFields.includes(f.key)) : FIELDS,
    [visibleFields],
  );
  const displayRequiredFields = useMemo(
    () => displayFields.filter((f) => f.required),
    [displayFields],
  );

  // Get saved summary text
  const getSummary = useCallback(
    (key: FieldKey): string => {
      switch (key) {
        case "mileage":
          return ownership?.mileage ? `${Number(ownership.mileage).toLocaleString()} mi` : "";
        case "avgMonthlyDriving": {
          const labels: Record<string, string> = { light: "Light", average: "Average", heavy: "Heavy" };
          return labels[ownership?.avgMonthlyDriving] ?? "";
        }
        case "drivingConditions": {
          const labels: Record<string, string> = { city: "City", highway: "Highway", mixed: "Mixed" };
          return labels[ownership?.drivingConditions] ?? "";
        }
        case "oil": {
          const rec = recordMap.get("oil");
          if (!rec) return "";
          const parts: string[] = [];
          if (rec.lastServiceDate) parts.push(new Date(rec.lastServiceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }));
          if (rec.lastServiceMileage) parts.push(`${Number(rec.lastServiceMileage).toLocaleString()} mi`);
          return parts.join(" · ") || "Saved";
        }
        case "tires": {
          const rec = recordMap.get("tires");
          if (!rec) return "";
          const typeLabels: Record<string, string> = { rotation: "Rotation", new_tires: "New Tires", dont_remember: "Don't Remember" };
          const typeLabel = typeLabels[rec.customInputs?.tireServiceType] ?? "";
          const dateStr = rec.lastServiceDate
            ? new Date(rec.lastServiceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "";
          return [typeLabel, dateStr].filter(Boolean).join(" · ") || "Saved";
        }
        case "brakes": {
          const rec = recordMap.get("brakes");
          if (!rec) return "";
          return rec.lastServiceDate
            ? new Date(rec.lastServiceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "Never / Don't Know";
        }
        case "battery": {
          const rec = recordMap.get("battery");
          if (!rec) return "";
          return rec.lastServiceDate
            ? new Date(rec.lastServiceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "Original battery";
        }
        case "inspection": {
          const rec = recordMap.get("inspection");
          if (!rec) return "";
          return rec.lastServiceDate
            ? new Date(rec.lastServiceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "Saved";
        }
        default:
          return "";
      }
    },
    [ownership, recordMap],
  );

  // Progress (based on visible fields only)
  const completedCount = useMemo(
    () => displayRequiredFields.filter((f) => isFieldSaved(f.key)).length,
    [isFieldSaved, displayRequiredFields],
  );
  const totalRequired = displayRequiredFields.length;
  const remaining = totalRequired - completedCount;
  const progressPercent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  // Scroll so the active field card's bottom aligns with a given "floor" Y
  const scrollFieldIntoView = useCallback(
    (key: FieldKey, floorY?: number) => {
      setTimeout(() => {
        const ref = fieldRefs.current[key];
        if (!ref || !scrollViewRef?.current || scrollOffset?.current == null) return;

        ref.measureInWindow((_x, y, _w, height) => {
          const cardBottom = y + height;
          const floor = floorY ?? SCREEN_HEIGHT; // default: bottom of screen
          if (cardBottom > floor) {
            const currentOffset = scrollOffset.current ?? 0;
            const scrollBy = cardBottom - floor;
            scrollViewRef.current?.scrollTo({
              y: currentOffset + scrollBy,
              animated: true,
            });
          }
        });
      }, EXPAND_DURATION + 100); // wait for expand animation
    },
    [scrollViewRef, scrollOffset],
  );

  // Pre-fill local state when entering edit mode
  const handleStartEdit = useCallback(
    (key: FieldKey) => {
      setEditingField(key);
      // For non-keyboard fields, scroll card into view after expand
      const nonKeyboardFields: FieldKey[] = [
        "avgMonthlyDriving", "oil", "tires", "brakes", "battery", "inspection", "drivingConditions",
      ];
      if (nonKeyboardFields.includes(key)) {
        scrollFieldIntoView(key);
      }
      switch (key) {
        case "mileage":
          setMileageText(ownership?.mileage ? String(Math.round(ownership.mileage)) : "");
          break;
        case "avgMonthlyDriving":
          setUsageValue(ownership?.avgMonthlyDriving ?? null);
          break;
        case "oil": {
          const rec = recordMap.get("oil");
          setOilDate(rec?.lastServiceDate ? new Date(rec.lastServiceDate) : null);
          setOilMileageText(rec?.lastServiceMileage ? String(Math.round(rec.lastServiceMileage)) : "");
          break;
        }
        case "tires": {
          const rec = recordMap.get("tires");
          setTireType(rec?.customInputs?.tireServiceType ?? null);
          setTireDate(rec?.lastServiceDate ? new Date(rec.lastServiceDate) : null);
          break;
        }
        case "brakes": {
          const rec = recordMap.get("brakes");
          setBrakeDate(rec?.lastServiceDate ? new Date(rec.lastServiceDate) : null);
          setBrakeNever(!rec?.lastServiceDate && recordMap.has("brakes"));
          break;
        }
        case "battery": {
          const rec = recordMap.get("battery");
          setBatteryDate(rec?.lastServiceDate ? new Date(rec.lastServiceDate) : null);
          setBatteryOriginal(false);
          break;
        }
        case "inspection": {
          const rec = recordMap.get("inspection");
          setInspectionDate(rec?.lastServiceDate ? new Date(rec.lastServiceDate) : null);
          break;
        }
        case "drivingConditions":
          setDrivingValue(ownership?.drivingConditions ?? null);
          break;
      }
    },
    [ownership, recordMap, scrollFieldIntoView],
  );

  // Save handler
  const handleSave = useCallback(
    async (key: FieldKey) => {
      setSaving(true);
      try {
        let value: any;
        switch (key) {
          case "mileage": {
            const n = parseInt(mileageText.replace(/,/g, ""), 10);
            if (isNaN(n) || n <= 0) { setSaving(false); return; }
            value = n;
            break;
          }
          case "avgMonthlyDriving":
            if (!usageValue) { setSaving(false); return; }
            value = usageValue;
            break;
          case "oil":
            value = {
              date: oilDate?.getTime(),
              mileage: oilMileageText ? parseInt(oilMileageText.replace(/,/g, ""), 10) : undefined,
            };
            if (!value.date && !value.mileage) { setSaving(false); return; }
            break;
          case "tires":
            if (!tireType) { setSaving(false); return; }
            value = { type: tireType, date: tireDate?.getTime() };
            break;
          case "brakes":
            value = { date: brakeNever ? undefined : brakeDate?.getTime() };
            break;
          case "battery":
            value = {
              date: batteryOriginal ? undefined : batteryDate?.getTime(),
              isOriginal: batteryOriginal,
              modelYear: vehicleYear,
            };
            break;
          case "inspection":
            value = { date: inspectionDate?.getTime() };
            if (!value.date) { setSaving(false); return; }
            break;
          case "drivingConditions":
            if (!drivingValue) { setSaving(false); return; }
            value = drivingValue;
            break;
        }

        await saveField({ vehicleOwnerId, field: key, value });

        // Auto-advance: find the next unsaved field after the current one.
        // Exclude the current key since Convex reactive data may not have updated yet.
        const currentIndex = displayFields.findIndex((f) => f.key === key);
        let nextField: FieldConfig | undefined;
        for (let i = currentIndex + 1; i < displayFields.length; i++) {
          if (displayFields[i].key !== key && !isFieldSaved(displayFields[i].key)) {
            nextField = displayFields[i];
            break;
          }
        }
        if (!nextField) {
          for (let i = 0; i < currentIndex; i++) {
            if (displayFields[i].key !== key && !isFieldSaved(displayFields[i].key)) {
              nextField = FIELDS[i];
              break;
            }
          }
        }

        if (nextField) {
          // Close current, wait for collapse animation, then open next
          setEditingField(null);
          setTimeout(() => handleStartEdit(nextField!.key), COLLAPSE_DURATION + 100);
        } else {
          // All fields done — close editor; parent detects onboardingComplete transition
          setEditingField(null);
        }
      } catch (err) {
        console.warn("Save field failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [
      vehicleOwnerId, saveField, vehicleYear, isFieldSaved, handleStartEdit, displayFields,
      mileageText, usageValue, oilDate, oilMileageText,
      tireType, tireDate, brakeDate, brakeNever,
      batteryDate, batteryOriginal, inspectionDate, drivingValue,
    ],
  );

  // ── Chip Selector ──────────────────────────────────────────────────────
  const ChipSelector = useCallback(
    ({ options, selected, onSelect }: { options: { value: string; label: string }[]; selected: string | null; onSelect: (v: string) => void }) => (
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text
                weight={isActive ? "semiBold" : "medium"}
                size="sm"
                color={isActive ? "#FFFFFF" : "#1F2937"}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [],
  );

  // ── Render edit body for a field ─────────────────────────────────────
  const renderEditContent = useCallback(
    (key: FieldKey) => {
      switch (key) {
        case "mileage":
          return (
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 45,000"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={mileageText}
              onChangeText={setMileageText}
              autoFocus
            />
          );

        case "avgMonthlyDriving":
          return <ChipSelector options={USAGE_OPTIONS} selected={usageValue} onSelect={setUsageValue} />;

        case "oil":
          return (
            <View style={styles.editGroup}>
              <Text size="sm" color="#6B7280" style={styles.editLabel}>Date of last oil change</Text>
              <DateTimePicker
                value={oilDate ?? new Date()}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setOilDate(d); }}
                style={styles.datePicker}
              />
              <Text size="sm" color="#6B7280" style={[styles.editLabel, { marginTop: 12 }]}>Mileage at oil change (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 42,000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={oilMileageText}
                onChangeText={setOilMileageText}
              />
            </View>
          );

        case "tires":
          return (
            <View style={styles.editGroup}>
              <Text size="sm" color="#6B7280" style={styles.editLabel}>Last tire service type</Text>
              <ChipSelector options={TIRE_TYPE_OPTIONS} selected={tireType} onSelect={setTireType} />
              {tireType && tireType !== "dont_remember" && (
                <>
                  <Text size="sm" color="#6B7280" style={[styles.editLabel, { marginTop: 12 }]}>When?</Text>
                  <DateTimePicker
                    value={tireDate ?? new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setTireDate(d); }}
                    style={styles.datePicker}
                  />
                </>
              )}
            </View>
          );

        case "brakes":
          return (
            <View style={styles.editGroup}>
              {!brakeNever && (
                <>
                  <Text size="sm" color="#6B7280" style={styles.editLabel}>Date of last brake service</Text>
                  <DateTimePicker
                    value={brakeDate ?? new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setBrakeDate(d); }}
                    style={styles.datePicker}
                  />
                </>
              )}
              <Pressable
                style={[styles.toggleRow, { marginTop: brakeNever ? 0 : 12 }]}
                onPress={() => setBrakeNever(!brakeNever)}
              >
                <View style={[styles.checkbox, brakeNever && styles.checkboxActive]}>
                  {brakeNever && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text size="sm" color="#4B5563">Never / Don&apos;t Know</Text>
              </Pressable>
            </View>
          );

        case "battery":
          return (
            <View style={styles.editGroup}>
              {!batteryOriginal && (
                <>
                  <Text size="sm" color="#6B7280" style={styles.editLabel}>Battery install date</Text>
                  <DateTimePicker
                    value={batteryDate ?? new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setBatteryDate(d); }}
                    style={styles.datePicker}
                  />
                </>
              )}
              <Pressable
                style={[styles.toggleRow, { marginTop: batteryOriginal ? 0 : 12 }]}
                onPress={() => setBatteryOriginal(!batteryOriginal)}
              >
                <View style={[styles.checkbox, batteryOriginal && styles.checkboxActive]}>
                  {batteryOriginal && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text size="sm" color="#4B5563">Original battery</Text>
              </Pressable>
            </View>
          );

        case "inspection":
          return (
            <View style={styles.editGroup}>
              <Text size="sm" color="#6B7280" style={styles.editLabel}>Last state inspection date</Text>
              <DateTimePicker
                value={inspectionDate ?? new Date()}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setInspectionDate(d); }}
                style={styles.datePicker}
              />
            </View>
          );

        case "drivingConditions":
          return <ChipSelector options={DRIVING_OPTIONS} selected={drivingValue} onSelect={setDrivingValue} />;

        default:
          return null;
      }
    },
    [
      mileageText, usageValue, oilDate, oilMileageText,
      tireType, tireDate, brakeDate, brakeNever,
      batteryDate, batteryOriginal, inspectionDate, drivingValue,
      ChipSelector,
    ],
  );

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER CARD — frosted glass with progress ring
      ═══════════════════════════════════════════════════════════════ */}
      <View style={styles.headerOuter}>
        <BlurView intensity={22} tint="light" style={styles.blurFill}>
          <View style={styles.whiteOverlay} />
        </BlurView>
        <View style={styles.headerContent}>
            <Text weight="bold" size="xl" color="#1F2937">
              {headerTitle ?? "Vehicle Profile"}
            </Text>
            <View style={styles.headerProgressRow}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` as any }]} />
              </View>
              <Text weight="semiBold" size="sm" color="#5299FE">
                {progressPercent}%
              </Text>
            </View>
            <Text size="sm" color="#6B7280">
              {headerSubtitle
                ?? (remaining > 0
                  ? `Complete ${remaining} more item${remaining > 1 ? "s" : ""} to activate predictive health tracking.`
                  : "Health tracking activated!")}
            </Text>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════
          FIELD CARDS
      ═══════════════════════════════════════════════════════════════ */}
      {displayFields.map((field) => {
        const saved = isFieldSaved(field.key);
        const isEditing = editingField === field.key;

        // Status badge config
        const badgeBg = saved ? "#DCFCE7" : field.required ? "#FEE2E2" : "rgba(255,255,255,0.3)";
        const badgeText = saved ? "#15803D" : field.required ? "#B91C1C" : "#6B7280";
        const badgeLabel = saved ? "Saved" : field.required ? "Required" : "Optional";

        return (
          <View
            key={field.key}
            ref={(r) => { fieldRefs.current[field.key] = r; }}
            style={styles.fieldOuter}
          >
            {/* Frosted glass background */}
            <BlurView intensity={22} tint="light" style={styles.blurFill}>
              <View style={styles.whiteOverlay} />
            </BlurView>

            <View style={styles.fieldInner}>
              {/* Row header */}
              <Pressable
                style={styles.fieldHeader}
              onPress={() => {
                if (isEditing) {
                  setEditingField(null);
                } else {
                  handleStartEdit(field.key);
                }
              }}
              >
                <View style={styles.fieldLeft}>
                  {/* Icon */}
                  <View style={[styles.iconCircle, saved && styles.iconCircleSaved]}>
                    <Ionicons
                      name={saved ? "checkmark" : field.icon}
                      size={18}
                      color={saved ? "#22C55E" : "#5299FE"}
                    />
                  </View>

                  {/* Text block */}
                  <View style={styles.fieldTextBlock}>
                    <Text weight="semiBold" size="md" color="#1F2937">
                      {field.label}
                    </Text>
                    {saved && !isEditing && (
                      <Text size="sm" color="#6B7280">{getSummary(field.key)}</Text>
                    )}
                  </View>
                </View>

                {/* Right side: badge + chevron */}
                <View style={styles.fieldRight}>
                  <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                    <Text weight="semiBold" size="xs" color={badgeText}>
                      {badgeLabel}
                    </Text>
                  </View>
                  {!isEditing && (
                    <Ionicons
                      name={isEditing ? "chevron-up" : "chevron-forward"}
                      size={18}
                      color="#9CA3AF"
                    />
                  )}
                </View>
              </Pressable>

              {/* Edit content — animated expand/collapse */}
              <AnimatedExpand expanded={isEditing}>
                <View style={styles.editContainer}>
                  {renderEditContent(field.key)}
                  <View style={styles.editActions}>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => setEditingField(null)}
                    >
                      <Text weight="semiBold" size="sm" color="#6B7280">Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                      onPress={() => handleSave(field.key)}
                      disabled={saving}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text weight="bold" size="sm" color="#FFFFFF">
                        {saving ? "Saving..." : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </AnimatedExpand>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // ── Shared frosted glass ──────────────────────────────────────────
  blurFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  whiteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
  },

  // ── Header card ────────────────────────────────────────────────────
  headerOuter: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "rgba(0, 0, 0, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 14,
  },
  headerContent: {
    padding: 16,
  },
  headerProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#5299FE",
  },

  // ── Field card (frosted glass) ─────────────────────────────────────
  fieldOuter: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "rgba(0, 0, 0, 0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  fieldInner: {
    backgroundColor: "transparent",
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fieldRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(82, 153, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconCircleSaved: {
    backgroundColor: "#DCFCE7",
  },
  fieldTextBlock: {
    flex: 1,
    gap: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  // ── Edit container (light frosted panel) ─────────────────────────────
  editContainer: {
    marginHorizontal: 10,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: "rgba(245, 247, 250, 0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  editGroup: {},
  editLabel: {
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: "#1F2937",
  },
  datePicker: {
    alignSelf: "flex-start",
  },

  // ── Chips ──────────────────────────────────────────────────────────
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  chipActive: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },

  // ── Toggle / Checkbox ──────────────────────────────────────────────
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },

  // ── Actions ────────────────────────────────────────────────────────
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    backgroundColor: "#FFFFFF",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    shadowColor: "rgba(82, 153, 254, 0.4)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});

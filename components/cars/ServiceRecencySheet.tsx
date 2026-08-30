/**
 * ServiceRecencySheet — "When was this last done?" for an unknown tracker row.
 *
 * The tracker's UNKNOWN rows say we have no record and offer a diagnostic
 * scan. A scan is not the only way to find out: the driver often just knows.
 * This asks them, using the SAME options onboarding asks for the core types
 * (CarInfoStepper SERVICE_QUESTIONS) so the two surfaces cannot drift into
 * asking the same question two different ways.
 *
 * Built on the project-standard FloatingSheet — blur backdrop, grabber,
 * drag-to-dismiss, floating insets — so it matches every other bottom sheet
 * in the app rather than inventing a second sheet language.
 *
 * Answering is optional everywhere it appears. "Not sure" is a first-class
 * choice that leaves the row exactly as it was — unknown, unscored — rather
 * than a dead end the driver has to escape.
 */
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Check } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Spacing } from "@/constants/theme";
import { moderateScale, scale } from "@/utils/responsive";

/** Mirrors CarInfoStepper's recency options. Order is deliberate: most-recent
 *  first, "Not sure" last, so the escape hatch never sits above a real answer. */
export const RECENCY_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "recently", label: "Recently" },
  { id: "few_months", label: "A few months ago" },
  { id: "over_6mo", label: "Over 6 months ago" },
  { id: "exact_date", label: "A specific date" },
  { id: "never", label: "Never had it done" },
  { id: "not_sure", label: "I'm not sure" },
];

export interface RecencyAnswer {
  recency: string;
  /** Epoch ms; only set when recency is "exact_date". */
  exactDate?: number;
}

// Title + hint + six options + footer. Grows by the date picker's height only
// when "a specific date" is chosen, which is why there are two snap heights.
const SHEET_HEIGHT = 600;
const SHEET_HEIGHT_WITH_PICKER = 680;

const BLUE = "#5299FE";
const BLUE_BG = "#EEF4FF";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#6B7280";
const TEXT_MUTED = "#9CA3AF";

interface ServiceRecencySheetProps {
  visible: boolean;
  serviceName: string;
  onClose: () => void;
  onSubmit: (answer: RecencyAnswer) => void;
}

export function ServiceRecencySheet({
  visible,
  serviceName,
  onClose,
  onSubmit,
}: ServiceRecencySheetProps) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [exactDate, setExactDate] = useState<Date | null>(null);

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setExactDate(null);
      sheetRef.current?.open();
    }
  }, [visible]);

  const needsDate = selected === "exact_date";
  const canSubmit = !!selected && (!needsDate || !!exactDate);

  const submit = () => {
    if (!canSubmit || !selected) return;
    onSubmit({
      recency: selected,
      ...(needsDate && exactDate ? { exactDate: exactDate.getTime() } : {}),
    });
    sheetRef.current?.close();
  };

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[needsDate ? SHEET_HEIGHT_WITH_PICKER : SHEET_HEIGHT]}
      showBackdrop
      floatBottomInset={12}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text weight="bold" size="xl" color={TEXT_PRIMARY}>
          When was this last done?
        </Text>
        <Text size="sm" color={TEXT_SECONDARY} style={styles.subtitle}>
          {serviceName}
        </Text>
        <Text size="xs" color={TEXT_MUTED} style={styles.hint}>
          Optional — skip it if you&apos;d rather not say.
        </Text>

        {RECENCY_OPTIONS.map((opt) => {
          const active = selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setSelected(opt.id)}
              style={({ pressed }) => [
                styles.option,
                active && styles.optionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                weight={active ? "bold" : "medium"}
                size="md"
                color={active ? BLUE : TEXT_PRIMARY}
              >
                {opt.label}
              </Text>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}

        {needsDate && (
          <View style={styles.datePickerWrap}>
            <DateTimePicker
              value={exactDate ?? new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "compact" : "default"}
              maximumDate={new Date()}
              themeVariant="light"
              accentColor={BLUE}
              onChange={(_e: DateTimePickerEvent, date?: Date) => {
                if (date) setExactDate(date);
              }}
            />
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
        >
          <Text weight="bold" size="md" color={canSubmit ? "#FFFFFF" : TEXT_MUTED}>
            Save
          </Text>
        </Pressable>
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
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: scale(14),
    borderRadius: moderateScale(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: scale(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  optionActive: {
    borderColor: BLUE,
    backgroundColor: BLUE_BG,
  },
  radio: {
    width: scale(22),
    height: scale(22),
    borderRadius: moderateScale(11),
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  radioActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  datePickerWrap: {
    alignItems: "center",
    paddingVertical: scale(8),
  },
  submit: {
    marginTop: scale(14),
    paddingVertical: scale(16),
    borderRadius: moderateScale(999),
    backgroundColor: BLUE,
    alignItems: "center",
  },
  submitDisabled: {
    backgroundColor: "#F3F4F6",
  },
});

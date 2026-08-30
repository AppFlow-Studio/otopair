/**
 * ServiceRecencySheet — "When was this last done?" for an unknown tracker row.
 *
 * The tracker's UNKNOWN rows say we have no record and offer a diagnostic
 * scan. A scan is not the only way to find out: the driver often just knows.
 * This asks them, using the SAME options onboarding asks for the core types
 * (CarInfoStepper SERVICE_QUESTIONS) so the two surfaces cannot drift into
 * asking the same question two different ways.
 *
 * Answering is optional everywhere it appears. "Not sure" is a first-class
 * choice that leaves the row exactly as it was — unknown, unscored — rather
 * than a dead end the driver has to escape.
 */
import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/shared-ui";
import { moderateScale, scale } from "@/utils/responsive";

/** Mirrors CarInfoStepper's recency options. Kept in this order deliberately:
 *  most-recent first, "Not sure" last, so the escape hatch never sits above a
 *  real answer. */
export const RECENCY_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
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

export function ServiceRecencySheet({
  visible,
  serviceName,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  serviceName: string;
  onClose: () => void;
  onSubmit: (answer: RecencyAnswer) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [exactDate, setExactDate] = useState<Date | null>(null);

  const reset = () => {
    setSelected(null);
    setExactDate(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!selected) return;
    // An exact date with nothing picked yet is not an answer.
    if (selected === "exact_date" && !exactDate) return;
    onSubmit({
      recency: selected,
      ...(selected === "exact_date" && exactDate ? { exactDate: exactDate.getTime() } : {}),
    });
    reset();
  };

  const canSubmit = !!selected && (selected !== "exact_date" || !!exactDate);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text weight="bold" style={styles.title}>{serviceName}</Text>
        <Text style={styles.subtitle}>
          When was this last done? Skip it if you&apos;d rather not say.
        </Text>

        <ScrollView bounces={false} style={styles.list}>
          {RECENCY_OPTIONS.map((opt) => {
            const active = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSelected(opt.id)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  weight={active ? "semiBold" : "medium"}
                  style={[styles.optionText, active && styles.optionTextActive]}
                >
                  {opt.label}
                </Text>
                <Ionicons
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={active ? "#5299FE" : "#D1D5DB"}
                />
              </Pressable>
            );
          })}

          {selected === "exact_date" && (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                value={exactDate ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "compact" : "default"}
                maximumDate={new Date()}
                themeVariant="light"
                accentColor="#5299FE"
                onChange={(_e: DateTimePickerEvent, date?: Date) => {
                  if (date) setExactDate(date);
                }}
              />
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && { opacity: 0.85 },
          ]}
        >
          <Text weight="semiBold" style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
            Save
          </Text>
        </Pressable>
        <Pressable onPress={close} style={styles.cancel} hitSlop={8}>
          <Text weight="medium" style={styles.cancelText}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: scale(20),
    paddingTop: scale(10),
    paddingBottom: scale(28),
    maxHeight: "80%",
  },
  grabber: {
    alignSelf: "center",
    width: scale(36),
    height: scale(5),
    borderRadius: moderateScale(3),
    backgroundColor: "#E5E7EB",
    marginBottom: scale(14),
  },
  title: { fontSize: moderateScale(18), color: "#1F2937" },
  subtitle: {
    fontSize: moderateScale(13),
    color: "#6B7280",
    marginTop: scale(4),
    marginBottom: scale(14),
  },
  list: { flexGrow: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginBottom: scale(8),
  },
  optionActive: { borderColor: "#5299FE", backgroundColor: "#EFF6FF" },
  optionText: { fontSize: moderateScale(15), color: "#374151" },
  optionTextActive: { color: "#1D4ED8" },
  datePickerWrap: { alignItems: "center", paddingVertical: scale(8) },
  submit: {
    marginTop: scale(14),
    paddingVertical: scale(15),
    borderRadius: moderateScale(999),
    backgroundColor: "#5299FE",
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: "#E5E7EB" },
  submitText: { fontSize: moderateScale(15), color: "#FFFFFF" },
  submitTextDisabled: { color: "#9CA3AF" },
  cancel: { alignItems: "center", paddingVertical: scale(12) },
  cancelText: { fontSize: moderateScale(14), color: "#6B7280" },
});

/**
 * QuickCheckSheet — one sheet for every Quick Check tile.
 *
 * Spec v2 §5: three rows, same order, every service tile, so the pattern is
 * learned once. What differs per tile is declarative and lives in
 * `tileSpecs.ts`; this renders it.
 *
 * Deliberately not an extension of the old `QuestionOverlay` (deleted with this
 * change). That component was a
 * question *sequence* — tap an option, auto-advance or auto-close, mediated by
 * a 300ms timer and two refs. The v2 shape is one screen with one Save, plus a
 * composite month/year/miles row, an oil-only toggle inside a row, and symptom
 * chips that sit outside the radio group entirely. None of that survives the
 * old control flow.
 *
 * Built on FloatingSheet so it matches every other sheet in the app.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Spacing } from "@/constants/theme";
import { moderateScale, scale } from "@/utils/responsive";
import { MonthYearPicker } from "./MonthYearPicker";
import {
  SYMPTOM_NONE,
  TILE_SPECS,
  WARNING_LIGHT_OPTIONS,
  type QuickCheckAnswer,
  type TileSpec,
} from "./tileSpecs";

const BLUE = "#5299FE";
const BLUE_BG = "#EEF4FF";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#6B7280";
const TEXT_MUTED = "#9CA3AF";

/** Floor and ceiling for the measured height. The floor stops a one-frame
 *  flash at a silly size before the first layout; the ceiling keeps the tallest
 *  state (warning lights, nine chips) scrollable instead of full-screen. */
const SHEET_MIN = 320;
const SHEET_MAX = Math.round(Dimensions.get("window").height * 0.82);
/** Grabber + its padding, above the body. Measured, not guessed — the body's
 *  own paddingTop is already inside the content height. */
const SHEET_CHROME = 34;

type RowId = "when" | "never" | "unsure";

export function QuickCheckSheet({
  spec,
  visible,
  vehicleYear,
  /** Guided shows the sheet subtitles; Confident hides them (§3). Nothing
   *  else differs between the two paths. */
  guided = true,
  onClose,
  onSubmit,
}: {
  /** The question to ask. Null closes the sheet. Callers pass either a fixed
   *  `TILE_SPECS` entry or a `catalogTileSpec` built from a taxonomy slug —
   *  the sheet does not care which. */
  spec: TileSpec | null;
  visible: boolean;
  vehicleYear?: number | null;
  guided?: boolean;
  onClose: () => void;
  onSubmit: (id: string, answer: QuickCheckAnswer) => void;
}) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [row, setRow] = useState<RowId | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [milesText, setMilesText] = useState("");
  // Three-way, not boolean: a driver who knows the filters were skipped is
  // telling us something different from one who can't remember, and step 6
  // only writes a filter record for a definite yes/no.
  const [companionDone, setCompanionDone] = useState<boolean | "unsure" | null>(null);
  const [symptom, setSymptom] = useState<string>(SYMPTOM_NONE);
  const [lights, setLights] = useState<string[]>([]);
  // The sheet hugs its content rather than picking from two fixed heights.
  // Five tiles x three answer states is ten different content heights, and a
  // constant tall enough for the tallest leaves a white void under the short
  // ones (which is exactly what the fixed 560 did).
  const [contentHeight, setContentHeight] = useState(SHEET_MIN);

  const isLights = spec?.id === "warningLights";

  useEffect(() => {
    if (!visible) return;
    setRow(null);
    setMonth(null);
    setYear(null);
    setMilesText("");
    setCompanionDone(null);
    setSymptom(SYMPTOM_NONE);
    setLights([]);
    sheetRef.current?.open();
  }, [visible, spec?.id]);

  const needsDate = row === "when" && !isLights;
  const needsLights = isLights && row === "when";

  const canSave = useMemo(() => {
    if (!row) return false;
    if (needsDate) return month != null && year != null;
    if (needsLights) return lights.length > 0;
    return true;
  }, [row, needsDate, needsLights, month, year, lights]);

  const submit = () => {
    if (!canSave || !spec || !row) return;
    const miles = milesText.replace(/[^0-9]/g, "");
    onSubmit(spec.id, {
      answerType: row === "when" ? "when" : row === "never" ? "never" : "unsure",
      ...(needsDate && month != null && year != null ? { month, year } : {}),
      ...(needsDate && miles ? { miles: Number(miles) } : {}),
      ...(spec.companion && row === "when" && typeof companionDone === "boolean"
        ? { companionDone }
        : {}),
      ...(spec.symptoms ? { symptom } : {}),
      // "All clear" is row 2 on the lights tile, so an empty list there is the
      // answer rather than a missing one.
      ...(isLights ? { lights: row === "when" ? lights : [] } : {}),
    });
    sheetRef.current?.close();
  };

  const toggleLight = (id: string) =>
    setLights((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (!spec) return null;

  const rows: { id: RowId; label: string }[] = [
    { id: "when", label: spec.whenLabel },
    { id: "never", label: spec.neverLabel },
    // Plainly "I don't know" on every tile, lights included. "Something's on
    // but I can't tell what" is a DIFFERENT answer and already has a home —
    // the `not_sure_which` chip inside row 1. Conflating the two is the bug
    // Ahmad caught earlier: answering "not sure if a light is on" was scoring
    // as a confirmed unidentified light.
    { id: "unsure", label: "I'm not sure" },
  ];

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[Math.min(SHEET_MAX, Math.max(SHEET_MIN, contentHeight + SHEET_CHROME))]}
      showBackdrop
      liftWithKeyboard
      floatBottomInset={12}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_w, h) => setContentHeight(h)}
      >
        <Text weight="bold" size="xl" color={TEXT_PRIMARY}>
          {spec.question}
        </Text>
        {guided ? (
          <Text size="sm" color={TEXT_SECONDARY} style={styles.subtitle}>
            {spec.subtitle}
          </Text>
        ) : null}

        {rows.map((r) => {
          const active = row === r.id;
          return (
            <View key={r.id}>
              <Pressable
                onPress={() => setRow(r.id)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text weight={active ? "bold" : "medium"} size="md" color={active ? BLUE : TEXT_PRIMARY}>
                  {r.label}
                </Text>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </Pressable>

              {/* The composite reveal sits INSIDE row 1 rather than below the
                  group, so it reads as part of that answer. */}
              {active && r.id === "when" && !isLights ? (
                <View style={styles.reveal}>
                  <MonthYearPicker
                    month={month}
                    year={year}
                    minYear={vehicleYear ?? null}
                    onChange={(next) => {
                      setMonth(next.month);
                      setYear(next.year);
                    }}
                  />

                  {spec.showMilesField ? (
                    <View style={styles.milesRow}>
                      <Text weight="semiBold" size="xs" color={TEXT_MUTED} style={styles.milesLabel}>
                        MILES THEN
                      </Text>
                      <TextInput
                        value={milesText}
                        onChangeText={setMilesText}
                        keyboardType="number-pad"
                        placeholder="Optional"
                        placeholderTextColor={TEXT_MUTED}
                        style={styles.milesInput}
                      />
                    </View>
                  ) : null}

                  {spec.companion ? (
                    <View style={styles.toggleRow}>
                      <Text weight="semiBold" size="xs" color={TEXT_MUTED} style={styles.milesLabel}>
                        {spec.companion.label.toUpperCase()}
                      </Text>
                      <View style={styles.toggleGroup}>
                        {([
                          { id: true, label: "Yes" },
                          { id: false, label: "No" },
                          { id: "unsure", label: "Not sure" },
                        ] as { id: boolean | "unsure"; label: string }[]).map((opt) => {
                          const on = companionDone === opt.id;
                          return (
                            <Pressable
                              key={String(opt.id)}
                              onPress={() => setCompanionDone(opt.id)}
                              style={({ pressed }) => [
                                styles.toggle,
                                on && styles.toggleActive,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text
                                weight={on ? "bold" : "medium"}
                                size="sm"
                                color={on ? "#FFFFFF" : TEXT_PRIMARY}
                              >
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Warning lights multi-select, same reveal position. */}
              {active && r.id === "when" && isLights ? (
                <View style={styles.reveal}>
                  <View style={styles.lightGrid}>
                    {WARNING_LIGHT_OPTIONS.map((opt) => {
                      const on = lights.includes(opt.id);
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => toggleLight(opt.id)}
                          style={({ pressed }) => [
                            styles.lightChip,
                            on && styles.lightChipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            weight={on ? "bold" : "medium"}
                            size="sm"
                            color={on ? BLUE : TEXT_PRIMARY}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Symptoms sit OUTSIDE the radio group — history and symptom are
            separate facts. v1 conflated them by letting "feels fine" mean ON
            TIME, which is untrue on a 60k car with no service history. */}
        {spec.symptoms ? (
          <View style={styles.symptomBlock}>
            <Text weight="semiBold" size="xs" color={TEXT_MUTED} style={styles.milesLabel}>
              NOTICED ANYTHING?
            </Text>
            <View style={styles.symptomRow}>
              {spec.symptoms.map((sx) => {
                const on = symptom === sx.id;
                return (
                  <Pressable
                    key={sx.id}
                    onPress={() => setSymptom(sx.id)}
                    style={({ pressed }) => [
                      styles.lightChip,
                      on && styles.lightChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text weight={on ? "bold" : "medium"} size="sm" color={on ? BLUE : TEXT_PRIMARY}>
                      {sx.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.submit,
            !canSave && styles.submitDisabled,
            pressed && canSave && styles.pressed,
          ]}
        >
          <Text weight="bold" size="md" color={canSave ? "#FFFFFF" : TEXT_MUTED}>
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
    paddingBottom: scale(24),
  },
  subtitle: { marginTop: scale(4), marginBottom: scale(14) },
  pressed: { opacity: 0.7 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: scale(14),
    borderRadius: moderateScale(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: scale(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  optionActive: { borderColor: BLUE, backgroundColor: BLUE_BG },
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
  radioActive: { backgroundColor: BLUE, borderColor: BLUE },
  reveal: {
    paddingHorizontal: scale(4),
    paddingTop: scale(4),
    paddingBottom: scale(8),
  },
  milesRow: { marginTop: scale(14) },
  milesLabel: { letterSpacing: 0.6, marginBottom: scale(6) },
  milesInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: scale(11),
    fontSize: moderateScale(15),
    color: TEXT_PRIMARY,
    backgroundColor: "#FFFFFF",
  },
  toggleRow: { marginTop: scale(14) },
  toggleGroup: { flexDirection: "row", gap: scale(8) },
  toggle: {
    paddingHorizontal: scale(18),
    paddingVertical: scale(9),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  toggleActive: { backgroundColor: BLUE, borderColor: BLUE },
  lightGrid: { flexDirection: "row", flexWrap: "wrap", gap: scale(8), marginTop: scale(10) },
  lightChip: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  lightChipActive: { borderColor: BLUE, backgroundColor: BLUE_BG },
  symptomBlock: { marginTop: scale(18) },
  symptomRow: { flexDirection: "row", flexWrap: "wrap", gap: scale(8) },
  submit: {
    marginTop: scale(20),
    paddingVertical: scale(16),
    borderRadius: moderateScale(999),
    backgroundColor: BLUE,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: "#F3F4F6" },
});

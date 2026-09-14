/**
 * Inline month + year picker.
 *
 * Two horizontal chip rows rather than a wheel. `react-native-month-year-picker`
 * is a dependency but is modal-only, so it cannot render inside a sheet, and
 * `@react-native-community/datetimepicker` cannot do month-without-day. Chips
 * are pure RN, identical on both platforms, and read better inline than a
 * spinner does.
 *
 * No day field on purpose — the spec asks for "roughly when", and one month is
 * all the precision the anchor maths needs.
 */
import React, { useMemo, useRef, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";
import { moderateScale, scale } from "@/utils/responsive";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const BLUE = "#5299FE";
const BLUE_BG = "#EEF4FF";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#111827";
const TEXT_MUTED = "#9CA3AF";

/** How far back the year row goes when the model year is UNKNOWN. With a known
 *  model year the range is derived from the car instead — see `years` below. */
const YEARS_BACK = 15;

export function MonthYearPicker({
  month,
  year,
  onChange,
  /** Model year — nothing before the car existed is a valid service date. */
  minYear,
}: {
  month: number | null;
  year: number | null;
  onChange: (next: { month: number | null; year: number | null }) => void;
  minYear?: number | null;
}) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const years = useMemo(() => {
    // ONE YEAR BEFORE THE MODEL YEAR, up to today.
    //
    // Model years run ahead of the calendar — a 2025 car is on forecourts in
    // 2024 — so the car's own year is not the floor; the year before it is.
    //
    // The old floor was `Math.max(minYear, thisYear - 15)`, which had two
    // faults. On a new car the `max` was a no-op whenever `minYear` was
    // missing, so a 2025 car offered service dates back to 2011 (Ahmad,
    // 2026-09-14). On a car older than fifteen years it was actively wrong the
    // other way: a 2010 car could not be told it was serviced in 2010, because
    // the clamp held the floor at `thisYear - 15`.
    //
    // Derived from the car when we know it, and only falling back to a flat
    // window when we do not.
    const floor =
      minYear != null && Number.isFinite(minYear)
        ? Math.min(minYear - 1, thisYear)
        : thisYear - YEARS_BACK;
    const out: number[] = [];
    for (let y = thisYear; y >= floor; y--) out.push(y);
    return out;
  }, [minYear, thisYear]);

  const yearRow = useRef<ScrollView>(null);
  useEffect(() => {
    // Newest year is leftmost and pre-scrolled — most answers are recent.
    yearRow.current?.scrollTo({ x: 0, animated: false });
  }, []);

  // A service cannot be in the future. When the selected year is this year,
  // months after today are disabled rather than hidden, so the row doesn't
  // reflow as the driver switches years.
  const monthDisabled = (m: number) => year === thisYear && m > thisMonth;

  return (
    <View style={styles.wrap}>
      <Text weight="semiBold" size="xs" color={TEXT_MUTED} style={styles.label}>
        MONTH
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroller}
      >
        {MONTHS.map((label, i) => {
          const m = i + 1;
          const disabled = monthDisabled(m);
          const active = month === m;
          return (
            <Pressable
              key={label}
              disabled={disabled}
              onPress={() => onChange({ month: m, year })}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                disabled && styles.chipDisabled,
                pressed && !disabled && { opacity: 0.7 },
              ]}
            >
              <Text
                weight={active ? "bold" : "medium"}
                size="sm"
                color={disabled ? TEXT_MUTED : active ? BLUE : TEXT_PRIMARY}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text weight="semiBold" size="xs" color={TEXT_MUTED} style={[styles.label, styles.labelGap]}>
        YEAR
      </Text>
      <ScrollView
        ref={yearRow}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroller}
      >
        {years.map((y) => {
          const active = year === y;
          return (
            <Pressable
              key={y}
              onPress={() => {
                // Switching to this year can invalidate a future month.
                const nextMonth = y === thisYear && month != null && month > thisMonth ? null : month;
                onChange({ month: nextMonth, year: y });
              }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text weight={active ? "bold" : "medium"} size="sm" color={active ? BLUE : TEXT_PRIMARY}>
                {y}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: scale(10) },
  // A horizontal ScrollView nested inside the sheet's vertical one will grow
  // to fill unless told not to. flexGrow:0 keeps each row exactly one chip
  // tall; no fixed height, so a larger text size still fits.
  scroller: { flexGrow: 0 },
  label: { letterSpacing: 0.6, marginBottom: scale(6) },
  labelGap: { marginTop: scale(12) },
  row: { gap: scale(8), paddingRight: scale(8) },
  chip: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  chipActive: { borderColor: BLUE, backgroundColor: BLUE_BG },
  chipDisabled: { backgroundColor: "#F9FAFB", borderColor: "#F3F4F6" },
});

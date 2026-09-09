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

/** How far back the year row goes. Fifteen covers any car a driver is likely
 *  to be reporting service on; older than that and "roughly when" stops
 *  meaning much anyway. */
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
    const floor = Math.max(minYear ?? thisYear - YEARS_BACK, thisYear - YEARS_BACK);
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

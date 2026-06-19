/**
 * MonthPickerSheet — Screen 4 month selector.
 *
 * A bottom-sheet style modal launched from the tappable "MONTH YEAR"
 * label in the "Choose a date" header. Lists the current month plus
 * the next `monthsAhead` months so the customer can jump the day
 * picker forward into the future. Past months are never shown.
 */

import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

const MONTH_LABELS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface MonthOption {
  /** 4-digit year, e.g. 2026. */
  year: number;
  /** 1-indexed month, 1 = January. */
  month: number;
}

interface MonthPickerSheetProps {
  visible: boolean;
  /** Currently active view year. */
  selectedYear: number;
  /** Currently active view month (1-indexed). */
  selectedMonth: number;
  /** How many months past the current one to offer (default 11 → 12 total). */
  monthsAhead?: number;
  onSelect: (option: MonthOption) => void;
  onClose: () => void;
}

export function MonthPickerSheet({
  visible,
  selectedYear,
  selectedMonth,
  monthsAhead = 11,
  onSelect,
  onClose,
}: MonthPickerSheetProps) {
  // Build the list starting from the current calendar month forward.
  const options = useMemo<MonthOption[]>(() => {
    const now = new Date();
    const baseYear = now.getFullYear();
    const baseMonthIdx = now.getMonth(); // 0-indexed
    const out: MonthOption[] = [];
    for (let i = 0; i <= monthsAhead; i++) {
      const d = new Date(baseYear, baseMonthIdx + i, 1);
      out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return out;
  }, [monthsAhead]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so taps inside the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.handle} />
          <Text size="lg" weight="bold" color="#0F172A" style={styles.title}>
            Select a month
          </Text>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((opt) => {
              const isSelected =
                opt.year === selectedYear && opt.month === selectedMonth;
              return (
                <Pressable
                  key={`${opt.year}-${opt.month}`}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => onSelect(opt)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${MONTH_LABELS_LONG[opt.month - 1]} ${opt.year}`}
                >
                  <Text
                    size="md"
                    weight={isSelected ? "bold" : "regular"}
                    color={isSelected ? "#1D4ED8" : "#0F172A"}
                  >
                    {MONTH_LABELS_LONG[opt.month - 1]} {opt.year}
                  </Text>
                  {isSelected ? (
                    <Check size={18} color="#1D4ED8" strokeWidth={2.5} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#F4F8FB",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "70%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    marginBottom: 14,
  },
  title: {
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  optionSelected: {
    backgroundColor: "rgba(82, 153, 254, 0.18)",
    borderColor: "rgba(82, 153, 254, 0.55)",
  },
});

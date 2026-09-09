/**
 * ServiceSummaryChip — frosted floating chip at the top of Screen 3.
 *
 * Shows the running selection: 🔧 wrench · "N services · ~M min
 * total" · ▼ chevron. Tap goes back to Screen 2 to edit the
 * selection. (An inline expandable list is a polish item for
 * later; back-nav is enough for Phase 3.)
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { ChevronDown, Wrench } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

interface ServiceSummaryChipProps {
  count: number;
  totalMinutes: number;
}

export function ServiceSummaryChip({ count, totalMinutes }: ServiceSummaryChipProps) {
  const router = useRouter();
  const timeText = formatTotalMinutes(totalMinutes);

  return (
    <Pressable
      style={styles.chip}
      onPress={() => {
        if (router.canGoBack()) router.back();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${count} services, total ${timeText}. Edit selection.`}
    >
      <View style={styles.iconCircle}>
        <Wrench size={14} color="#4B5563" strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text size="sm" weight="semiBold" color="#0F172A">
          {count} service{count === 1 ? "" : "s"} · {timeText}
        </Text>
      </View>
      <ChevronDown size={16} color="#6B7280" strokeWidth={2} />
    </Pressable>
  );
}

function formatTotalMinutes(min: number): string {
  if (min <= 0) return "Time TBD";
  if (min < 60) return `~${min} min total`;
  const hrs = Math.floor(min / 60);
  const rem = min - hrs * 60;
  if (rem === 0) return `~${hrs} hr total`;
  return `~${hrs} hr ${rem} min total`;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E5EBF1",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingRight: 2,
  },
});

/**
 * CategoryListRow — Screen 1 list row for each v5 tab. Tap pushes
 * to the category-detail screen (Screen 2) with the tab key as a
 * route param.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  ChevronRight,
  ClipboardCheck,
  CircleDot,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import type { TaxonomyTab } from "@/constants/serviceTaxonomy";

interface CategoryListRowProps {
  tabKey: TaxonomyTab;
  label: string;
  serviceCount: number;
}

const ICONS: Record<TaxonomyTab, LucideIcon> = {
  routine_upkeep: Wrench,
  tires_brakes: CircleDot,
  major_service: Calendar,
  inspections: ClipboardCheck,
};

export function CategoryListRow({ tabKey, label, serviceCount }: CategoryListRowProps) {
  const router = useRouter();
  const Icon = ICONS[tabKey];

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        router.push({
          pathname: "/(booking-flow)/category/[tab]",
          params: { tab: tabKey },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${serviceCount} services`}
    >
      <View style={styles.iconTile}>
        <Icon size={20} color="#4B5563" strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <Text size="md" weight="semiBold" color="#0F172A">
          {label}
        </Text>
        <Text size="sm" weight="regular" color="#6B7280">
          {serviceCount} service{serviceCount === 1 ? "" : "s"}
        </Text>
      </View>
      <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
});

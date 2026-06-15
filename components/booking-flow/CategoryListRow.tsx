/**
 * CategoryListRow — Screen 1 list row for each v5 tab. Tap pushes
 * to the category-detail screen (Screen 2) with the tab key as a
 * route param.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  SharedTransition,
  Easing,
} from "react-native-reanimated";
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

// Shared transition between Screen 1's CategoryListRow title and
// Screen 2's header title. Reanimated 4's SharedTransition is a
// ComplexAnimationBuilder — chainable .duration().easing() form
// is the right way to spec a custom curve. Duration matches the
// booking-flow stack's fade (320ms) so the icon/title morph and the
// screen cross-fade settle together; ease-out cubic-bezier reads as
// a smooth, glassy morph rather than a snappy spring.
export const categoryTitleTransition = SharedTransition.duration(320).easing(
  Easing.bezier(0.22, 1, 0.36, 1),
);

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
      <Animated.View
        style={styles.iconTile}
        sharedTransitionTag={`cat-icon-${tabKey}`}
        sharedTransitionStyle={categoryTitleTransition}
      >
        <Icon size={20} color="#4B5563" strokeWidth={2} />
      </Animated.View>
      <View style={styles.text}>
        <Animated.Text
          sharedTransitionTag={`cat-title-${tabKey}`}
          sharedTransitionStyle={categoryTitleTransition}
          style={styles.titleSource}
        >
          {label}
        </Animated.Text>
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  titleSource: {
    fontFamily: "Urbanist-SemiBold",
    fontSize: 16,
    lineHeight: 22,
    color: "#0F172A",
  },
});

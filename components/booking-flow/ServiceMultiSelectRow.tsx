/**
 * ServiceMultiSelectRow — Screen 2 row card.
 *
 * Layout: icon tile · title row (label + ⓘ) · subtitle · meta row
 * (clock + est-time). Right side trailing state: chevron when
 * unselected, check when selected, and a small "Quote" badge when
 * variant === "quote" (tire-replacement) takes the user to the
 * dedicated picker.
 *
 * Render states (driven by the v5 coverage filter from the parent):
 *  - bookable                → tappable normal
 *  - needs_specs             → greyed + tappable (parent opens
 *                              PackageQuestionsSheet inline)
 *  - blocked_by_enrichment   → greyed, no-op
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Battery,
  BatteryCharging,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Disc,
  Droplet,
  Filter,
  Gauge,
  Info,
  type LucideIcon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import type { TaxonomyEntry } from "@/constants/serviceTaxonomy";

const SLUG_ICONS: Record<string, LucideIcon> = {
  oil_change: Droplet,
  filter_replacement: Filter,
  battery_test: Battery,
  battery_replacement: BatteryCharging,
  state_inspection: ClipboardCheck,
  emissions_test: ShieldCheck,
  check_engine_light: Zap,
  diagnostic_scan: Search,
  pre_purchase_inspection: ClipboardCheck,
  tire_rotation: Disc,
  tire_balance: Gauge,
  wheel_alignment: Settings,
  tire_replacement: Disc,
  brake_pad_replacement: Disc,
  rotor_replacement: Disc,
  brake_fluid_flush: Droplet,
  spark_plugs: Sparkles,
  timing_belt: Wrench,
  coolant_flush: Droplet,
  transmission_service: Droplet,
  power_steering_flush: Droplet,
  differential_service: Droplet,
  fuel_system_cleaning: Sparkles,
};

interface ServiceMultiSelectRowProps {
  slug: string;
  entry: TaxonomyEntry;
  /** Per-vehicle "About 24 min" or the taxonomy fallback. Parent
   *  picks the right one. */
  durationText: string;
  isSelected: boolean;
  /** Coverage-filter state. Drives the visual state + tap behavior. */
  state: "bookable" | "needs_specs" | "blocked";
  onPress: () => void;
  onInfoPress: () => void;
}

export function ServiceMultiSelectRow({
  slug,
  entry,
  durationText,
  isSelected,
  state,
  onPress,
  onInfoPress,
}: ServiceMultiSelectRowProps) {
  const Icon = SLUG_ICONS[slug] ?? Wrench;
  const isQuote = entry.variant === "quote";
  const isBlocked = state === "blocked";
  const isNeedsSpecs = state === "needs_specs";

  return (
    <Pressable
      style={[
        styles.row,
        isSelected && styles.rowSelected,
        isBlocked && styles.rowBlocked,
      ]}
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: isBlocked }}
      accessibilityLabel={`${entry.label}. ${entry.subtitle}. ${durationText}.`}
    >
      <View style={styles.iconTile}>
        <Icon size={22} color="#4B5563" strokeWidth={2} />
      </View>

      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text size="md" weight="bold" color="#0F172A" numberOfLines={2} style={styles.title}>
            {entry.label}
          </Text>
          <Pressable
            onPress={onInfoPress}
            hitSlop={10}
            accessibilityLabel={`More info about ${entry.label}`}
          >
            <Info size={15} color="#9CA3AF" strokeWidth={2} />
          </Pressable>
        </View>
        <Text size="sm" weight="regular" color="#6B7280" numberOfLines={2} style={styles.subtitle}>
          {entry.subtitle}
        </Text>
        {isNeedsSpecs ? (
          <Text size="xs" weight="semiBold" color="#2563EB" style={styles.needsSpecsHint}>
            Tap to answer a quick spec question
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        <View style={styles.timeRow}>
          {!isQuote ? <Clock size={14} color="#6B7280" strokeWidth={2} /> : null}
          <Text size="xs" weight="medium" color="#6B7280">
            {isQuote ? "Quote" : durationText}
          </Text>
        </View>
        {isSelected ? (
          <View style={styles.stateCheck}>
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        ) : (
          <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  rowSelected: {
    backgroundColor: "rgba(82, 153, 254, 0.18)",
    borderColor: "rgba(82, 153, 254, 0.55)",
  },
  rowBlocked: {
    opacity: 0.45,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  needsSpecsHint: {
    marginTop: 4,
  },
  trailing: {
    alignItems: "flex-end",
    gap: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stateCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
});

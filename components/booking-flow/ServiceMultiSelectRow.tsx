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
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import {
  Check,
  ChevronRight,
  Clock,
  HelpCircle,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow } from "@/constants/theme";
import { getServiceIcon } from "@/components/booking-flow/serviceIcons";
import type { TaxonomyEntry } from "@/constants/serviceTaxonomy";

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
  const Icon = getServiceIcon(slug);
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
      {Platform.OS === "ios" ? (
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.iconTile}>
        <Icon size={22} color="#4B5563" strokeWidth={2} />
      </View>

      {/* Text column — title / subtitle / clock + estimated time.
          `paddingRight` leaves headroom for the absolute `?`
          button in the top-right so the title never runs under it. */}
      <View style={styles.text}>
        <Text
          size="md"
          weight="bold"
          color="#0F172A"
          numberOfLines={2}
          style={styles.title}
        >
          {entry.label}
        </Text>
        <Text
          size="sm"
          weight="regular"
          color="#6B7280"
          numberOfLines={2}
          style={styles.subtitle}
        >
          {entry.subtitle}
        </Text>
        {isNeedsSpecs ? (
          <Text size="xs" weight="semiBold" color="#2563EB" style={styles.needsSpecsHint}>
            Tap to answer a quick spec question
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {!isQuote ? <Clock size={14} color="#6B7280" strokeWidth={2} /> : null}
          <Text size="sm" weight="medium" color="#6B7280">
            {isQuote ? "Quote" : durationText}
          </Text>
        </View>
      </View>

      {/* Trailing state indicator — check when selected, chevron
          otherwise. Centered vertically on the row instead of
          stacked under the time (which now lives in the text col). */}
      <View style={styles.trailing}>
        {isSelected ? (
          <View style={styles.stateCheck}>
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
          </View>
        ) : (
          <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
        )}
      </View>

      {/* Info button — top-right corner of the card, bumped from
          15 → 20 pt. Positioned absolutely so it sits above the
          title's right edge instead of inline in the title row. */}
      <Pressable
        onPress={onInfoPress}
        hitSlop={14}
        style={styles.infoBtn}
        accessibilityRole="button"
        accessibilityLabel={`More info about ${entry.label}`}
      >
        <HelpCircle size={20} color="#5299FE" strokeWidth={2} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    // Bumped paddings all around so the content breathes — the
    // old 14/14 was cramming the icon, text, meta, and trailing
    // chevron together. 18/16 gives each element its own air.
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 14,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    overflow: "hidden",
    boxShadow: CardShadow.default,
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
    // Leaves headroom for the absolute `?` in the top-right so
    // the title's rightmost characters never run under it.
    paddingRight: 28,
  },
  title: {
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 4,
  },
  needsSpecsHint: {
    marginTop: 6,
  },
  metaRow: {
    // The estimated time now sits below the subtitle rather than
    // stacked in the trailing column. Generous top margin so it
    // reads as separate meta info, not a third line of body copy.
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  trailing: {
    // Just the state indicator (check / chevron) now — the time
    // moved into the text column above.
    alignItems: "flex-end",
    justifyContent: "center",
  },
  stateCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtn: {
    // Top-right corner of the card. Bumped from an inline 15pt
    // icon in the title row to a 20pt icon anchored here.
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
});

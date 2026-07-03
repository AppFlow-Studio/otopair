/**
 * EnrichmentStatusPill — persistent Airbnb-style status pill shown while
 * a vehicle is still being enriched by the v3 pipeline.
 *
 * Replaces the one-shot enrichment toasts (select-services focus toast,
 * home's deferred "Connecting to your <car>" toast): a toast fades away,
 * but the enrichment block doesn't — so the status now stays on screen
 * for as long as `enrichment_status` is in progress and removes itself
 * the moment the pipeline finishes (the underlying hooks are reactive
 * Convex queries, no polling needed).
 *
 * Visual spec per Temur: match Airbnb's "Prices include all fees" pill —
 * way smaller than a toast, one icon, one line, no wrap. Wears the same
 * brand-blue glass gradient as the toast family.
 *
 * MOUNTED IN:
 *   - app/(booking-flow)/_layout.tsx — scope "selected" + placement "top":
 *     the flow cares about the ACTIVE vehicle (that's what blocks booking),
 *     and the bottom edge is busy with continue bars.
 *   - app/(main-tabs)/_layout.tsx — scope "any" + placement "bottom":
 *     a just-added car is usually NOT the selected one, so the tabs watch
 *     the whole garage; the pill hovers above the tab bar like Airbnb's.
 *
 * To toggle it on for another page, just render <EnrichmentStatusPill />
 * inside any full-screen container (for main-tab pages, add the path to
 * ENRICHMENT_PILL_PATHS in app/(main-tabs)/_layout.tsx instead).
 * pointerEvents "none" keeps it from stealing touches.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";

import { Text } from "@/components/shared-ui";
import { TOAST_GRADIENT } from "@/components/toast/Toast";
import { TOAST_SHADOW } from "@/components/toast/tokens";
import { api } from "@/convex/_generated/api";
import { useVehicleEnrichmentStatus } from "@/hooks/useVehicleEnrichmentStatus";
import { useVehicleStore } from "@/stores/useVehicleStore";

// The custom TabBar floats at `insets.bottom + 8` and is ~64pt tall
// (components/navigation/TabBar.tsx); +12 breathing room clears it,
// and the iOS 26 native tab bar, comfortably.
const TAB_BAR_CLEARANCE = 84;

interface EnrichmentStatusPillProps {
  /** "top" hangs under the status bar (booking flow); "bottom" hovers
   *  above the tab bar, Airbnb-style (main tabs). Default "top". */
  placement?: "top" | "bottom";
  /** "selected" watches the active vehicle only (booking flow); "any"
   *  watches the whole garage and names the enriching car (main tabs).
   *  Default "selected". */
  scope?: "selected" | "any";
}

export function EnrichmentStatusPill({
  placement = "top",
  scope = "selected",
}: EnrichmentStatusPillProps) {
  const insets = useSafeAreaInsets();
  const selectedVin = useVehicleStore((s) => s.getSelectedVehicle()?.vin ?? null);

  // Garage-wide sweep (same query the completion watcher uses). Skipped
  // entirely in "selected" scope.
  const fleet = useQuery(
    api.vehicles.getMyVehiclesEnrichmentStatus,
    scope === "any" ? {} : "skip",
  );
  const inProgressEntry =
    scope === "any"
      ? ((fleet ?? []) as Array<{ vin: string; label: string; phase: string }>).find(
          (v) => v.phase === "in_progress",
        ) ?? null
      : null;

  // ETA detail for whichever VIN we're surfacing. In "any" scope this
  // may briefly lag the fleet query — the pill just omits the suffix
  // until it lands.
  const vin = scope === "any" ? (inProgressEntry?.vin ?? null) : selectedVin;
  const enrichment = useVehicleEnrichmentStatus(vin);

  const visible =
    scope === "any" ? inProgressEntry != null : enrichment?.isInProgress === true;
  if (!visible) return null;

  // Mirror the old toast's 7-minute baseline: past it the ETA math is
  // stale, so stop quoting minutes and just reassure.
  const pastBaseline =
    enrichment?.elapsedMs != null && enrichment.elapsedMs > 7 * 60 * 1000;
  const eta = enrichment?.isInProgress ? enrichment.etaMinutes : null;
  const suffix = pastBaseline
    ? " · almost there"
    : eta != null
      ? ` · ~${eta} min`
      : "";

  // "any" scope names the car (matches the old home toast's
  // universal-language copy); "selected" keeps it short — the user is
  // already looking at that car's booking flow.
  const subject = scope === "any" && inProgressEntry ? inProgressEntry.label : "your car";
  const message = `Connecting to ${subject === "your car" ? subject : `your ${subject}`}${suffix}`;

  const anchor =
    placement === "bottom"
      ? { bottom: insets.bottom + TAB_BAR_CLEARANCE }
      : { top: insets.top + 8 };

  return (
    <View style={[styles.overlay, anchor]} pointerEvents="none">
      <Animated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(220)}
        style={[styles.pill, TOAST_SHADOW.light]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={message}
      >
        <LinearGradient
          colors={TOAST_GRADIENT as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Live spinner instead of a static glyph — the pill's whole job
            is to say "work is happening right now". */}
        <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
        <Text
          size="sm"
          weight="semiBold"
          color="#FFFFFF"
          numberOfLines={1}
          style={styles.label}
        >
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 9998,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    overflow: "hidden",
    // Fallback bg matching the gradient's deep stop in case the
    // gradient races a hot reload, same trick as Toast.tsx.
    backgroundColor: "#5299FE",
  },
  spinner: {
    // iOS "small" is 20pt — a touch big for a 32pt pill; scale it
    // down instead of importing a custom spinner.
    transform: [{ scale: 0.8 }],
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
});

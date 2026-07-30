/**
 * EnrichmentStatusPill — persistent status pill shown while a vehicle is
 * still being enriched by the v3 pipeline, now tappable to reveal a detail
 * sheet.
 *
 * Replaces the one-shot enrichment toasts (select-services focus toast,
 * home's deferred "Connecting to your <car>" toast): a toast fades away,
 * but the enrichment block doesn't — so the status now stays on screen
 * for as long as `enrichment_status` is in progress and removes itself
 * the moment the pipeline finishes (the underlying hooks are reactive
 * Convex queries, no polling needed).
 *
 * TWO SHAPES, one per placement:
 *   - "bottom"  → compact bottom-RIGHT pill (16pt inset above the tab bar)
 *     with a subtly-pulsing sparkle + "Personalizing", per the v9 design.
 *   - "top"     → the original centered pill under the status bar with a
 *     live spinner + "Connecting to your <car> · ~N min".
 * Either shape is a button: tapping it opens a FloatingSheet that explains
 * what's happening and shows a step checklist derived from the pipeline's
 * coarse status (see deriveSteps — the pipeline reports a single status
 * string, not per-category truth, so the checklist is an ordered heuristic).
 *
 * MOUNTED IN:
 *   - app/(booking-flow)/_layout.tsx — scope "selected" + placement "top":
 *     the flow cares about the ACTIVE vehicle (that's what blocks booking),
 *     and the bottom edge is busy with continue bars.
 *   - app/(main-tabs)/_layout.tsx — scope "any" + placement "bottom":
 *     a just-added car is usually NOT the selected one, so the tabs watch
 *     the whole garage; the pill hovers bottom-right above the tab bar.
 *
 * To toggle it on for another page, just render <EnrichmentStatusPill />
 * inside any full-screen container (for main-tab pages, add the path to
 * ENRICHMENT_PILL_PATHS in app/(main-tabs)/_layout.tsx instead).
 * The overlay is pointerEvents "box-none" so only the pill itself catches
 * touches — the rest of the screen stays interactive.
 */

import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Check, Sparkles } from "lucide-react-native";

import { Button, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TOAST_GRADIENT } from "@/components/toast/Toast";
import { TOAST_SHADOW } from "@/components/toast/tokens";
import { BrandColors, SemanticColors } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { useVehicleEnrichmentStatus } from "@/hooks/useVehicleEnrichmentStatus";
import { useVehicleStore } from "@/stores/useVehicleStore";

// The custom TabBar floats at `insets.bottom + 8` and is ~64pt tall
// (components/navigation/TabBar.tsx); +12 breathing room clears it,
// and the iOS 26 native tab bar, comfortably.
const TAB_BAR_CLEARANCE = 84;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// One-detent sheet, tall enough for the copy block + 3-step checklist +
// button on the smallest supported phones; FloatingSheet caps to full height.
const SHEET_HEIGHT = Math.min(580, SCREEN_HEIGHT * 0.72);

// Coarse-status → 3 friendly steps. The pipeline reports a single
// enrichment_status string (see convex/vehicles.ts), NOT per-category
// truth, so this is an ordered heuristic: as the status walks the known
// sequence, each step flips pending → active → done, and exactly one step
// is ever "active" (the spinner). Unknown/early statuses fall back to the
// first step so the sheet never renders an all-pending checklist.
const STATUS_ORDER = ["started", "batch1", "batch2", "scraping", "enriching"];

type StepState = "done" | "active" | "pending";
interface DerivedStep {
  label: string;
  state: StepState;
}

function deriveSteps(status: string | null): DerivedStep[] {
  const raw = status ? STATUS_ORDER.indexOf(status) : -1;
  const i = raw < 0 ? 0 : raw; // unknown / not-yet-loaded → treat as start
  return [
    { label: "Vehicle specs", state: i >= 2 ? "done" : "active" },
    {
      label: "Service intervals",
      state: i >= 3 ? "done" : i >= 2 ? "active" : "pending",
    },
    { label: "Part catalog", state: i >= 3 ? "active" : "pending" },
  ];
}

interface EnrichmentStatusPillProps {
  /** "top" hangs under the status bar (booking flow); "bottom" hovers
   *  bottom-right above the tab bar (main tabs). Default "top". */
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
  const sheetRef = useRef<FloatingSheetRef>(null);
  const selectedVin = useVehicleStore((s) => s.getSelectedVehicle()?.vin ?? null);

  // Subtle sparkle pulse for the compact pill (design: "sparkle pulses
  // subtly"). Runs regardless of shape — cheap, and only rendered when
  // compact. Started once on mount.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);
  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.8 + pulse.value * 0.2,
  }));

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
  const subjectPhrase = subject === "your car" ? "your car" : `your ${subject}`;
  const message = `Connecting to ${subjectPhrase}${suffix}`;

  const compact = placement === "bottom";
  const pillLabel = compact ? "Personalizing" : message;

  const overlayAnchor = compact
    ? {
        bottom: insets.bottom + TAB_BAR_CLEARANCE,
        alignItems: "flex-end" as const,
        paddingHorizontal: 16,
      }
    : {
        top: insets.top + 8,
        alignItems: "center" as const,
        paddingHorizontal: 32,
      };

  const steps = deriveSteps(enrichment?.status ?? null);
  const etaLine = pastBaseline
    ? "Almost there — finishing up."
    : eta != null
      ? `About ${eta} min remaining`
      : null;

  return (
    <>
      <View style={[styles.overlay, overlayAnchor]} pointerEvents="box-none">
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(220)}>
          <Pressable
            onPress={() => sheetRef.current?.open()}
            style={({ pressed }) => [
              styles.pill,
              TOAST_SHADOW.light,
              pressed && styles.pillPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={message}
            accessibilityHint="Shows what we're still setting up for your car"
          >
            <LinearGradient
              colors={TOAST_GRADIENT as unknown as readonly [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {compact ? (
              // Sparkle = brand/AI signal on the compact pill; the live
              // spinners live inside the sheet's per-step checklist.
              <Animated.View style={sparkleStyle}>
                <Sparkles size={16} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
              </Animated.View>
            ) : (
              // Live spinner instead of a static glyph — the top pill's
              // whole job is to say "work is happening right now".
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
            )}
            <Text
              size="sm"
              weight="semiBold"
              color="#FFFFFF"
              numberOfLines={1}
              style={styles.label}
            >
              {pillLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <FloatingSheet
        ref={sheetRef}
        snapHeights={[SHEET_HEIGHT]}
        showBackdrop
        backdropMode="dim"
        cornerRadius={32}
      >
        <View style={[styles.sheetBody, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetIconChip}>
            <Sparkles size={22} color={SemanticColors.primaryBlue} />
          </View>
          <Text size="2xl" weight="bold" color={BrandColors.primary} style={styles.sheetTitle}>
            We&apos;re personalizing your app
          </Text>
          <Text size="md" color={SemanticColors.textSecondary} style={styles.sheetSubtitle}>
            {`Pulling the exact specs, service intervals, and part details for ${subjectPhrase} — so every recommendation is built for your car, not a generic estimate.`}
          </Text>

          <View style={styles.checklistCard}>
            {steps.map((step) => (
              <View key={step.label} style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  {step.state === "done" ? (
                    <Check size={16} color={SemanticColors.successGreen} strokeWidth={3} />
                  ) : step.state === "active" ? (
                    <ActivityIndicator
                      size="small"
                      color={SemanticColors.primaryBlue}
                      style={styles.stepSpinner}
                    />
                  ) : (
                    <View style={styles.stepPendingDot} />
                  )}
                </View>
                <Text
                  size="md"
                  weight="medium"
                  color={
                    step.state === "pending" ? SemanticColors.textMuted : BrandColors.primary
                  }
                >
                  {step.label}
                </Text>
              </View>
            ))}
          </View>

          {etaLine ? (
            <Text size="sm" color={SemanticColors.textMuted} style={styles.etaLine}>
              {etaLine}
            </Text>
          ) : null}

          <Button
            variant="primary"
            fullWidth
            backgroundColor={SemanticColors.primaryBlue}
            borderRadius={14}
            paddingVertical={14}
            onPress={() => sheetRef.current?.close()}
            style={styles.gotItButton}
          >
            Got it
          </Button>
        </View>
      </FloatingSheet>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
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
  pillPressed: {
    opacity: 0.9,
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

  // ── Detail sheet ──────────────────────────────────────────────────────
  sheetBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetIconChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.10)",
    marginBottom: 20,
  },
  sheetTitle: {
    marginBottom: 12,
  },
  sheetSubtitle: {
    lineHeight: 24,
    marginBottom: 24,
  },
  checklistCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSpinner: {
    transform: [{ scale: 0.7 }],
  },
  stepPendingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: SemanticColors.border,
  },
  etaLine: {
    marginTop: 16,
  },
  gotItButton: {
    marginTop: 24,
  },
});

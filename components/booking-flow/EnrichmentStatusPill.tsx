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
 * Either shape is a button: tapping it opens a FloatingSheet with a hero car
 * render (VehicleDatabases) and a per-category checklist backed by REAL data
 * presence (api.vehicles.getEnrichmentDetail — a category is ✓ only when its
 * rows actually exist, never a status heuristic). On open the ✓ rings pop in
 * staggered and each ready row types out real enriched facts (MPG, engine,
 * "Spark Plugs · every 100,000 mi") with a backspace-and-next typewriter.
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

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, StyleSheet, View } from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react-native";

import { Button, Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TOAST_SHADOW } from "@/components/toast/tokens";
import { BrandColors, SemanticColors } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { useVehicleEnrichmentStatus } from "@/hooks/useVehicleEnrichmentStatus";
import { useVehicleImage } from "@/utils/vehicleImage";
import { useVehicleStore } from "@/stores/useVehicleStore";

// Sit the compact pill just above the tab bar. The iOS 26 native tab bar
// occupies ~49pt above the home indicator; this clearance parks the pill
// a hair above it (was 84 — too high, read as floating mid-content).
const TAB_BAR_CLEARANCE = 60;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// Compact one-detent sheet: header + copy + a single "thinking" ticker + button.
const SHEET_HEIGHT = Math.min(440, SCREEN_HEIGHT * 0.6);

// OtoPair AI mark — pulses Claude-style beside the streaming facts.
const OTOPAIR_AI_LOGO = require("@/assets/images/otopair-ai-logo.png");

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
  // Drives the on-open ring/typing animations — set true when we open the
  // sheet, cleared on close so the animations replay next time.
  const [sheetOpen, setSheetOpen] = useState(false);
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
  // Bigger breathing pulse for the sheet's "thinking" logo (Claude-style).
  const thinkingPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.16 }],
    opacity: 0.72 + pulse.value * 0.28,
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

  // Rich per-category detail (real data presence + typeable facts) for the
  // sheet. Skipped until we have a VIN; loads lazily behind the pill.
  const detail = useQuery(api.vehicles.getEnrichmentDetail, vin ? { vin } : "skip");
  // Real car render (VehicleDatabases) for the sheet hero. Empty make/model
  // until `detail` lands → the hook no-ops and returns a null url.
  const carImage = useVehicleImage(
    detail?.make ?? "",
    detail?.model ?? "",
    detail?.year ?? undefined,
    vin ?? undefined,
    undefined,
    detail?.trim ?? undefined,
  );

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
  const compactLabel =
    subject && subject !== "your car"
      ? `${subject}`
      : "Personalizing…";
  const pillLabel = compact ? compactLabel : message;

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

  const allReady = detail?.phase === "ready";
  // Every REAL fact gathered so far — the "thinking" ticker cycles them.
  const facts = detail?.facts ?? [];
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
            onPress={() => {
              sheetRef.current?.open();
              setSheetOpen(true);
            }}
            style={({ pressed }) => [
              styles.pill,
              TOAST_SHADOW.light,
              pressed && styles.pillPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={message}
            accessibilityHint="Shows what we're still setting up for your car"
          >
            {compact ? (
              // Sparkle = brand/AI signal on the compact pill; the live
              // spinners live inside the sheet's detail ticker.
              <Animated.View style={sparkleStyle}>
                <Sparkles
                  size={16}
                  color={SemanticColors.primaryBlue}
                  fill={SemanticColors.primaryBlue}
                  strokeWidth={0}
                />
              </Animated.View>
            ) : (
              // Live spinner instead of a static glyph — the top pill's
              // whole job is to say "work is happening right now".
              <ActivityIndicator
                size="small"
                color={SemanticColors.primaryBlue}
                style={styles.spinner}
              />
            )}
            <Text
              size="sm"
              weight="semiBold"
              color={BrandColors.primary}
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
        onClose={() => setSheetOpen(false)}
      >
        <View style={[styles.sheetBody, { paddingBottom: insets.bottom + 10 }]}>
          {/* Header: car name on the left, circular car render on the right. */}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text
                size="xs"
                weight="bold"
                color={SemanticColors.primaryBlue}
                style={styles.eyebrow}
              >
                {allReady ? "READY" : "PERSONALIZING"}
              </Text>
              <Text size="2xl" weight="bold" color={BrandColors.primary}>
                {detail?.label ?? subject}
              </Text>
            </View>
            <View style={styles.avatarCircle}>
              {carImage.url ? (
                <Image
                  source={{ uri: carImage.url }}
                  style={styles.avatarImage}
                  resizeMode="contain"
                />
              ) : (
                <Sparkles size={22} color={SemanticColors.primaryBlue} />
              )}
            </View>
          </View>
          <Text size="md" color={SemanticColors.textSecondary} style={styles.sheetSubtitle}>
            {allReady
              ? "Everything below is pulled from your car's real specs — not a generic estimate."
              : `Pulling the exact specs, service intervals, and part details for ${subjectPhrase} — so every recommendation is built for your car, not a generic estimate.`}
          </Text>

          {/* Claude-style "thinking": the OtoPair mark pulses while the real
              facts we've gathered stream past, one after another. */}
          <View style={styles.thinkingCard}>
            <Animated.Image
              source={OTOPAIR_AI_LOGO}
              style={[styles.thinkingLogo, thinkingPulseStyle]}
              resizeMode="contain"
            />
            <View style={styles.thinkingTextWrap}>
              {facts.length > 0 ? (
                <TypingFact facts={facts} active={sheetOpen} />
              ) : (
                <Text size="sm" weight="medium" color={SemanticColors.textMuted}>
                  Gathering your car&apos;s details…
                </Text>
              )}
            </View>
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

/**
 * Types a real fact out char-by-char, holds, backspaces, then advances to the
 * next — looping the category's facts. Plain timers (text mutation, not a
 * reanimated value). Resets when `active` goes false so it replays each open.
 */
function TypingFact({ facts, active }: { facts: string[]; active: boolean }) {
  const [text, setText] = useState("");
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const factsKey = facts.join("¦");

  useEffect(() => {
    if (!active || factsRef.current.length === 0) {
      setText("");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let factIndex = 0;
    let charIndex = 0;
    let phase: "typing" | "hold" | "deleting" = "typing";

    const tick = () => {
      if (cancelled) return;
      const list = factsRef.current;
      const fact = list[factIndex % list.length] ?? "";
      if (phase === "typing") {
        charIndex += 1;
        setText(fact.slice(0, charIndex));
        timer = setTimeout(tick, charIndex >= fact.length ? 1500 : 42);
        if (charIndex >= fact.length) phase = "hold";
      } else if (phase === "hold") {
        if (list.length <= 1) {
          // Single fact — hold it, don't pointlessly retype.
          timer = setTimeout(tick, 1500);
          return;
        }
        phase = "deleting";
        timer = setTimeout(tick, 300);
      } else {
        charIndex -= 1;
        setText(fact.slice(0, Math.max(0, charIndex)));
        if (charIndex <= 0) {
          factIndex = (factIndex + 1) % list.length;
          phase = "typing";
          timer = setTimeout(tick, 260);
        } else {
          timer = setTimeout(tick, 24);
        }
      }
    };
    timer = setTimeout(tick, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, factsKey]);

  return (
    <Text
      size="sm"
      weight="semiBold"
      color={SemanticColors.primaryBlue}
      numberOfLines={2}
      style={styles.factText}
    >
      {text}
      <Text size="sm" color={SemanticColors.primaryBlue}>
        ▌
      </Text>
    </Text>
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
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    overflow: "hidden",
    // Airbnb-style white card: clean white with a hairline border; the soft
    // TOAST_SHADOW lifts it off the screen.
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(20, 28, 36, 0.10)",
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    letterSpacing: 0.8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  sheetSubtitle: {
    lineHeight: 24,
    marginBottom: 18,
  },
  thinkingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  thinkingLogo: {
    width: 32,
    height: 32,
  },
  thinkingTextWrap: {
    flex: 1,
    // Reserve two lines so the card doesn't jump as facts type in/out.
    minHeight: 38,
    justifyContent: "center",
  },
  factText: {
    // Real enriched fact typed out char-by-char (TypingFact). Tabular figures
    // keep the width from jittering as digits stream in.
    fontVariant: ["tabular-nums"],
  },
  etaLine: {
    marginTop: 12,
  },
  gotItButton: {
    marginTop: 14,
  },
});

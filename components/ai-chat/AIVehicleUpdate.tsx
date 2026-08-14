/**
 * AIVehicleUpdate
 *
 * PURPOSE: One-tap confirm card for user-stated vehicle truth. Oto fires
 * render_vehicle_update when the user states a mileage reading, a named fault
 * light, and/or a service they report due/done; this card is the explicit
 * confirm before any of it is written. On Confirm it calls
 * vehicleTruth.applyVehicleTruth, which guards mileage (monotonic + plausible),
 * maps service claims to the maintenance pipeline, appends fault lights, and
 * re-runs the pipeline.
 *
 * Branches on the mutation's three return shapes:
 *   (a) ok:true                                  → success banner + onDecision
 *   (b) ok:false, reconfirmable:true             → inline reconfirm ("Apply anyway"
 *       (reason "absurd_forward")                  re-sends with reconfirmed:true)
 *   (c) ok:false, reconfirmable:false            → hard error (no override)
 *       (reason "backward" | "implausible")
 *
 * Rendered when message.showVehicleUpdate is set on an assistant message
 * (envelope packaged by convex/oto/dispatcher.ts → render_vehicle_update;
 * vehicle_id stamped on the frontend from the active chat vehicle).
 *
 * SAFETY: mirrors AIRecordConfirmation's "Suggest, don't mutate" principle —
 * Oto fires the render, the user explicitly taps Confirm; only then does
 * applyVehicleTruth fire. Oto never writes user data autonomously.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";

// 2. Expo & Third-party
import Animated, { FadeInUp } from "react-native-reanimated";
import { Check, X } from "lucide-react-native";
import { useMutation } from "convex/react";

// 3. Convex
import { api } from "@/convex/_generated/api";

// 4. Shared UI (design system)
import { Text } from "@/components/shared-ui";

// 5. Constants, hooks, types
import {
  BrandColors,
  BorderRadius,
  Spacing,
  FontFamily,
} from "@/constants/theme";
import type { VehicleUpdatePayload } from "@/services/ai/types";

// ============================================================================
// TYPES
// ============================================================================

/** Reported back to the parent on a successful apply so it can send a
 *  follow-up turn to Oto (mirrors AIRecordConfirmation's onDecision). */
export interface VehicleUpdateOutcome {
  mileageUpdated: boolean;
  servicesFlagged: string[];
  servicesCompleted: string[];
  /** Subset of servicesCompleted the user HEDGED ("I think…", "pretty sure…").
   *  Written server-side with a softer confidence label (W4.3 / QA K3). */
  servicesCompletedHedged: string[];
  faultLightsAdded: string[];
}

// Shape of applyVehicleTruth's return (the mutation is typed `any` server-side;
// this is the documented contract — schematic §4).
type TruthResult = {
  ok?: boolean;
  needsReconfirm?: boolean;
  reconfirmable?: boolean;
  reason?: "backward" | "implausible" | "absurd_forward" | string;
  current?: number | null;
  proposed?: number;
  maxAllowed?: number;
  mileageUpdated?: boolean;
  servicesFlagged?: string[];
  servicesCompleted?: string[];
  servicesCompletedHedged?: string[];
  faultLightsAdded?: string[];
};

interface AIVehicleUpdateProps {
  payload: VehicleUpdatePayload;
  /** Called once the user successfully applies the update. Parent should send a
   *  follow-up turn to Oto so the next assistant message reacts to the outcome. */
  onDecision?: (outcome: VehicleUpdateOutcome) => void;
  /** Called when the user DECLINES the card ("Not now" / "Cancel"). Nothing is
   *  written; the parent tells Oto the user declined so it doesn't keep claiming
   *  the update was logged. Without this, a dismiss died at local state and Oto's
   *  prior "I'll log that…" narrative read as a soft confirmation. */
  onDismiss?: () => void;
  disabled?: boolean;
}

// ============================================================================
// FORMATTERS
// ============================================================================

const num = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString();

/** brake_pad_replacement → "Brake Pad Replacement" */
function humanizeSlug(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** check_engine → "Check-Engine" (special-cased), otherwise title-cased. */
function humanizeLight(code: string): string {
  if (code.toLowerCase() === "check_engine") return "Check-Engine";
  return humanizeSlug(code);
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Human "when" suffix for a past completed service ("a week ago", "3 months ago"). */
function describeAge(ageDays?: number, dateMs?: number): string | null {
  let days = ageDays;
  if (days == null && dateMs != null) {
    days = Math.round((Date.now() - dateMs) / 86_400_000);
  }
  if (days == null || days <= 0) return null;
  if (days === 1) return "yesterday";
  if (days < 14) return days === 7 ? "a week ago" : `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** The one-line rows the card shows for the present payload fields (schematic §3). */
function buildRows(payload: VehicleUpdatePayload): string[] {
  const rows: string[] = [];
  // Guard against a malformed mileage (Haiku can emit "" / NaN). `!= null` let a
  // non-number through and rendered a blank "Update odometer to  mi" row; require
  // a finite number so the row only shows a real reading.
  if (typeof payload.mileage === "number" && Number.isFinite(payload.mileage)) {
    rows.push(`Update odometer to ${num(payload.mileage)} mi`);
  }
  for (const claim of payload.service_claims ?? []) {
    const label = humanizeSlug(claim.service_slug);
    if (claim.kind === "completed") {
      // Surface the past anchor the user is about to write, so the confirm is honest.
      const when: string[] = [];
      if (claim.service_mileage != null) when.push(`at ${num(claim.service_mileage)} mi`);
      const ago = describeAge(claim.service_age_days, claim.service_date);
      if (ago) when.push(ago);
      // Hedged claim ("I think…", "pretty sure…") — say so on the row, so the
      // user confirms what will actually be written: a log noted as unsure.
      const hedged =
        claim.stated_confidence === "hedged"
          ? " (you weren't sure — we'll note that)"
          : "";
      rows.push(
        `Log ${label} as done${when.length ? ` (${when.join(", ")})` : ""}${hedged}`,
      );
    } else {
      rows.push(`Flag ${label} as due`);
    }
  }
  for (const light of payload.fault_lights ?? []) {
    rows.push(`Log ${humanizeLight(light)} light`);
  }
  return rows;
}

/** Plain-language copy for a HARD (non-reconfirmable) rejection. */
function rejectionMessage(res: TruthResult): string {
  switch (res.reason) {
    case "backward":
      return `That's below your recorded ${num(res.current)} mi — an odometer can't go backward.`;
    case "implausible":
      return `That isn't a valid odometer reading.`;
    default:
      return `Couldn't apply that${res.reason ? `: ${res.reason}` : ""}.`;
  }
}

/** Reconfirm prompt for a big-but-real forward jump (absurd_forward). */
function reconfirmMessage(res: TruthResult): string {
  return `Big jump — your record shows ${num(res.current)} mi, and ${num(
    res.proposed,
  )} mi is past the one-step limit of ${num(res.maxAllowed)} mi. Confirm it's real?`;
}

/** Success summary line. */
function appliedMessage(res: TruthResult): string {
  const parts: string[] = [];
  if (res.mileageUpdated) parts.push("mileage updated");
  if (res.servicesCompleted?.length) {
    // Hedged services were still written, but as unsure — say so.
    const hedged = new Set(res.servicesCompletedHedged ?? []);
    parts.push(
      `logged ${res.servicesCompleted
        .map((s) => humanizeSlug(s) + (hedged.has(s) ? " (noted as unsure)" : ""))
        .join(", ")} as done`,
    );
  }
  if (res.servicesFlagged?.length)
    parts.push(`flagged ${res.servicesFlagged.map(humanizeSlug).join(", ")}`);
  if (res.faultLightsAdded?.length)
    parts.push(`logged ${res.faultLightsAdded.map(humanizeLight).join(", ")}`);
  return parts.length ? capitalize(parts.join(" · ")) : "Done";
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AIVehicleUpdate({
  payload,
  onDecision,
  onDismiss,
  disabled,
}: AIVehicleUpdateProps) {
  const applyVehicleTruth = useMutation(api.vehicleTruth.applyVehicleTruth);

  const [submitting, setSubmitting] = useState(false);
  // Terminal states: "applied" (success banner) / "dismissed" (cancelled).
  const [resolved, setResolved] = useState<null | "applied" | "dismissed">(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Set when the mutation returns a reconfirmable (absurd_forward) rejection.
  const [reconfirm, setReconfirm] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(payload), [payload]);

  const submit = useCallback(
    async (reconfirmed: boolean) => {
      if (submitting || resolved) return;
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const res = (await applyVehicleTruth({
          vehicle_id: payload.vehicle_id,
          ...(typeof payload.mileage === "number" && Number.isFinite(payload.mileage)
            ? { mileage: payload.mileage }
            : {}),
          ...(payload.service_claims !== undefined
            ? { service_claims: payload.service_claims }
            : {}),
          ...(payload.fault_lights !== undefined
            ? { fault_lights: payload.fault_lights }
            : {}),
          ...(reconfirmed ? { reconfirmed: true } : {}),
        })) as TruthResult;

        if (res?.ok) {
          setReconfirm(null);
          setSuccessText(appliedMessage(res));
          setResolved("applied");
          onDecision?.({
            mileageUpdated: !!res.mileageUpdated,
            servicesFlagged: res.servicesFlagged ?? [],
            servicesCompleted: res.servicesCompleted ?? [],
            servicesCompletedHedged: res.servicesCompletedHedged ?? [],
            faultLightsAdded: res.faultLightsAdded ?? [],
          });
        } else if (res?.needsReconfirm && res?.reconfirmable) {
          // Big-but-real forward jump — surface the inline reconfirm prompt.
          setReconfirm(reconfirmMessage(res));
        } else {
          // Hard rejection (backward / implausible) — no override.
          setReconfirm(null);
          setErrorMessage(rejectionMessage(res));
        }
      } catch (err) {
        console.warn("[AIVehicleUpdate] apply failed", err);
        setErrorMessage("Couldn't save that. Tap to retry.");
      } finally {
        setSubmitting(false);
      }
    },
    [applyVehicleTruth, onDecision, payload, resolved, submitting],
  );

  // Decline path — "Not now" / "Cancel". Writes nothing; reports the dismissal
  // up so the parent can tell Oto the user declined (guarded against double-fire
  // the same way submit() is).
  const handleDismiss = useCallback(() => {
    if (submitting || resolved) return;
    setResolved("dismissed");
    onDismiss?.();
  }, [submitting, resolved, onDismiss]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Resolved — keep the card's anatomy (eyebrow + row) so this reads as the
  // same component that just settled, not a different floating pill. The row
  // dot grows into a status badge; text stays in the body typography.
  if (resolved) {
    const applied = resolved === "applied";
    return (
      <Animated.View entering={FadeInUp.duration(150)} style={styles.container}>
        <Text style={styles.label} weight="semiBold">
          Vehicle update
        </Text>
        <View style={styles.row}>
          <View style={[styles.resolvedBadge, !applied && styles.resolvedBadgeMuted]}>
            {applied ? (
              <Check size={12} color={BrandColors.white} strokeWidth={3} />
            ) : (
              <X size={12} color={NEUTRAL_TEXT} strokeWidth={3} />
            )}
          </View>
          <Text style={[styles.rowText, !applied && styles.rowTextMuted]}>
            {applied ? successText ?? "Got it — updated." : "Dismissed."}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(180)} style={styles.container}>
      <Text style={styles.label} weight="semiBold">
        Vehicle update
      </Text>

      <View style={styles.rows}>
        {rows.map((row, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rowDot} />
            <Text style={styles.rowText}>{row}</Text>
          </View>
        ))}
      </View>

      {/* Reconfirm prompt — only for an absurd_forward jump. */}
      {reconfirm ? (
        <View style={styles.reconfirmBlock}>
          <Text style={styles.reconfirmText} weight="medium">
            {reconfirm}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => submit(true)}
              disabled={disabled || submitting}
              style={({ pressed }) => [
                styles.btn,
                styles.btnConfirm,
                (disabled || submitting) && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Check size={14} color={BrandColors.white} strokeWidth={3} />
              <Text style={styles.btnConfirmText} weight="semiBold">
                {submitting ? "Applying…" : "Apply anyway"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDismiss}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btn,
                styles.btnCancel,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.btnCancelText} weight="semiBold">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => submit(false)}
            disabled={disabled || submitting || rows.length === 0}
            style={({ pressed }) => [
              styles.btn,
              styles.btnConfirm,
              (disabled || submitting || rows.length === 0) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Check size={14} color={BrandColors.white} strokeWidth={3} />
            <Text style={styles.btnConfirmText} weight="semiBold">
              {submitting ? "Applying…" : "Confirm"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleDismiss}
            disabled={submitting}
            style={({ pressed }) => [
              styles.btn,
              styles.btnCancel,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnCancelText} weight="semiBold">
              Not now
            </Text>
          </Pressable>
        </View>
      )}

      {errorMessage && (
        <Pressable onPress={() => submit(false)} style={styles.errorBanner}>
          <Text style={styles.errorText} weight="medium">
            {errorMessage}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ============================================================================
// STYLES — mirrors AIRecordConfirmation's glass-light language.
// ============================================================================

const NEUTRAL_TEXT = "#4A5568";
const NEUTRAL_TEXT_DIM = "#A0AEC0";
const NEUTRAL_BORDER = "#D1D5DB";
const SURFACE_GLASS = "rgba(255, 255, 255, 0.6)";

const styles = StyleSheet.create({
  container: {
    backgroundColor: SURFACE_GLASS,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
  },
  label: {
    fontSize: 11,
    color: NEUTRAL_TEXT_DIM,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    fontFamily: FontFamily.semiBold,
  },
  rows: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.secondary,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: BrandColors.primary,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  btnConfirm: {
    backgroundColor: BrandColors.secondary,
  },
  btnCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: NEUTRAL_BORDER,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnConfirmText: {
    color: BrandColors.white,
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  btnCancelText: {
    color: NEUTRAL_TEXT,
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  reconfirmBlock: {
    gap: Spacing.sm,
  },
  reconfirmText: {
    fontSize: 13,
    color: "#C2410C",
    lineHeight: 19,
    fontFamily: FontFamily.medium,
  },
  resolvedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  resolvedBadgeMuted: {
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  rowTextMuted: {
    color: NEUTRAL_TEXT,
  },
  errorBanner: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: "rgba(254, 226, 226, 0.85)",
    borderRadius: BorderRadius.md,
  },
  errorText: {
    fontSize: 12,
    color: "#B91C1C",
    fontFamily: FontFamily.medium,
  },
});

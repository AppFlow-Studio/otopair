/**
 * AIRecordConfirmation
 *
 * PURPOSE: Surface a self_reported maintenance record to the user when their
 * symptom contradicts what we have on file. Shows the record's stated
 * date/mileage with two options: confirm it's still correct (locks status to
 * on_time for 90 days via confirmedHealthyAt), or update it with new values
 * (writes a new lastServiceDate / lastServiceMileage with serviceSource
 * "ai_chat_correction"). Either way the user's decision is reported back to
 * the parent via onDecision so it can be pushed into conversation_state and
 * Oto sees the result on the next turn.
 *
 * Rendered when message.showRecordConfirmation is set on an assistant message
 * (envelope packaged by convex/oto/dispatcher.ts → render_record_confirmation).
 *
 * SAFETY: This component is the ONLY user-data-write path triggered by an AI
 * suggestion. The "Suggest, don't mutate" principle: Oto fires the render,
 * the user explicitly taps Confirm or Update — only then does the mutation
 * fire. Oto never writes user data autonomously.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, StyleSheet, TextInput } from "react-native";

// 2. Expo & Third-party
import Animated, { FadeInUp } from "react-native-reanimated";
import { Check, Pencil } from "lucide-react-native";
import { useQuery, useMutation } from "convex/react";

// 3. Convex
import { api } from "@/convex/_generated/api";

// 4. Shared UI (design system)
import { Text } from "@/components/shared-ui";
// Not exported from the shared-ui barrel — import direct.
import { DatePickerMonthYear } from "@/components/shared-ui/DatePickerMonthYear";

// 5. Constants, hooks, types
import {
  BrandColors,
  BorderRadius,
  Spacing,
  FontFamily,
} from "@/constants/theme";
import {
  MAINTENANCE_LABELS,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";

// ============================================================================
// TYPES
// ============================================================================

export type RecordConfirmationDecision =
  | { kind: "confirmed"; type: MaintenanceType }
  | {
      kind: "updated";
      type: MaintenanceType;
      lastServiceDate: number; // ms epoch
      lastServiceMileage?: number;
    }
  // "declined" — user dismissed without confirming or correcting. Writes
  // NOTHING (Suggest-don't-mutate); only tells Oto the record was NOT confirmed
  // so it doesn't treat it as validated on the next turn.
  | { kind: "declined"; type: MaintenanceType };

interface AIRecordConfirmationProps {
  vehicleId: string; // vehicles._id from envelope
  maintenanceType: MaintenanceType;
  /** Called once the user confirms or submits an update. Parent should send a
   *  follow-up turn to Oto so the next assistant message reacts to the
   *  decision. */
  onDecision: (decision: RecordConfirmationDecision) => void;
  disabled?: boolean;
}

// ============================================================================
// FORMATTERS
// ============================================================================

function formatRecordDate(ms?: number): string {
  if (ms == null) return "Unknown date";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatMileage(mi?: number): string | null {
  if (mi == null) return null;
  return `${mi.toLocaleString()} mi`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AIRecordConfirmation({
  vehicleId,
  maintenanceType,
  onDecision,
  disabled,
}: AIRecordConfirmationProps) {
  // Two-step state machine: "prompt" (initial confirm/deny) → "form" (date+mileage input).
  const [step, setStep] = useState<"prompt" | "form">("prompt");
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState(false);
  // Inline failure surface — fires when upsertRecord throws. Console warns
  // are kept for telemetry; this string drives a small banner so the user
  // can retry instead of seeing a silent no-op tap.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update-form local state
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newMileageStr, setNewMileageStr] = useState<string>("");

  // Data fetch — single helper query that resolves owner + record in one round-trip.
  const data = useQuery(api.oto.recordConfirmation.getRecordForConfirmation, {
    vehicle_id: vehicleId,
    maintenance_type: maintenanceType,
  });

  const upsertRecord = useMutation(api.maintenance.upsertRecord);

  const label = MAINTENANCE_LABELS[maintenanceType] ?? maintenanceType;
  const dateText = formatRecordDate(data?.record?.lastServiceDate);
  const mileageText = formatMileage(data?.record?.lastServiceMileage);

  const summaryLine = useMemo(() => {
    if (!data) return "Loading record…";
    if (!data.record) {
      return `We don't have a record on file for ${label.toLowerCase()}. When did you last service it?`;
    }
    const parts: string[] = [`our records show your ${label.toLowerCase()} was serviced`];
    if (data.record.lastServiceDate != null) parts.push(`in ${dateText}`);
    if (mileageText) parts.push(`at ${mileageText}`);
    return capitalize(parts.join(" ")) + ". Is that still right?";
  }, [data, label, dateText, mileageText]);

  // ---------------------------------------------------------------------------
  // Confirm path — record is correct as-is. Stamp confirmedHealthyAt to lock
  // on_time for 90 days (CONFIRMED_HEALTHY_TTL_MS in utils/maintenanceStatus.ts).
  // ---------------------------------------------------------------------------
  const handleConfirm = useCallback(async () => {
    if (submitting || resolved || !data) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await upsertRecord({
        vehicleOwnerId: data.vehicleOwnerId as any,
        type: maintenanceType,
        // Keep existing date/mileage — only stamp the confirmation timestamp.
        lastServiceDate: data.record?.lastServiceDate,
        lastServiceMileage: data.record?.lastServiceMileage,
        confirmedHealthyAt: Date.now(),
        // Don't touch confidence/serviceSource — user only attested it's still
        // correct, didn't add new evidence. Preserve whatever's there.
      });
      setResolved(true);
      onDecision({ kind: "confirmed", type: maintenanceType });
    } catch (err) {
      // Surface failure but don't block the user from retrying.
      console.warn("[AIRecordConfirmation] confirm failed", err);
      setErrorMessage("Couldn't save that. Tap to retry.");
    } finally {
      setSubmitting(false);
    }
  }, [data, maintenanceType, onDecision, resolved, submitting, upsertRecord]);

  // Decline path — user dismissed without confirming or correcting. Writes
  // nothing; only reports the decline so Oto stops treating the record as
  // validated. Guarded against double-fire like the confirm path.
  const handleDecline = useCallback(() => {
    if (submitting || resolved) return;
    setResolved(true);
    onDecision({ kind: "declined", type: maintenanceType });
  }, [maintenanceType, onDecision, resolved, submitting]);

  // ---------------------------------------------------------------------------
  // Update path — user said the record is wrong. Switch to inline form.
  // ---------------------------------------------------------------------------
  const handleStartUpdate = useCallback(() => {
    if (submitting || resolved) return;
    // Pre-fill the form with the existing values so the user can tweak rather
    // than start from scratch.
    if (data?.record?.lastServiceDate != null) {
      setNewDate(new Date(data.record.lastServiceDate));
    }
    if (data?.record?.lastServiceMileage != null) {
      setNewMileageStr(String(data.record.lastServiceMileage));
    }
    setStep("form");
  }, [data, resolved, submitting]);

  const handleSubmitUpdate = useCallback(async () => {
    if (submitting || resolved || !data) return;
    if (!newDate) return; // date is required for the update path
    const parsedMileage = newMileageStr.trim()
      ? Number.parseInt(newMileageStr.replace(/[^0-9]/g, ""), 10)
      : undefined;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await upsertRecord({
        vehicleOwnerId: data.vehicleOwnerId as any,
        type: maintenanceType,
        lastServiceDate: newDate.getTime(),
        lastServiceMileage: Number.isFinite(parsedMileage as number)
          ? (parsedMileage as number)
          : undefined,
        // The user just typed a new value in the chat — soft data, no
        // backing document. Mark it as such so future trust-protocol calls
        // know this isn't a verified update.
        serviceSource: "ai_chat_correction",
        confidence: "self_reported",
      });
      setResolved(true);
      onDecision({
        kind: "updated",
        type: maintenanceType,
        lastServiceDate: newDate.getTime(),
        lastServiceMileage: Number.isFinite(parsedMileage as number)
          ? (parsedMileage as number)
          : undefined,
      });
    } catch (err) {
      console.warn("[AIRecordConfirmation] update failed", err);
      setErrorMessage("Couldn't save that. Tap to retry.");
    } finally {
      setSubmitting(false);
    }
  }, [
    data,
    maintenanceType,
    newDate,
    newMileageStr,
    onDecision,
    resolved,
    submitting,
    upsertRecord,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Resolved state — show a small confirmation banner and stop accepting input.
  if (resolved) {
    return (
      <Animated.View entering={FadeInUp.duration(150)} style={styles.container}>
        <View style={styles.resolvedBanner}>
          <Check size={14} color={BrandColors.white} strokeWidth={3} />
          <Text style={styles.resolvedText} weight="medium">
            Got it — thanks for confirming.
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(180)} style={styles.container}>
      <Text style={styles.label} weight="semiBold">
        {label}
      </Text>
      <Text style={styles.summary}>{summaryLine}</Text>

      {step === "prompt" && data && (
        <>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleConfirm}
              disabled={disabled || submitting || !data.record}
              style={({ pressed }) => [
                styles.btn,
                styles.btnConfirm,
                (disabled || !data.record) && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Check size={14} color={BrandColors.white} strokeWidth={3} />
              <Text style={styles.btnConfirmText} weight="semiBold">
                Yes, that's right
              </Text>
            </Pressable>
            <Pressable
              onPress={handleStartUpdate}
              disabled={disabled || submitting}
              style={({ pressed }) => [
                styles.btn,
                styles.btnUpdate,
                disabled && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Pencil size={14} color={BrandColors.primary} strokeWidth={2.5} />
              <Text style={styles.btnUpdateText} weight="semiBold">
                {data.record ? "No, update it" : "Add a record"}
              </Text>
            </Pressable>
          </View>
          {/* Explicit decline — writes nothing, but tells Oto the record was
              NOT confirmed so it stops treating it as validated. */}
          <Pressable
            onPress={handleDecline}
            disabled={disabled || submitting}
            style={({ pressed }) => [styles.declineBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.declineText} weight="medium">
              Not now
            </Text>
          </Pressable>
        </>
      )}

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText} weight="medium">
            {errorMessage}
          </Text>
        </View>
      )}

      {step === "form" && (
        <View style={styles.formBlock}>
          <Text style={styles.formLabel} weight="medium">
            When was it last serviced?
          </Text>
          <DatePickerMonthYear
            value={newDate}
            onChange={setNewDate}
            placeholder="Select month & year"
            title={`Last ${label.toLowerCase()} service`}
            maximumDate={new Date()}
          />
          <Text style={[styles.formLabel, styles.formLabelSpaced]} weight="medium">
            Mileage at the time (optional)
          </Text>
          <TextInput
            value={newMileageStr}
            onChangeText={setNewMileageStr}
            placeholder="e.g. 38000"
            placeholderTextColor={NEUTRAL_TEXT_DIM}
            keyboardType="number-pad"
            editable={!submitting && !disabled}
            style={styles.mileageInput}
          />
          <Pressable
            onPress={handleSubmitUpdate}
            disabled={!newDate || submitting || disabled}
            style={({ pressed }) => [
              styles.btnSubmit,
              (!newDate || submitting || disabled) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnConfirmText} weight="semiBold">
              {submitting ? "Saving…" : "Save update"}
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// STYLES — modeled after AIDiagnosticForm's glass-light language. BrandColors
// only has primary/secondary/white/black/background, so neutral grays come
// from raw hex values matching the rest of the AI chat surface.
// ============================================================================

const NEUTRAL_TEXT = "#4A5568";
const NEUTRAL_TEXT_DIM = "#A0AEC0";
const NEUTRAL_BORDER = "#D1D5DB";
const SURFACE_GLASS = "rgba(255, 255, 255, 0.6)";
const SURFACE_GLASS_INNER = "rgba(255, 255, 255, 0.5)";

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
    marginBottom: Spacing.xs,
    fontFamily: FontFamily.semiBold,
  },
  summary: {
    fontSize: 14,
    color: BrandColors.primary,
    lineHeight: 20,
    marginBottom: Spacing.md,
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
  btnUpdate: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: NEUTRAL_BORDER,
  },
  btnPressed: {
    opacity: 0.85,
  },
  declineBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  declineText: {
    fontSize: 12,
    color: NEUTRAL_TEXT_DIM,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnConfirmText: {
    color: BrandColors.white,
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  btnUpdateText: {
    color: BrandColors.secondary,
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  formBlock: {
    gap: Spacing.xs,
  },
  formLabel: {
    fontSize: 12,
    color: NEUTRAL_TEXT,
    fontFamily: FontFamily.medium,
  },
  formLabelSpaced: {
    marginTop: Spacing.sm,
  },
  mileageInput: {
    backgroundColor: SURFACE_GLASS_INNER,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: BrandColors.primary,
    fontFamily: FontFamily.regular,
  },
  btnSubmit: {
    marginTop: Spacing.md,
    backgroundColor: BrandColors.secondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  resolvedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
  },
  resolvedText: {
    fontSize: 12,
    color: BrandColors.white,
    fontFamily: FontFamily.medium,
  },
  errorBanner: {
    marginTop: Spacing.xs,
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

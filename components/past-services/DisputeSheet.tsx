/**
 * DisputeSheet
 *
 * "Report an issue" composer. Opens after the user picks Report an
 * issue from <PastServiceActionsSheet />. Customer picks a reason
 * chip, types a description, and submits — the Convex action
 * `support_requests_node.submitSupportRequest` mails the request to
 * support@otopair.com (reply-to set to the customer so ops can hit
 * Reply directly).
 *
 * After a successful send the sheet flips to a confirmation panel
 * with a Done button so the user gets clear feedback without us
 * having to surface a global toast.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useAction } from "convex/react";
import { Check, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const INK = "#0F172A";
const MUTED = "#6B7280";
const ACCENT = "#5299FE";
const DANGER = "#EF4444";

const REASONS: { key: string; label: string }[] = [
  { key: "service_quality", label: "Service quality" },
  { key: "billing_issue", label: "Billing / pricing" },
  { key: "mechanic_conduct", label: "Mechanic conduct" },
  { key: "work_not_done", label: "Work not completed" },
  { key: "scheduling_no_show", label: "Scheduling / no-show" },
  { key: "other", label: "Other" },
];

const SNAP_HEIGHT = 580;

export interface DisputeSheetRef {
  open: () => void;
  close: () => void;
}

interface DisputeSheetProps {
  bookingId: string | null;
}

export const DisputeSheet = forwardRef<DisputeSheetRef, DisputeSheetProps>(
  function DisputeSheet({ bookingId }, ref) {
    const sheetRef = useRef<FloatingSheetRef>(null);
    const [mounted, setMounted] = useState(false);
    const [reasonKey, setReasonKey] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [sentOk, setSentOk] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const submit = useAction(api.support_requests_node.submitSupportRequest);

    useImperativeHandle(ref, () => ({
      open: () => {
        // Fresh state each time the sheet opens.
        setReasonKey(null);
        setMessage("");
        setSentOk(false);
        setErrorText(null);
        setMounted(true);
      },
      close: () => sheetRef.current?.close(),
    }));

    useEffect(() => {
      if (mounted) sheetRef.current?.open();
    }, [mounted]);

    if (!mounted) return null;

    const canSubmit =
      !!bookingId && !!reasonKey && message.trim().length > 0 && !submitting;

    const onSubmit = async () => {
      if (!canSubmit || !bookingId || !reasonKey) return;
      setSubmitting(true);
      setErrorText(null);
      try {
        const result = await submit({
          bookingId: bookingId as Id<"bookings">,
          reasonKey,
          message: message.trim(),
        });
        if (result.ok) {
          setSentOk(true);
        } else {
          setErrorText(result.error || "We couldn't send your report. Please try again.");
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "We couldn't send your report. Please try again.";
        setErrorText(msg);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={[SNAP_HEIGHT]}
        showBackdrop
        backdropMode="dim"
        liftWithKeyboard
        onClose={() => setMounted(false)}
      >
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text weight="bold" size="lg" color={INK}>
              {sentOk ? "Report sent" : "Report an issue"}
            </Text>
            <Pressable
              style={styles.closeBtn}
              hitSlop={8}
              onPress={() => sheetRef.current?.close()}
              accessibilityLabel="Close"
            >
              <X size={16} color={INK} strokeWidth={2.4} />
            </Pressable>
          </View>

          {sentOk ? (
            <SuccessPanel onDone={() => sheetRef.current?.close()} />
          ) : (
            <>
              <Text size="sm" color={MUTED} style={styles.subtitle}>
                Pick what happened, add a quick note, and our team will get
                back to you by email.
              </Text>

              <Text weight="semiBold" size="xs" color={MUTED} style={styles.sectionLabel}>
                WHAT HAPPENED
              </Text>
              <View style={styles.chipsWrap}>
                {REASONS.map((r) => {
                  const selected = r.key === reasonKey;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setReasonKey(r.key)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && !selected && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={r.label}
                    >
                      <Text
                        weight={selected ? "bold" : "semiBold"}
                        size="sm"
                        color={selected ? "#FFFFFF" : INK}
                      >
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text weight="semiBold" size="xs" color={MUTED} style={styles.sectionLabel}>
                DETAILS
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us a bit about what went wrong…"
                placeholderTextColor="#9CA3AF"
                multiline
                style={styles.textArea}
                maxLength={4000}
                accessibilityLabel="Describe the issue"
              />

              {errorText ? (
                <Text size="sm" color={DANGER} style={styles.errorText}>
                  {errorText}
                </Text>
              ) : null}

              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.submit,
                  !canSubmit && styles.submitDisabled,
                  pressed && canSubmit && styles.submitPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send report"
                accessibilityState={{ disabled: !canSubmit }}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text weight="bold" size="md" color="#FFFFFF">
                    Send report
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </FloatingSheet>
    );
  },
);

interface SuccessPanelProps {
  onDone: () => void;
}

function SuccessPanel({ onDone }: SuccessPanelProps) {
  return (
    <View style={styles.successPanel}>
      <View style={styles.successBadge}>
        <Check size={28} color="#FFFFFF" strokeWidth={2.5} />
      </View>
      <Text weight="bold" size="md" color={INK} center style={styles.successTitle}>
        We&apos;ve got your report
      </Text>
      <Text size="sm" color={MUTED} center style={styles.successSub}>
        Support will follow up by email. We usually get back within a business day.
      </Text>
      <Pressable
        onPress={onDone}
        style={({ pressed }) => [
          styles.submit,
          styles.successDoneBtn,
          pressed && styles.submitPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text weight="bold" size="md" color="#FFFFFF">
          Done
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    marginBottom: 18,
  },
  sectionLabel: {
    letterSpacing: 0.7,
    marginTop: 4,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
  chipPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.1)",
  },
  chipSelected: {
    backgroundColor: ACCENT,
  },
  textArea: {
    minHeight: 110,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: INK,
    fontSize: 15,
    fontFamily: "Urbanist-Regular",
    textAlignVertical: "top",
  },
  errorText: {
    marginTop: 10,
  },
  submit: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: {
    backgroundColor: "rgba(82, 153, 254, 0.45)",
  },
  submitPressed: {
    opacity: 0.9,
  },
  successPanel: {
    alignItems: "center",
    paddingVertical: 18,
  },
  successDoneBtn: {
    alignSelf: "stretch",
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    marginBottom: 6,
  },
  successSub: {
    paddingHorizontal: 18,
    marginBottom: 22,
  },
});

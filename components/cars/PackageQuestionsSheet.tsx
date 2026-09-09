/**
 * PackageQuestionsSheet
 *
 * Bottom sheet shown from the My Cars vehicle-detail screen when a vehicle has
 * unanswered package questions (e.g. "Does this M3 have the optional carbon-
 * ceramic brake package?"). Each question gets two cards: "Yes, I have this"
 * and "No, I don't." Confirm submits all answers via `recordPackageAnswers` —
 * no skip button, because answering is the only way to unlock the affected
 * services in the booking flow.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (per-vehicle CTA on the detail view)
 *
 * SEE: docs/TICKET_PACKAGE_QUESTIONS.md
 *      docs/PACKAGE_AWARE_PARTS.md (backend design, shipped)
 */

import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMutation } from "convex/react";
import { Check, ChevronLeft } from "lucide-react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PendingPackageQuestion } from "@/hooks/useVehicleReadiness";

// ============================================================================
// TYPES
// ============================================================================

// "unsure" is a client-only option per Ahmad — backend has no
// dedicated bucket for it. We submit it as part of `denied` so:
//   (a) the question stops re-prompting (pending list filter uses
//       `!confirmed && !denied`), and
//   (b) the price band stays on the safe side (no optional-package
//       assumption → cheaper stock fitment, no overpromise).
type Answer = "yes" | "no" | "unsure";

interface PackageQuestionsSheetProps {
  visible: boolean;
  vehicleOwnerId: string;
  questions: PendingPackageQuestion[];
  /** Used in the sheet header. Pass the formatted "{year} {make} {model}". */
  vehicleLabel: string;
  onClose: () => void;
  /** Fires after the answers persist successfully. */
  onSubmitted?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PackageQuestionsSheet({
  visible,
  vehicleOwnerId,
  questions,
  vehicleLabel,
  onClose,
  onSubmitted,
}: PackageQuestionsSheetProps) {
  const insets = useSafeAreaInsets();
  const recordAnswers = useMutation(api.serviceParts.recordPackageAnswers);

  // Local state: code → answer. Cleared each time the sheet re-opens.
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setAnswers({});
      setIsSubmitting(false);
    }
  }, [visible]);

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.code] !== undefined);

  const handleConfirm = async () => {
    if (!allAnswered || isSubmitting) return;
    setIsSubmitting(true);
    const confirmed: string[] = [];
    const denied: string[] = [];
    for (const q of questions) {
      const a = answers[q.code];
      if (a === "yes") confirmed.push(q.code);
      // "no" and "unsure" both route to denied — see the Answer type
      // comment above for why "unsure" is safe to bucket here.
      else if (a === "no" || a === "unsure") denied.push(q.code);
    }
    try {
      await recordAnswers({
        vehicleOwnerId: vehicleOwnerId as Id<"vehicle_owners">,
        confirmed,
        denied,
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      // Surface failure inline by re-enabling the button; the reactive query
      // will refresh the pending list anyway, so a partial-success retry is safe.
      console.warn("[PackageQuestionsSheet] recordPackageAnswers failed:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} hitSlop={8}>
            <ChevronLeft size={24} color={BrandColors.primary} />
          </Pressable>
          <Text size="xl" weight="bold" color={BrandColors.primary}>
            Quick spec check
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text size="md" weight="semiBold" color={BrandColors.primary}>
            {vehicleLabel}
          </Text>
          <Text size="sm" weight="regular" color="#6B7280" style={styles.lede}>
            Tell us which optional packages your car was ordered with. Your
            answers stay on your profile — we won&apos;t ask again.
          </Text>

          {questions.map((q) => {
            const picked = answers[q.code];
            return (
              <View key={q.code} style={styles.questionBlock}>
                <Text size="md" weight="semiBold" color={BrandColors.primary}>
                  {q.label}
                </Text>
                <View style={styles.optionsRow}>
                  <AnswerCard
                    label="Yes, I have this"
                    selected={picked === "yes"}
                    onPress={() =>
                      setAnswers((prev) => ({ ...prev, [q.code]: "yes" }))
                    }
                  />
                  <AnswerCard
                    label="No, I don't"
                    selected={picked === "no"}
                    onPress={() =>
                      setAnswers((prev) => ({ ...prev, [q.code]: "no" }))
                    }
                  />
                  <AnswerCard
                    label="Not sure"
                    selected={picked === "unsure"}
                    onPress={() =>
                      setAnswers((prev) => ({ ...prev, [q.code]: "unsure" }))
                    }
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!allAnswered || isSubmitting) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!allAnswered || isSubmitting}
            activeOpacity={0.85}
          >
            <Text size="md" weight="bold" color={BrandColors.white}>
              {isSubmitting ? "Saving…" : "Confirm"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// ANSWER CARD
// ============================================================================

interface AnswerCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function AnswerCard({ label, selected, onPress }: AnswerCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.answerCard, selected && styles.answerCardSelected]}
    >
      <Text
        size="md"
        weight={selected ? "semiBold" : "regular"}
        color={selected ? BrandColors.secondary : BrandColors.primary}
      >
        {label}
      </Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <Check size={12} color={BrandColors.white} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 36 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing["2xl"],
    gap: Spacing.lg,
  },
  lede: {
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  questionBlock: {
    gap: Spacing.sm,
  },
  optionsRow: {
    gap: Spacing.sm,
  },
  answerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#F8FAFC",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: "transparent",
  },
  answerCardSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F0F7FF",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: BrandColors.secondary,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
  confirmButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: 999,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
});

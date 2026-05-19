/**
 * AIFeedbackModal
 *
 * PURPOSE: Sprint 4 — opened by the thumbs-up / thumbs-down buttons on each
 * AI message bubble. Collects an optional comment plus optional category tags
 * and submits to `api.ai_feedback.submit`. Each submission is tied to the
 * conversation row so the owner can review the full thread when troubleshooting.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";

import { useMutation } from "convex/react";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { ThumbsDown, ThumbsUp, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, FontFamily, Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackRating = "thumbs_up" | "thumbs_down";

interface AIFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  // The rating the user picked from the bubble. Both ratings open the same
  // modal — the rating chip at the top reflects which thumb was tapped.
  rating: FeedbackRating;
  // The conversation that holds this message. Required for review-side joining.
  conversationId: Id<"ai_conversations">;
  // Optional — the persisted ai_messages row id. May be undefined when the
  // message hasn't been persisted yet (e.g. still streaming).
  messageId?: Id<"ai_messages">;
  // The AI message content shown to the user. Snapshotted into the feedback
  // row so review remains faithful even after edits / re-generations.
  messageContent: string;
}

// Tag vocabulary — different per rating so the choices match the sentiment.
// Loose `string` so server-side persistence keeps working if we extend.
const POSITIVE_TAGS = [
  "Helpful",
  "Accurate",
  "Clear",
  "Good tone",
  "Solved my problem",
] as const;

const NEGATIVE_TAGS = [
  "Wrong info",
  "Confusing",
  "Off tone",
  "Missed context",
  "Refused unnecessarily",
  "Other",
] as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIFeedbackModal({
  visible,
  onClose,
  rating,
  conversationId,
  messageId,
  messageContent,
}: AIFeedbackModalProps) {
  const submit = useMutation(api.ai_feedback.submit);

  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);

  const isPositive = rating === "thumbs_up";
  const tagOptions = isPositive ? POSITIVE_TAGS : NEGATIVE_TAGS;

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    // Reset state on close so reopening starts clean.
    setComment("");
    setSelectedTags(new Set());
    setIsSubmitting(false);
    setDidSubmit(false);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submit({
        conversation_id: conversationId,
        ...(messageId ? { message_id: messageId } : {}),
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(selectedTags.size > 0 ? { tags: Array.from(selectedTags) } : {}),
        message_content_snapshot: messageContent,
      });
      setDidSubmit(true);
      // Auto-close after a beat so the success state isn't sticky.
      setTimeout(handleClose, 1200);
    } catch (err) {
      // Best-effort: surface a generic message in the comment field area; the
      // user can retry. Don't pop a separate toast since the modal is modal.
      console.warn("[AIFeedbackModal] submit failed:", err);
      setIsSubmitting(false);
    }
  }, [
    submit,
    conversationId,
    messageId,
    rating,
    comment,
    selectedTags,
    messageContent,
    isSubmitting,
    handleClose,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(120)} style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={handleClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(180)}
          style={styles.sheet}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRatingChip}>
              {isPositive ? (
                <ThumbsUp size={14} color={BrandColors.secondary} strokeWidth={2} />
              ) : (
                <ThumbsDown size={14} color={BrandColors.secondary} strokeWidth={2} />
              )}
              <Text style={styles.headerRatingText} size="xs" weight="semiBold">
                {isPositive ? "Helpful" : "Not helpful"}
              </Text>
            </View>
            <Text style={styles.headerTitle} weight="semiBold">
              Share feedback
            </Text>
            <Pressable onPress={handleClose} hitSlop={8} style={styles.headerClose}>
              <X size={18} color="#6B7280" strokeWidth={2} />
            </Pressable>
          </View>

          {didSubmit ? (
            <View style={styles.successBody}>
              <Text style={styles.successTitle} weight="semiBold">
                Thanks for the feedback.
              </Text>
              <Text style={styles.successSubtitle} size="sm">
                Your note is in. We use it to make Oto better.
              </Text>
            </View>
          ) : (
            <>
              {/* Message excerpt */}
              <View style={styles.excerptBlock}>
                <Text style={styles.excerptLabel} size="xs" weight="semiBold">
                  About this response
                </Text>
                <Text style={styles.excerptText} size="sm" numberOfLines={4}>
                  {messageContent || "—"}
                </Text>
              </View>

              {/* Tags */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel} size="xs" weight="semiBold">
                  What stood out? (optional)
                </Text>
                <View style={styles.tagRow}>
                  {tagOptions.map((tag) => {
                    const active = selectedTags.has(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        disabled={isSubmitting}
                        style={({ pressed }) => [
                          styles.tagChip,
                          active && styles.tagChipActive,
                          pressed && !isSubmitting && styles.tagChipPressed,
                        ]}
                      >
                        <Text
                          style={[styles.tagChipText, active && styles.tagChipTextActive]}
                          size="sm"
                          weight={active ? "semiBold" : "medium"}
                        >
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Comment */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel} size="xs" weight="semiBold">
                  Anything else? (optional)
                </Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  editable={!isSubmitting}
                  placeholder={
                    isPositive
                      ? "What worked well?"
                      : "What went wrong, or what would have helped?"
                  }
                  placeholderTextColor="#9CA3AF"
                  multiline
                  style={styles.commentInput}
                />
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && !isSubmitting && styles.submitButtonPressed,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
              >
                <Text style={styles.submitText} weight="semiBold">
                  {isSubmitting ? "Sending…" : "Send feedback"}
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 28, 36, 0.45)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: "#F8FAFB",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerRatingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.secondary + "15",
  },
  headerRatingText: {
    color: BrandColors.secondary,
  },
  headerTitle: {
    flex: 1,
    color: BrandColors.primary,
    fontSize: 16,
  },
  headerClose: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  // Excerpt
  excerptBlock: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  excerptLabel: {
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  excerptText: {
    color: BrandColors.primary,
    lineHeight: 18,
  },
  // Sections
  section: {
    gap: Spacing.xs,
  },
  sectionLabel: {
    color: BrandColors.primary,
    fontSize: 13,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  tagChip: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tagChipActive: {
    backgroundColor: BrandColors.secondary + "15",
    borderColor: BrandColors.secondary,
  },
  tagChipPressed: {
    opacity: 0.85,
  },
  tagChipText: {
    color: "#6B7280",
  },
  tagChipTextActive: {
    color: BrandColors.secondary,
  },
  // Comment
  commentInput: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 88,
    textAlignVertical: "top",
    color: BrandColors.primary,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  // Submit
  submitButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: BrandColors.white,
    fontSize: 15,
  },
  // Success state
  successBody: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  successTitle: {
    color: BrandColors.primary,
    fontSize: 16,
  },
  successSubtitle: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
});

/**
 * AIFeedbackModal
 *
 * PURPOSE: Sprint 4 — opened by the thumbs-up / thumbs-down buttons on each
 * AI message bubble. Collects optional category tags ("What stood out?") and
 * submits to `api.ai_feedback.submit`. Each submission is tied to the
 * conversation row so the owner can review the full thread when troubleshooting.
 *
 * UX: A @gorhom/bottom-sheet that slides up from the bottom (dim+blur backdrop
 * via BlurBackdrop, drag handle, pan-down-to-close, light gray surface). Sized
 * dynamically to its content. Header carries a rating chip; the tag-chip
 * vocabulary varies per rating.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, View } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";

import { useMutation } from "convex/react";
import { ThumbsDown, ThumbsUp, X } from "lucide-react-native";

import { Button, Text } from "@/components/shared-ui";
import { BlurBackdrop } from "@/components/shared-ui/BlurBackdrop";
import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";
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
  const sheetRef = useRef<BottomSheetModal>(null);

  // Detached/floating chrome to match the app's shared AppBottomSheetModal:
  // 95% width (2.5% inset each side), rounded all round, sitting low near the
  // bottom edge.
  const { width } = Dimensions.get("window");
  const modalContainerStyle = useMemo(
    () => ({ marginHorizontal: width * 0.025 }),
    [width],
  );

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);

  const isPositive = rating === "thumbs_up";
  const tagOptions = isPositive ? POSITIVE_TAGS : NEGATIVE_TAGS;

  // Drive the imperative sheet from the declarative `visible` prop so the
  // parent keeps its existing render-when-open API. The parent unmounts us
  // on close, so state resets naturally on the next open.
  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  // Animate the sheet down; `onDismiss` then propagates to `onClose`.
  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submit({
        conversation_id: conversationId,
        ...(messageId ? { message_id: messageId } : {}),
        rating,
        ...(selectedTags.size > 0 ? { tags: Array.from(selectedTags) } : {}),
        message_content_snapshot: messageContent,
      });
      setDidSubmit(true);
      // Auto-close after a beat so the success state isn't sticky.
      setTimeout(() => sheetRef.current?.dismiss(), 1200);
    } catch (err) {
      // Surface failure by re-enabling submit. User can retry; sheet stays open.
      console.warn("[AIFeedbackModal] submit failed:", err);
      setIsSubmitting(false);
    }
  }, [
    submit,
    conversationId,
    messageId,
    rating,
    selectedTags,
    messageContent,
    isSubmitting,
    onClose,
  ]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      detached
      bottomInset={Spacing.sm}
      style={modalContainerStyle}
      backdropComponent={BlurBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
      onDismiss={onClose}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: Spacing.lg }]}>
        {/* Header — close on left, title centered, rating pill on right */}
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={10}
            disabled={isSubmitting}
          >
            <X size={20} color="#111827" />
          </Pressable>
          <Text weight="bold" size="lg" color="#111827" style={styles.headerTitle}>
            Share feedback
          </Text>
          <View style={styles.headerRatingChip}>
            {isPositive ? (
              <ThumbsUp size={12} color={BrandColors.secondary} strokeWidth={2.2} />
            ) : (
              <ThumbsDown size={12} color={BrandColors.secondary} strokeWidth={2.2} />
            )}
            <Text style={styles.headerRatingText} size="xs" weight="semiBold">
              {isPositive ? "Helpful" : "Not helpful"}
            </Text>
          </View>
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
                        style={[
                          styles.tagChipText,
                          active && styles.tagChipTextActive,
                        ]}
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

            {/* Footer — Cancel + Submit, mirrors FeedbackModal */}
            <View style={styles.actionsRow}>
              <Button
                variant="ghost"
                fullWidth
                style={[styles.actionButton, styles.cancelButton]}
                textColor="#111827"
                onPress={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Pressable
                style={[
                  styles.submitWrap,
                  isSubmitting && styles.submitWrapDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text weight="semiBold" size="md" color="#FFF">
                    Send feedback
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

// ============================================================================
// STYLES — mirror FeedbackModal's card chrome
// ============================================================================

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#E8ECF0",
    borderRadius: 50,
    overflow: "hidden",
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: "#6B7280",
    borderRadius: 2,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
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
  // Content
  content: {
    paddingHorizontal: 24,
    paddingTop: Spacing.xs,
    gap: 16,
  },
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: "#EEF2F7",
  },
  submitWrap: {
    flex: 2,
    borderRadius: 14,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  submitWrapDisabled: {
    opacity: 0.5,
  },
  // Success
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

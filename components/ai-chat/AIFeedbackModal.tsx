/**
 * AIFeedbackModal
 *
 * PURPOSE: Sprint 4 — opened by the thumbs-up / thumbs-down buttons on each
 * AI message bubble. Collects an optional comment plus optional category tags
 * and submits to `api.ai_feedback.submit`. Each submission is tied to the
 * conversation row so the owner can review the full thread when troubleshooting.
 *
 * UX: Mirrors the chrome of `components/shared-ui/FeedbackModal` (card on
 * dim+blurred backdrop, handle bar, close-on-left header, Cancel + Submit
 * footer, light gray surface) so the two feedback surfaces feel unified.
 * Adds AI-specific content: rating chip, "About this response" excerpt, and
 * the tag-chip vocabulary that varies per rating.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx
 *
 * OWNER: Waleed Mansour
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import { useMutation } from "convex/react";
import { ThumbsDown, ThumbsUp, X } from "lucide-react-native";

import { Button, Text } from "@/components/shared-ui";
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
  const insets = useSafeAreaInsets();
  const submit = useMutation(api.ai_feedback.submit);

  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);

  const isPositive = rating === "thumbs_up";
  const tagOptions = isPositive ? POSITIVE_TAGS : NEGATIVE_TAGS;

  // Force KAV remount on Android when keyboard hides to fix height not resetting.
  // Mirrors the trick used in FeedbackModal — debounce against the hide event
  // caused by the remount itself.
  const [kavKey, setKavKey] = useState(0);
  const remountTimer = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (remountTimer.current) clearTimeout(remountTimer.current);
      remountTimer.current = setTimeout(() => {
        setKavKey((k) => k + 1);
      }, 100);
    });
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      if (remountTimer.current) {
        clearTimeout(remountTimer.current);
        remountTimer.current = null;
      }
    });
    return () => {
      sub.remove();
      showSub.remove();
      if (remountTimer.current) clearTimeout(remountTimer.current);
    };
  }, [visible]);

  // Reset state when the modal hides so reopening starts clean.
  useEffect(() => {
    if (!visible) {
      setComment("");
      setSelectedTags(new Set());
      setIsSubmitting(false);
      setDidSubmit(false);
      setKavKey(0);
    }
  }, [visible]);

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
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(selectedTags.size > 0 ? { tags: Array.from(selectedTags) } : {}),
        message_content_snapshot: messageContent,
      });
      setDidSubmit(true);
      // Auto-close after a beat so the success state isn't sticky.
      setTimeout(onClose, 1200);
    } catch (err) {
      // Surface failure by re-enabling submit. User can retry; modal stays open.
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
    onClose,
  ]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenBackdrop} pointerEvents="none" />

      <KeyboardAvoidingView
        key={kavKey}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <BlurView
          intensity={28}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Modal Card */}
        <View style={[styles.card, { marginBottom: insets.bottom + 8 }]}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header — close on left, title centered, rating pill on right */}
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={10}
              disabled={isSubmitting}
            >
              <X size={20} color="#111827" />
            </Pressable>
            <Text
              weight="bold"
              size="lg"
              color="#111827"
              style={styles.headerTitle}
            >
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

          {/* Content */}
          <View style={styles.content}>
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
                {/* Excerpt */}
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
                    textAlignVertical="top"
                  />
                </View>

                {/* Footer — Cancel + Submit, mirrors FeedbackModal */}
                <View style={styles.actionsRow}>
                  <Button
                    variant="ghost"
                    fullWidth
                    style={[styles.actionButton, styles.cancelButton]}
                    textColor="#111827"
                    onPress={onClose}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// STYLES — mirror FeedbackModal's card chrome
// ============================================================================

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  fullScreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    marginHorizontal: 10,
    backgroundColor: "#E8ECF0",
    borderRadius: 28,
    overflow: "hidden",
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
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
    paddingBottom: 24,
    gap: 16,
  },
  excerptBlock: {
    backgroundColor: BrandColors.white,
    borderRadius: 14,
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
  commentInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 120,
    fontSize: 16,
    color: "#111827",
    fontFamily: FontFamily.regular,
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

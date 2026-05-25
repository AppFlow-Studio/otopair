/**
 * FileDisputeSheet — bottom sheet for filing a Pre-Job Approval dispute.
 * Picks a reason (chips), optional notes, calls `booking_disputes.fileDispute`.
 * Server enforces the 14-day window + ownership + one-open-per-booking.
 *
 * USED IN: components/bookings/BookingDetailsSheet.tsx (via PaymentBreakdown
 * CTA).
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FloatingSheet,
  type FloatingSheetRef,
} from "@/components/shared-ui/FloatingSheet";
import { Text } from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const REASONS: Array<{ key: string; label: string }> = [
  { key: "wrong_part", label: "Wrong part installed" },
  { key: "overcharged", label: "I was overcharged" },
  { key: "work_not_done", label: "Work wasn't done" },
  { key: "quality_concern", label: "Quality concern" },
  { key: "other", label: "Other" },
];

export interface FileDisputeSheetRef {
  open: (bookingId: Id<"bookings"> | string) => void;
  close: () => void;
}

interface Props {
  onSubmitted?: (bookingId: string) => void;
  onClose?: () => void;
}

export const FileDisputeSheet = forwardRef<FileDisputeSheetRef, Props>(
  ({ onSubmitted, onClose }, ref) => {
    const sheetRef = useRef<FloatingSheetRef>(null);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();

    const [bookingId, setBookingId] = useState<string | null>(null);
    const [reasonKey, setReasonKey] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileDispute = useMutation(api.booking_disputes.fileDispute);

    useImperativeHandle(ref, () => ({
      open: (id) => {
        setBookingId(String(id));
        setReasonKey(null);
        setNotes("");
        setError(null);
        setSubmitting(false);
        sheetRef.current?.open();
      },
      close: () => sheetRef.current?.close(),
    }));

    const handleSubmit = useCallback(async () => {
      if (!bookingId || !reasonKey || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await fileDispute({
          bookingId: bookingId as Id<"bookings">,
          reason: reasonKey,
          notes: notes.trim().length > 0 ? notes.trim() : undefined,
        });
        onSubmitted?.(bookingId);
        sheetRef.current?.close();
      } catch (e: any) {
        setError(e?.message ?? "We couldn't file your dispute. Please try again.");
        setSubmitting(false);
      }
    }, [bookingId, reasonKey, notes, submitting, fileDispute, onSubmitted]);

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={[Math.min(screenHeight * 0.7, 620)]}
        onClose={onClose}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text size="xl" weight="bold" color="#141C24">
            What went wrong?
          </Text>
          <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
            Tell us briefly. Our team reviews every dispute and follows up
            within 1 business day.
          </Text>

          <View style={styles.chipRow}>
            {REASONS.map((r) => {
              const selected = reasonKey === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setReasonKey(r.key)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  disabled={submitting}
                >
                  <Text
                    size="sm"
                    weight={selected ? "semiBold" : "regular"}
                    color={selected ? "#FFFFFF" : "#141C24"}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text size="sm" weight="semiBold" color="#141C24" style={styles.notesLabel}>
            Additional details (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            maxLength={500}
            placeholder="What happened? Any photos or context that would help our team?"
            placeholderTextColor="#9CA3AF"
            editable={!submitting}
            style={styles.notesInput}
            textAlignVertical="top"
          />

          {error ? (
            <Text size="sm" weight="regular" color="#DC2626" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!reasonKey || submitting}
            style={[
              styles.submit,
              (!reasonKey || submitting) && styles.submitDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text size="md" weight="semiBold" color="#FFFFFF">
                Submit dispute
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </FloatingSheet>
    );
  },
);
FileDisputeSheet.displayName = "FileDisputeSheet";

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  chipSelected: {
    backgroundColor: "#141C24",
    borderColor: "#141C24",
  },
  notesLabel: {
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 12,
    fontSize: 15,
    color: "#141C24",
    lineHeight: 20,
  },
  error: {
    marginTop: 12,
  },
  submit: {
    marginTop: 20,
    backgroundColor: "#141C24",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: {
    opacity: 0.5,
  },
});

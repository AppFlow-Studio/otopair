/**
 * FileDisputeSheet — "Something not right?" — the customer's way to ask us to
 * look at a charge. Reason chips, optional note, optional photos, then
 * `booking_disputes.fileDispute`. Server enforces the 14-day window +
 * ownership + one-open-per-booking.
 *
 * Copy rule from the Sept 21 decision: the word "dispute" never appears in
 * anything the customer reads. It is the internal name for the record; to the
 * driver this is us offering to check something, not them opening a case. The
 * file and the table keep the name; the screen does not.
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
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FloatingSheet,
  type FloatingSheetRef,
} from "@/components/shared-ui/FloatingSheet";
import { Text } from "@/components/shared-ui";
import { BrandColors } from "@/constants/theme";
import { useToast } from "@/hooks/useToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const REASONS: Array<{ key: string; label: string }> = [
  { key: "wrong_part", label: "Part doesn't look right" },
  { key: "overcharged", label: "The amount looks wrong" },
  { key: "work_not_done", label: "Work I expected wasn't done" },
  { key: "quality_concern", label: "Something about the work" },
  { key: "other", label: "Something else" },
];

const MAX_PHOTOS = 4;

type Attachment = { uri: string; storageId: string | null; failed?: boolean };

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
    const [photos, setPhotos] = useState<Attachment[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileDispute = useMutation(api.booking_disputes.fileDispute);
    const generateUploadUrl = useMutation(api.users.generateUploadUrl);
    const toast = useToast();

    /* Photos were promised before they existed: the notes placeholder read
       "Any photos or context that would help our team?" while the sheet had
       no way to attach one. A photo of the wrong part is the single most
       useful thing a driver can send us, so this closes the gap rather than
       softening the placeholder. */
    const addPhotos = useCallback(async () => {
      if (submitting) return;
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) return;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          "We need access to your photos to attach one. You can turn it on in Settings.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      setError(null);
      const picked = result.assets.slice(0, remaining);
      // Show the thumbnails immediately, upload behind them. A slow upload
      // must never look like a dropped photo.
      setPhotos((cur) => [
        ...cur,
        ...picked.map((a) => ({ uri: a.uri, storageId: null })),
      ]);
      for (const asset of picked) {
        try {
          const url = await generateUploadUrl();
          const blob = await (await fetch(asset.uri)).blob();
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": blob.type || "image/jpeg" },
            body: blob,
          });
          if (!res.ok) throw new Error("upload failed");
          const { storageId } = (await res.json()) as { storageId: string };
          setPhotos((cur) =>
            cur.map((p) => (p.uri === asset.uri ? { ...p, storageId } : p)),
          );
        } catch {
          setPhotos((cur) =>
            cur.map((p) =>
              p.uri === asset.uri ? { ...p, failed: true } : p,
            ),
          );
        }
      }
    }, [photos.length, submitting, generateUploadUrl]);

    const removePhoto = useCallback((uri: string) => {
      setPhotos((cur) => cur.filter((p) => p.uri !== uri));
    }, []);

    useImperativeHandle(ref, () => ({
      open: (id) => {
        setBookingId(String(id));
        setReasonKey(null);
        setNotes("");
        setPhotos([]);
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
        // Only fully-uploaded photos carry a storage id. A still-uploading or
        // failed one is dropped rather than blocking the send — the note and
        // the reason are what we actually need to start looking.
        const photoIds = photos
          .map((p) => p.storageId)
          .filter((id): id is string => !!id) as Id<"_storage">[];
        await fileDispute({
          bookingId: bookingId as Id<"bookings">,
          reason: reasonKey,
          notes: notes.trim().length > 0 ? notes.trim() : undefined,
          photoIds: photoIds.length > 0 ? photoIds : undefined,
        });
        onSubmitted?.(bookingId);
        sheetRef.current?.close();
        toast.trust(
          "Thanks — we're on it",
          "We'll take a look and follow up within 1 business day.",
        );
      } catch (e: any) {
        setError(
          e?.message ?? "We couldn't send that just now. Please try again.",
        );
        setSubmitting(false);
      }
    }, [bookingId, reasonKey, notes, photos, submitting, fileDispute, onSubmitted, toast]);

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
          <Text size={28} weight="extraBold" color={BrandColors.primary}>
            Something not right?
          </Text>
          <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
            Tell us what you noticed and we&apos;ll look into it. Someone gets
            back to you within 1 business day.
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
            Anything you&apos;d like to add? (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            maxLength={500}
            placeholder="Whatever you noticed — even a sentence helps."
            placeholderTextColor="#9CA3AF"
            editable={!submitting}
            style={styles.notesInput}
            textAlignVertical="top"
          />

          <View style={styles.photoRow}>
            {photos.map((p) => (
              <View key={p.uri} style={styles.photoWrap}>
                <Image source={{ uri: p.uri }} style={styles.photo} />
                {p.storageId == null && !p.failed ? (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </View>
                ) : null}
                {p.failed ? (
                  <View style={styles.photoOverlay}>
                    <Text size="xs" weight="semiBold" color="#FFFFFF">
                      Failed
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => removePhoto(p.uri)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  style={styles.photoRemove}
                >
                  <Text size="xs" weight="bold" color="#FFFFFF">
                    ×
                  </Text>
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                onPress={addPhotos}
                disabled={submitting}
                style={styles.photoAdd}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
              >
                <Text size="xs" weight="semiBold" color="#6B7280">
                  + Photo
                </Text>
              </Pressable>
            ) : null}
          </View>

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
                Send to Otopair
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
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  photoWrap: { width: 64, height: 64, borderRadius: 10, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  photoRemove: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  photoAdd: {
    width: 64,
    height: 64,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
  },
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

/**
 * RescheduleSheet
 *
 * PURPOSE: Modal reschedule picker. User picks a new date + time via the
 *          native datetime picker; onConfirm fires with formatted strings
 *          that match useBookingStore's scheduledDate / scheduledTime shape.
 *
 * USED IN: components/bookings/BookingDetailsSheet.tsx (FullContent)
 */

import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import React, { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/shared-ui";

// ============================================================================
// TYPES
// ============================================================================

export interface RescheduleSheetRef {
  open: (bookingId: string, initial?: { date: string; time: string }) => void;
  close: () => void;
}

interface RescheduleSheetProps {
  /** Called when the user confirms a new date/time. date = YYYY-MM-DD, time = "9:00 AM". */
  onConfirm: (bookingId: string, date: string, time: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function parseInitial(date?: string, time?: string): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  if (date) {
    const parts = date.split("-").map(Number);
    if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
      d.setFullYear(parts[0], parts[1] - 1, parts[2]);
    }
  }
  if (time) {
    const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (match) {
      let hh = parseInt(match[1], 10);
      const mm = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hh !== 12) hh += 12;
      if (ampm === "AM" && hh === 12) hh = 0;
      d.setHours(hh, mm, 0, 0);
    }
  }
  return d;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RescheduleSheet = forwardRef<RescheduleSheetRef, RescheduleSheetProps>(
  ({ onConfirm }, ref) => {
    const [visible, setVisible] = useState(false);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Date>(new Date());

    const open = useCallback((id: string, initial?: { date: string; time: string }) => {
      setBookingId(id);
      setSelected(parseInitial(initial?.date, initial?.time));
      setVisible(true);
    }, []);

    const close = useCallback(() => {
      setVisible(false);
      setBookingId(null);
    }, []);

    useImperativeHandle(ref, () => ({ open, close }));

    const handleConfirm = useCallback(() => {
      if (!bookingId) return;
      onConfirm(bookingId, formatDate(selected), formatTime(selected));
      setVisible(false);
      setBookingId(null);
    }, [bookingId, onConfirm, selected]);

    const handlePickerChange = useCallback((_e: DateTimePickerEvent, date?: Date) => {
      if (date) setSelected(date);
    }, []);

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </View>

        <View style={styles.centered} pointerEvents="box-none">
          <View style={styles.card}>
            <View style={styles.header}>
              <Text size="xl" weight="bold" color="#1A1A1A">
                Reschedule
              </Text>
              <TouchableOpacity
                onPress={close}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={selected}
                mode="datetime"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={handlePickerChange}
                themeVariant="light"
                accentColor="#5299FE"
              />
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text size="md" weight="semiBold" color="#FFFFFF">
                Confirm New Time
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  },
);

RescheduleSheet.displayName = "RescheduleSheet";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pickerWrap: {
    alignItems: "center",
  },
  confirmButton: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
});

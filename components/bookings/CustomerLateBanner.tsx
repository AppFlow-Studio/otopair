/**
 * CustomerLateBanner — shows at the top of My Bookings whenever the
 * shop has fired a `customer_late_push_reminder` or
 * `overrun_customer_resolution` for the current user.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Clock, AlertTriangle, Car, User as UserIcon } from "lucide-react-native";
import { Text } from "@/components/shared-ui";

const LATE_CATEGORY = "customer_late_push_reminder";
const RESOLUTION_CATEGORY = "overrun_customer_resolution";

function formatTime12h(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface Props {
  onReschedule?: (bookingId: Id<"bookings">) => void;
}

function HandlePill({ handle, color }: { handle: string | null; color: string }) {
  if (!handle) return null;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color,
        backgroundColor: "#ffffffcc",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
      }}
    >
      <Text style={{ fontFamily: "Courier", fontWeight: "700", fontSize: 11, color }}>
        {handle}
      </Text>
    </View>
  );
}

function MetaRow({
  customerName,
  vehicleLabel,
  color,
}: {
  customerName: string | null;
  vehicleLabel: string | null;
  color: string;
}) {
  if (!customerName && !vehicleLabel) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
      {customerName && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <UserIcon size={12} color={color} />
          <Text size="xs" style={{ color }}>{customerName}</Text>
        </View>
      )}
      {vehicleLabel && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Car size={12} color={color} />
          <Text size="xs" style={{ color }}>{vehicleLabel}</Text>
        </View>
      )}
    </View>
  );
}

export function CustomerLateBanner({ onReschedule }: Props) {
  const notifications = useQuery(api.notifications.getMyNotifications, {}) as
    | Array<any>
    | undefined;
  const acknowledge = useMutation((api as any).bookings.acknowledgeCustomerLate);
  const markRead = useMutation(api.notifications.markNotificationRead);

  const lateRow = notifications?.find((n) => n.category === LATE_CATEGORY) ?? null;
  const resolutionRow = notifications?.find((n) => n.category === RESOLUTION_CATEGORY) ?? null;

  if (!lateRow && !resolutionRow) return null;

  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {lateRow && (
        <View style={[styles.banner, styles.lateBg]}>
          <Clock size={18} color="#92400e" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
              <Text weight="semibold" style={{ color: "#78350f", flexShrink: 1 }}>
                {lateRow.shopName ? `${lateRow.shopName} is waiting` : "Shop is waiting"}
              </Text>
              <HandlePill handle={lateRow.shortHandle} color="#78350f" />
            </View>
            <MetaRow
              customerName={lateRow.customerName}
              vehicleLabel={lateRow.vehicleLabel}
              color="#92400e"
            />
            <Text size="sm" style={{ color: "#92400e", marginTop: 4 }}>
              Booking at {formatTime12h(lateRow.scheduledTime) || "the scheduled time"} hasn't checked in yet.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={async () => {
                  if (!lateRow.booking_id) return;
                  await acknowledge({ bookingId: lateRow.booking_id });
                  await markRead({ notificationId: lateRow._id });
                }}
              >
                <Text size="sm" weight="semibold" style={{ color: "#fff" }}>On my way</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnOutline]}
                onPress={() => {
                  if (lateRow.booking_id && onReschedule) onReschedule(lateRow.booking_id);
                }}
              >
                <Text size="sm" weight="semibold" style={{ color: "#78350f" }}>Reschedule</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {resolutionRow && (
        <View style={[styles.banner, styles.resolutionBg]}>
          <AlertTriangle size={18} color="#1d4ed8" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
              <Text weight="semibold" style={{ color: "#1e3a8a", flexShrink: 1 }}>
                {resolutionRow.payload?.newEndTime
                  ? `Booking now finishing around ${formatTime12h(resolutionRow.payload.newEndTime)}`
                  : `Booking running ~${resolutionRow.payload?.extensionMinutes ?? 15} min behind`}
              </Text>
              <HandlePill handle={resolutionRow.shortHandle} color="#1e3a8a" />
            </View>
            <MetaRow
              customerName={resolutionRow.customerName}
              vehicleLabel={resolutionRow.vehicleLabel}
              color="#1e40af"
            />
            <Text size="sm" style={{ color: "#1e40af", marginTop: 4 }}>
              {resolutionRow.shopName
                ? `${resolutionRow.shopName} pushed the slot forward.`
                : "Shop pushed the slot forward."}{" "}
              Tap reschedule if the new time doesn't work.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                style={[styles.btn, styles.btnBlue]}
                onPress={() => {
                  if (resolutionRow.booking_id && onReschedule) onReschedule(resolutionRow.booking_id);
                }}
              >
                <Text size="sm" weight="semibold" style={{ color: "#fff" }}>Reschedule</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnOutlineBlue]}
                onPress={() => markRead({ notificationId: resolutionRow._id })}
              >
                <Text size="sm" weight="semibold" style={{ color: "#1e40af" }}>Got it</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  lateBg: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  resolutionBg: { backgroundColor: "#eff6ff", borderColor: "#93c5fd" },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  btnPrimary: { backgroundColor: "#d97706", borderColor: "#d97706" },
  btnOutline: { backgroundColor: "transparent", borderColor: "#d97706" },
  btnBlue: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  btnOutlineBlue: { backgroundColor: "transparent", borderColor: "#2563eb" },
});

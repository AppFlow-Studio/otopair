/**
 * JobBlockedNotice — "your car is held up", on the booking card.
 *
 * ─── WHY IT READS THE BLOCKER, NOT THE OUTBOX ───────────────────────────────
 * CustomerLateBanner filters notification_outbox by category, and copying that
 * here would be wrong. That table is a delivery QUEUE: the dispatch crons flip
 * rows to "sent" within a minute and every driver-facing feed filters on
 * status === "pending", so a banner built on it would show for up to sixty
 * seconds and then vanish while the car was still stuck.
 *
 * A blocker has its own lifecycle — resolved_at — which is what this actually
 * wants to track. The notice is then true for exactly as long as the hold is.
 *
 * The server decides which kinds a driver may see (KIND_POLICY.notifyDriver).
 * Damage is deliberately never among them: a shop tells a customer they
 * damaged the car, the platform doesn't do it for them by push notification
 * while the car is still on the lift. Nothing here re-derives that list.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { AlertTriangle, Clock, PhoneCall } from "lucide-react-native";
import { api } from "@/convex/_generated/api";
import { Text } from "@/components/shared-ui";

type Blocker = {
  _id: string;
  kind: string;
  label: string;
  note: string | null;
  opened_at: number;
  shop_name: string | null;
  driver_can_act: boolean;
  work_paused: boolean;
};

/** "for 2h" / "since this morning" reads better than a timestamp on a card. */
function heldFor(openedAt: number): string {
  const mins = Math.max(0, Math.round((Date.now() - openedAt) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function JobBlockedNotice({ bookingId }: { bookingId: string }) {
  const blockers = useQuery(
    (api as any).jobBlockers.activeForMyBooking,
    bookingId ? { bookingId } : "skip",
  ) as Blocker[] | undefined;

  if (!blockers || blockers.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {blockers.map((b) => {
        // The only hold the driver can personally clear. Everything else is
        // the shop's to resolve, and implying otherwise invites a pointless
        // phone call.
        const Icon = b.driver_can_act
          ? PhoneCall
          : b.work_paused
            ? Clock
            : AlertTriangle;
        return (
          <View key={b._id} style={styles.row}>
            <Icon size={16} color="#B45309" strokeWidth={2} />
            <View style={styles.body}>
              <Text weight="semiBold" size="sm" color="#7C2D12">
                {b.label}
                <Text size="sm" color="#B45309">
                  {"  ·  "}
                  {heldFor(b.opened_at)}
                </Text>
              </Text>
              {/* The mechanic's own note — the only part of this that says
                  anything specific about THIS car. */}
              {b.note ? (
                <Text size="sm" color="#7C2D12" style={styles.note}>
                  {b.note}
                </Text>
              ) : null}
              {b.driver_can_act ? (
                <Text weight="semiBold" size="sm" color="#B45309" style={styles.note}>
                  {b.shop_name ?? "Your shop"} is trying to reach you.
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  body: { flex: 1, minWidth: 0 },
  note: { marginTop: 2, lineHeight: 18 },
});

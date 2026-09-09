/**
 * useNotificationsFromConvex
 *
 * Wraps the customer-facing notification_outbox queries. Used by the
 * bell icon (unread count) and the NotificationsSheet (list).
 */

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface NotificationRow {
  _id: Id<"notification_outbox">;
  category: string;
  payload: any;
  booking_id: Id<"bookings"> | null;
  shop_id: Id<"shops"> | null;
  created_at: number;
  status: string;
  /** null until the user has opened/seen the row (drives read/unread styling). */
  read_at?: number | null;
  rescheduleExpiresAt?: number | null;
  /** Booking appointment date/time (ISO-ish string) — shown in the row meta. */
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  /** Muted context line inputs — present on booking- and car-bound rows. */
  vin?: string | null;
  vehicleYMMT?: string | null;
  mileage?: number | null;
  shopName?: string | null;
  mechanicName?: string | null;
}

export function useNotificationsFromConvex() {
  const notifications = useQuery(api.notifications.getMyNotifications) as
    | NotificationRow[]
    | undefined;
  const unreadCount = useQuery(api.notifications.getMyUnreadCount);
  const markReadMutation = useMutation(api.notifications.markNotificationRead);
  const resolveMutation = useMutation(api.notifications.resolveNotification);

  // Mark a row SEEN — it stays in the feed (styled read) until resolved.
  const markRead = useCallback(
    async (notificationId: Id<"notification_outbox">) => {
      await markReadMutation({ notificationId });
    },
    [markReadMutation],
  );

  // Archive a row from the feed (dismiss / done).
  const resolve = useCallback(
    async (notificationId: Id<"notification_outbox">) => {
      await resolveMutation({ notificationId });
    },
    [resolveMutation],
  );

  return {
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
    isLoading: notifications === undefined,
    markRead,
    resolve,
  };
}

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
  rescheduleExpiresAt?: number | null;
}

export function useNotificationsFromConvex() {
  const notifications = useQuery(api.notifications.getMyNotifications) as
    | NotificationRow[]
    | undefined;
  const unreadCount = useQuery(api.notifications.getMyUnreadCount);
  const markReadMutation = useMutation(api.notifications.markNotificationRead);

  const markRead = useCallback(
    async (notificationId: Id<"notification_outbox">) => {
      await markReadMutation({ notificationId });
    },
    [markReadMutation],
  );

  return {
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
    isLoading: notifications === undefined,
    markRead,
  };
}

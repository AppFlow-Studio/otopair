/**
 * UpcomingBookingCard
 *
 * A BookingCard for an ACTIVE booking that also surfaces unread Message Shop
 * state: a count for the View Message row, and whether any of those unread
 * messages is the shop asking to approve extra work — which the card raises as
 * its own banner, because "we found more than we expected" is a decision
 * waiting on the driver rather than a message waiting to be read. Kept as a thin wrapper (rather than folding the subscription
 * into BookingCard) so the per-booking ticket query only mounts for the short
 * active list — never for the potentially long history list.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import React, { useMemo } from 'react';

import { useShopTicketsForBooking } from '@/hooks/useShopTicketsFromConvex';
import { BookingCard, type BookingCardProps } from './BookingCard';

export function UpcomingBookingCard(
  props: Omit<BookingCardProps, 'unreadMessageCount' | 'hasUnreadEstimate'>,
) {
  const { tickets } = useShopTicketsForBooking(props.booking.id);
  const unreadMessageCount = useMemo(
    () =>
      tickets.reduce((sum, t) => sum + (t.customer_unread_count ?? 0), 0),
    [tickets],
  );
  const hasUnreadEstimate = useMemo(
    () =>
      tickets.some(
        (t) =>
          t.category === 'approve_extra_work' &&
          (t.customer_unread_count ?? 0) > 0,
      ),
    [tickets],
  );

  return (
    <BookingCard
      {...props}
      unreadMessageCount={unreadMessageCount}
      hasUnreadEstimate={hasUnreadEstimate}
    />
  );
}

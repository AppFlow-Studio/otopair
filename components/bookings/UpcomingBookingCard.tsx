/**
 * UpcomingBookingCard
 *
 * A BookingCard for an ACTIVE booking that also surfaces an unread Message Shop
 * count badge. Kept as a thin wrapper (rather than folding the subscription
 * into BookingCard) so the per-booking ticket query only mounts for the short
 * active list — never for the potentially long history list.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import React, { useMemo } from 'react';

import { useShopTicketsForBooking } from '@/hooks/useShopTicketsFromConvex';
import { BookingCard, type BookingCardProps } from './BookingCard';

export function UpcomingBookingCard(
  props: Omit<BookingCardProps, 'unreadMessageCount'>,
) {
  const { tickets } = useShopTicketsForBooking(props.booking.id);
  const unreadMessageCount = useMemo(
    () =>
      tickets.reduce((sum, t) => sum + (t.customer_unread_count ?? 0), 0),
    [tickets],
  );

  return <BookingCard {...props} unreadMessageCount={unreadMessageCount} />;
}
